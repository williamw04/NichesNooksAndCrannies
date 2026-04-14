# Storage Feature — Design

## Architecture

```
Pipeline run
    │
    ▼
processResults()  →  LocationExtraction[]       (existing, no changes)
    │
    ▼
storage.upsert(locations, runMeta)              (NEW)
    ├── SQLiteAdapter.upsert()                  synchronous, always succeeds
    └── SupabaseAdapter.upsert()                async, fire-and-forget
    │
    ▼
storage.query(filters)  →  LocationExtraction[]  (NEW)
storage.exportCsv(outputPath)                    (NEW)
storage.sync()                                   (NEW: push SQLite → Supabase)
```

## File Structure

```
src/storage/
├── types.ts          StorageAdapter interface, StoredLocation, ScrapeRunMeta, LocationFilters
├── sqlite.ts         SQLiteAdapter class
├── supabase.ts       SupabaseAdapter class
├── dual-writer.ts    DualWriter — composes two adapters
├── csv-export.ts     exportToCsv() — produces final CSV
└── index.ts          createStorage() factory + re-exports
```

## Interfaces

### StorageAdapter

```typescript
export interface StorageAdapter {
  upsertLocations(locations: LocationExtraction[], runMeta: ScrapeRunMeta): Promise<void>;
  getLocations(filters?: LocationFilters): Promise<StoredLocation[]>;
  getLocationByName(normalizedName: string, city?: string): Promise<StoredLocation | null>;
}
```

Single interface, two implementations. The pipeline never knows which backend it's talking to.

### ScrapeRunMeta

```typescript
export interface ScrapeRunMeta {
  mode: PipelineMode;
  queries: string[];
  city?: string;
  videosScraped: number;
  locationsFound: number;
  errors: string[];
}
```

Passed alongside locations so the adapter can record provenance.

### LocationFilters

```typescript
export interface LocationFilters {
  city?: string;
  category?: string;
  minEngagement?: number;
  gemLevel?: number;
  extractionMethod?: 'poi_tag' | 'ai_extraction';
  limit?: number;
  offset?: number;
}
```

### StoredLocation

```typescript
export interface StoredLocation extends LocationExtraction {
  id: string;
  city: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  gemLevel?: number;
  createdAt: string;
  updatedAt: string;
}
```

Extends `LocationExtraction` from `processor.ts` with fields that get populated later (geocoding, gem classification). This is the shape stored in both SQLite and Supabase.

## SQLite Schema

Single file stored at `data/locations.db` (gitignored).

```sql
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'local',
  city TEXT NOT NULL DEFAULT '',
  neighborhood TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  gem_level INTEGER,
  extraction_method TEXT NOT NULL,
  source_video_count INTEGER NOT NULL DEFAULT 1,
  location_tag TEXT,
  location_url TEXT,
  social_proof TEXT NOT NULL DEFAULT '{}',  -- JSON
  hashtags TEXT NOT NULL DEFAULT '[]',       -- JSON array
  mentions TEXT NOT NULL DEFAULT '[]',       -- JSON array
  music TEXT,
  author TEXT,
  author_followers INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'tiktok_video',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(normalized_name, city)
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  queries TEXT NOT NULL,          -- JSON array
  city TEXT,
  videos_scraped INTEGER DEFAULT 0,
  locations_found INTEGER DEFAULT 0,
  errors TEXT DEFAULT '[]',       -- JSON array
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS location_sources (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES scrape_runs(id),
  source_url TEXT NOT NULL,
  author TEXT,
  author_followers INTEGER DEFAULT 0,
  raw_engagement TEXT NOT NULL DEFAULT '{}', -- JSON
  UNIQUE(location_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_locations_category ON locations(category);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_locations_engagement ON locations(json_extract(social_proof, '$.totalEngagement'));
CREATE INDEX IF NOT EXISTS idx_location_sources_location ON location_sources(location_id);
```

## Supabase Schema

Identical to SQLite with these dialect differences:
- `TEXT` → `text`, `INTEGER` → `integer`, `REAL` → `double precision`
- `json_extract()` → `->` / `->>` operators
- `AUTOINCREMENT` → `gen_random_uuid()` for default IDs
- Add RLS policies if multi-user later

