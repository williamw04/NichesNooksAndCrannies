# Processor

## Purpose

Transforms raw scraped videos into deduplicated, aggregated locations with social proof scores. Combines POI tag extraction (from TikTok location tags) with AI-powered location extraction, then deduplicates, aggregates, and filters by engagement.

## Key Methods

- `processResults(results, config)`: Main pipeline — extracts locations from all videos, deduplicates, aggregates, and filters (`processor.ts:160`)
- `buildSocialProof(video)`: Converts video engagement metrics into a `SocialProof` object (`processor.ts:28`)
- `inferCategoryFromQuery(query, keywords)`: Maps search query text to a category using keyword matching (`processor.ts:45`)
- `hasUsableContent(video)`: Checks if video has description, subtitles, or POI tag (`processor.ts:98`)
- `isGenericLocation(name)`: Checks if name is a neighborhood/city/borough (`processor.ts:91`)

## How It Works

1. **Content filtering**: Videos without description, subtitles, AND POI tag are skipped entirely
2. **AI extraction (primary)**: If AI configured and video has description/subtitles, Qwen extracts business names with query context
3. **POI tag extraction (secondary)**: If POI tag exists and is NOT generic (neighborhood/city/borough), it's extracted
4. **Deduplication**: Location names normalized and grouped. Highest-engagement instance kept as canonical
5. **Aggregation**: Social proof summed across all duplicate entries
6. **Filtering**: Locations below `minEngagement` threshold removed
7. **Sorting**: Results sorted by total engagement (descending)

## Filtering Rules

### Skip video if no usable content

A video is skipped if it has:
- No description AND no subtitles AND no POI tag

This prevents wasting AI calls on videos with no location information.

### Skip generic POI tags

POI tags matching generic location names are filtered out:
- Boroughs: Manhattan, Brooklyn, Queens, Bronx, Staten Island
- Cities: New York, NYC, New York City
- Neighborhoods: East Village, West Village, SoHo, Tribeca, Williamsburg, etc.

These are NOT specific business names and would resolve to geographic centers during geocoding.

Example: A video with POI tag "East Village" is skipped because that's a neighborhood, not a venue.

## Weird Details

- **Category from query, not video**: Category inferred from search query that found the video. A video found via "hidden gem cafes nyc" gets category `cafe` regardless of content (`processor.ts:169`)
- **AI overrides category**: When AI extracts locations, `loc.type` from AI response overrides query-inferred category
- **500ms delay between AI calls**: Fixed sleep between AI extraction calls to avoid rate limiting
- **Location name cleaning**: POI tag names stripped of `·` and everything after it (TikTok appends extra data after middle dot)

## Source

- Main file: `src/processor.ts`
- AI extractor: `src/ai-extractor.ts`
- Types: `src/types.ts`
- Generic locations list: `GENERIC_LOCATIONS` constant in processor.ts