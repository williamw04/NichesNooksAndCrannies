import { LocationExtraction } from '../processor.js';
import { StorageAdapter, StoredLocation, ScrapeRunMeta, LocationFilters } from './types.js';

export class DualWriter implements StorageAdapter {
  constructor(
    private primary: StorageAdapter,
    private secondary?: StorageAdapter,
  ) {}

  async upsertLocations(
    locations: LocationExtraction[],
    runMeta: ScrapeRunMeta,
    city?: string,
  ): Promise<void> {
    await this.primary.upsertLocations(locations, runMeta, city);

    if (this.secondary) {
      try {
        await this.secondary.upsertLocations(locations, runMeta, city);
      } catch (error) {
        console.warn(
          `Supabase write failed: ${error instanceof Error ? error.message : 'Unknown error'}. Data safe in SQLite.`,
        );
      }
    }
  }

  async getLocations(filters?: LocationFilters): Promise<StoredLocation[]> {
    return this.primary.getLocations(filters);
  }

  async getLocationByName(normalizedName: string, city?: string): Promise<StoredLocation | null> {
    return this.primary.getLocationByName(normalizedName, city);
  }
}