Migration SQL will live in the Supabase project, not in this repo. This repo just has the client code.

## SQLiteAdapter

```typescript
export class SQLiteAdapter implements StorageAdapter {
  constructor(private db: Database) {}

  upsertLocations(locations, runMeta): Promise<void> {
    // 1. Insert into scrape_runs
    // 2. For each location:
    //    a. INSERT OR REPLACE into locations
    //       ON CONFLICT(normalized_name, city):
    //         - merge social_proof (sum)
    //         - increment source_video_count
    //         - update updated_at
    //         - keep best description (longest non-empty)
    //    b. INSERT OR IGNORE into location_sources (dedup by location_id + source_url)
    // 3. All in a single transaction for atomicity
  }

  getLocations(filters?): Promise<StoredLocation[]> {
    // Build WHERE clause from filters
    // ORDER BY json_extract(social_proof, '$.totalEngagement') DESC
    // Apply limit/offset
  }

  getLocationByName(normalizedName, city?): Promise<StoredLocation | null>
}
```

Key design decisions:
- **`better-sqlite3`** — synchronous API, no async overhead, perfect for the "always succeeds" local write
- **Single transaction** per `upsertLocations` call — if anything fails, nothing writes
- **JSON columns** for `social_proof`, `hashtags`, `mentions` — avoids join tables for data that's always read together

## SupabaseAdapter

```typescript
export class SupabaseAdapter implements StorageAdapter {
  constructor(private client: SupabaseClient) {}

  async upsertLocations(locations, runMeta): Promise<void> {
    // 1. Insert into scrape_runs
    // 2. Batch upsert locations using .upsert() with onConflict: 'normalized_name,city'
    // 3. Batch insert location_sources with .upsert() with onConflict: 'location_id,source_url'
    //    - Supabase handles merge logic via upsert
  }

  async getLocations(filters?): Promise<StoredLocation[]> {
    // Build Supabase query with .eq(), .gte(), .order(), .range()
  }

  async getLocationByName(normalizedName, city?): Promise<StoredLocation | null>
}
```

Key design decisions:
- **Batch operations** — collect all locations, send in one request per table (not one per location)
- **Fire-and-forget by default** — the DualWriter catches Supabase errors and logs them without failing the pipeline
- **Optional dependency** — `@supabase/supabase-js` is only imported if Supabase is configured

## DualWriter

```typescript
export class DualWriter implements StorageAdapter {
  constructor(
    private primary: StorageAdapter,    // SQLiteAdapter
    private secondary?: StorageAdapter, // SupabaseAdapter (optional)
  ) {}

  async upsertLocations(locations, runMeta): Promise<void> {
    // 1. Always write to primary (SQLite) — await this
    // 2. If secondary exists, write to it — catch and log errors, never throw
    await this.primary.upsertLocations(locations, runMeta);

    if (this.secondary) {
      try {
        await this.secondary.upsertLocations(locations, runMeta);
      } catch (error) {
        console.warn(`Supabase write failed: ${error.message}. Data safe in SQLite.`);
      }
    }
  }

  // getLocations reads from SQLite only (local-first)
  async getLocations(filters?): Promise<StoredLocation[]> {
    return this.primary.getLocations(filters);
  }

  async getLocationByName(normalizedName, city?): Promise<StoredLocation | null> {
    return this.primary.getLocationByName(normalizedName, city);
  }
}
```

## CSV Export

```typescript
export function exportToCsv(locations: StoredLocation[], outputPath: string): void {
  // Maps to the hidden-gems output schema:
  // name, description, category, latitude, longitude, city, country, address,
  // price_level, google_maps_url, rating, image_url, tags, ai_vibe_summary,
  // gem_level, neighborhood
  //
  // Fields not yet populated (geocoding, gem level, etc.) are left empty.
  // Uses the `csv-stringify` package or manual CSV formatting.
}
```

## Factory

