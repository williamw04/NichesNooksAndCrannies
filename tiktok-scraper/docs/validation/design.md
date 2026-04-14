# Geocoder / Location Validation

## Purpose

Validates extracted location names by geocoding them to precise business addresses using Google Maps Places Text Search API. This is the **Transform stage** of the ETL pipeline — invalid locations are filtered out before storage.

## Pipeline Position

```
Extract:    runPipeline()          → raw video data (descriptions, VTT captions)
Transform:  processResults()       → extracted location names (deduped + aggregated)
            validateLocationsBatch() → validated locations with coordinates (filters invalid)
Load:       storage.upsertLocations() → only validated locations stored
```

## Key Methods

### `validateLocationsBatch(locations, config)` — Transform stage

Takes `LocationExtraction[]` and returns `{ valid: ValidatedLocation[], invalid: LocationExtraction[] }`.

- Calls Places Text Search API for each location name
- Returns only locations with valid geocode results
- Adds coordinates, address, neighborhood, rating, placeId to valid locations
- Invalid locations are filtered out (not stored)

**Usage in CLI:**
```typescript
const locations = await processResults(pipelineResult.results, config);

if (googleMapsApiKey) {
  const { valid, invalid } = await validateLocationsBatch(locations, { apiKey, city });
  await storage.upsertLocations(valid, runMeta, city);
} else {
  // Store without coordinates if no API key
  await storage.upsertLocations(locations, runMeta, city);
}
```

### `validateLocations(config)` — Re-validation flag (`--validate`)

Reads locations from SQLite storage that have no coordinates, geocodes them, and updates the database. Useful when:
- `GOOGLE_MAPS_API_KEY` was missing during initial scrape
- Re-validating old data with a new API key
- Fixing locations that failed initial validation

## Why Places API, Not Geocoding

The Geocoding API resolves `"West Village, New York"` to the neighborhood's geographic center (40.7347, -74.0048). This is wrong for a venue search — we want the actual business, not the area center.

The Places Text Search API finds `"fellini in New York"` and returns the restaurant listing at `174 7th Ave S` with precise coordinates. This is what we need for location validation.

## API Details

- **Places Text Search**: `https://maps.googleapis.com/maps/api/place/textsearch/json?query={name}+in+{city}&key={apiKey}`
- **Geocoding (fallback)**: `https://maps.googleapis.com/maps/api/geocode/json?address={name},+{city}&key={apiKey}`

Places API is called first. If no business results, falls back to Geocoding API for parks/landmarks.

## Filtering Behavior

| Scenario | Result |
|----------|--------|
| Business found (e.g. "asano") | Valid: stored with address + rating |
| Neighborhood/area name (e.g. "West Village") | Invalid: filtered out (no business listing) |
| Park/landmark (e.g. "Central Park") | Valid: stored with coordinates (Geocoding fallback) |
| Unknown/misspelled name | Invalid: filtered out |

## Source

- Main file: `src/validation/index.ts` — `validateLocationsBatch()`, `validateLocations()`
- Geocoder: `src/validation/geocoder.ts` — `geocodeLocation()`, `searchPlace()`
- CLI: `src/cli.ts` — integrated in main pipeline flow