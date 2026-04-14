import { LocationExtraction } from '../processor.js';
import { PipelineMode } from '../pipeline/types.js';

export interface StoredLocation extends LocationExtraction {
  id: string;
  normalizedName: string;
  city: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  gemLevel?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScrapeRunMeta {
  mode: PipelineMode;
  queries: string[];
  city?: string;
  videosScraped: number;
  locationsFound: number;
  errors: string[];
}

export interface LocationFilters {
  city?: string;
  category?: string;
  minEngagement?: number;
  gemLevel?: number;
  extractionMethod?: 'poi_tag' | 'ai_extraction';
  limit?: number;
  offset?: number;
}

export interface StorageConfig {
  sqlitePath?: string;
  supabase?: {
    url: string;
    key: string;
  };
}

export interface StorageAdapter {
  upsertLocations(locations: LocationExtraction[], runMeta: ScrapeRunMeta, city?: string): Promise<void>;
  getLocations(filters?: LocationFilters): Promise<StoredLocation[]>;
  getLocationByName(normalizedName: string, city?: string): Promise<StoredLocation | null>;
}
