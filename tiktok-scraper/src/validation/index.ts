import { createStorage, StorageConfig } from '../storage/index.js';
import { geocodeLocation, GeocodeResult } from './geocoder.js';
import { LocationExtraction } from '../processor.js';
import { randomDelay } from '../scraping/browser.js';

export interface ValidationConfig {
  storage: StorageConfig;
  apiKey: string;
  city?: string;
  dryRun?: boolean;
}

export interface BatchValidationConfig {
  apiKey: string;
  city?: string;
}

export interface ValidatedLocation extends LocationExtraction {
  latitude: number;
  longitude: number;
  address: string;
  neighborhood?: string;
  placeId?: string;
  rating?: number;
}

export interface BatchValidationResult {
  valid: ValidatedLocation[];
  invalid: LocationExtraction[];
}

export async function validateLocationsBatch(
  locations: LocationExtraction[],
  config: BatchValidationConfig,
): Promise<BatchValidationResult> {
  const valid: ValidatedLocation[] = [];
  const invalid: LocationExtraction[] = [];

  if (locations.length === 0) {
    return { valid, invalid };
  }

  console.log(`\n=== Transform: Geocoding ${locations.length} locations ===`);

  for (const location of locations) {
    const city = config.city || 'New York';
    const result = await geocodeLocation(location.name, city, config.apiKey);

    if (result) {
      valid.push({
        ...location,
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.address,
        neighborhood: result.neighborhood,
        placeId: result.placeId,
        rating: result.rating,
      });
      console.log(`  ✓ ${location.name}: ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}${result.rating ? ` (${result.rating}★)` : ''}`);
    } else {
      invalid.push(location);
      console.log(`  ✗ ${location.name}: no results, filtered out`);
    }

    await randomDelay(100, 200);
  }

  console.log(`\n=== Validation Summary ===`);
  console.log(`Valid locations: ${valid.length}`);
  console.log(`Filtered out: ${invalid.length}`);

  return { valid, invalid };
}

export async function validateLocations(config: ValidationConfig): Promise<{
  validated: number;
  failed: number;
  skipped: number;
}> {
  const storage = createStorage(config.storage);

  const allLocations = await storage.getLocations();
  const locationsNeedingValidation = allLocations.filter(loc => !loc.latitude || !loc.longitude);

  console.log(`\n=== Google Maps Validation ===`);
  console.log(`Total locations: ${allLocations.length}`);
  console.log(`Need validation: ${locationsNeedingValidation.length}`);

  if (locationsNeedingValidation.length === 0) {
    console.log('All locations already validated.');
    return { validated: 0, failed: 0, skipped: allLocations.length };
  }

  let validated = 0;
  let failed = 0;

  for (const location of locationsNeedingValidation) {
    const city = config.city || location.city || 'New York';
    const result = await geocodeLocation(location.name, city, config.apiKey);

    if (result && !config.dryRun) {
      const { SQLiteAdapter } = await import('../storage/sqlite.js');
      const dbPath = config.storage.sqlitePath || 'data/locations.db';
      const sqlite = new SQLiteAdapter(dbPath);

      try {
        await sqlite.updateLocationCoordinates(
          location.id,
          result.latitude,
          result.longitude,
          result.address,
          result.neighborhood,
          result.placeId,
          result.rating,
        );
        console.log(`  ✓ ${location.name}: ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}${result.rating ? ` (${result.rating}★)` : ''} [${result.address}]`);
        validated++;
      } finally {
        sqlite.close();
      }
    } else if (result && config.dryRun) {
      console.log(`  [DRY RUN] ${location.name}: would set ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`);
      validated++;
    } else {
      console.log(`  ✗ ${location.name}: failed to geocode`);
      failed++;
    }

    await randomDelay(100, 200);
  }

  console.log(`\n=== Validation Summary ===`);
  console.log(`Validated: ${validated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${allLocations.length - locationsNeedingValidation.length}`);

  return { validated, failed, skipped: allLocations.length - locationsNeedingValidation.length };
}