```typescript
export function createStorage(config?: StorageConfig): StorageAdapter {
  const sqlite = new SQLiteAdapter(openOrCreateDb(config?.sqlitePath));
  const supabase = config?.supabase
    ? new SupabaseAdapter(createClient(config.supabase.url, config.supabase.key))
    : undefined;
  return new DualWriter(sqlite, supabase);
}
```

## StorageConfig

```typescript
export interface StorageConfig {
  sqlitePath?: string;  // default: 'data/locations.db'
  supabase?: {
    url: string;
    key: string;
  };
}
```

Loaded from `.env`:
```
SQLITE_PATH=data/locations.db
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
```

## Integration Changes

### `src/cli.ts`

Current flow:
```
scrape → processResults → write JSON
```

New flow:
```
scrape → processResults → storage.upsertLocations(locations, runMeta) → done
```

Add `--sync` flag:
```
npm run scrape -- --sync   # reads SQLite, pushes to Supabase
```

Add `--export-csv` flag:
```
npm run scrape -- --export-csv output/locations.csv
```

### `src/tui.ts`

Add menu option: "Sync to Supabase" — reads all local locations, upserts to Supabase.

### `src/index.ts`

Add re-exports:
```typescript
export { createStorage } from './storage/index.js';
export type { StorageAdapter, StorageConfig, StoredLocation } from './storage/types.js';
export { exportToCsv } from './storage/csv-export.js';
```

### `src/pipeline/types.ts`

Add optional `storage` field to `PipelineConfig` so pipelines can write incrementally (not just at the end). This is optional — the default behavior is still write-all-at-end after `run()`.

## Dedup Logic (SQLite)

```sql
INSERT INTO locations (id, normalized_name, name, ..., social_proof, ...)
VALUES (?, ?, ?, ..., ?, ...)
ON CONFLICT(normalized_name, city) DO UPDATE SET
  social_proof = json_set(
    json_patch(social_proof, excluded.social_proof),
    '$.totalEngagement',
    json_extract(social_proof, '$.totalEngagement') +
    json_extract(excluded.social_proof, '$.totalEngagement')
  ),
  source_video_count = source_video_count + excluded.source_video_count,
  description = CASE
    WHEN length(excluded.description) > length(description) THEN excluded.description
    ELSE description
  END,
  updated_at = excluded.updated_at;
```

Wait — `json_patch` merges at the top level which would overwrite individual fields. Need to sum each field explicitly:

```sql
ON CONFLICT(normalized_name, city) DO UPDATE SET
  likes = likes + excluded.likes,
  comments = comments + excluded.comments,
  shares = shares + excluded.shares,
  collects = collects + excluded.collects,
  play_count = play_count + excluded.play_count,
  total_engagement = total_engagement + excluded.total_engagement,
  source_video_count = source_video_count + 1,
  updated_at = excluded.updated_at;
```

Actually this means flattening `social_proof` into individual columns instead of a JSON column. That's cleaner for SQL and avoids JSON parsing on every query. Let me revise.

### Revised schema: flatten social_proof

```sql
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'local',
  city TEXT NOT NULL DEFAULT '',
  neighborhood TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  gem_level INTEGER,
  extraction_method TEXT NOT NULL,
  source_video_count INTEGER NOT NULL DEFAULT 1,
  location_tag TEXT,
  location_url TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  collects INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  total_engagement INTEGER NOT NULL DEFAULT 0,
  hashtags TEXT NOT NULL DEFAULT '[]',
  mentions TEXT NOT NULL DEFAULT '[]',
  music TEXT,
  author TEXT,
  author_followers INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'tiktok_video',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(normalized_name, city)
);
```

This makes dedup a clean SQL `ON CONFLICT` with arithmetic, no JSON manipulation.

## Dependencies

| Package | Required | Purpose |
|---------|----------|---------|
| `better-sqlite3` | Yes | Local SQLite |
| `@supabase/supabase-js` | No | Remote Supabase (optional) |
| `uuid` | Yes | Generate IDs |

## What Does NOT Change

- `processor.ts` — `processResults()` and `LocationExtraction` remain as-is. Storage receives its output.
- `pipeline/` — pipelines don't change. Storage is called after `run()` completes.
- `scraping/` — no changes.
- `discovery/` — no changes.
