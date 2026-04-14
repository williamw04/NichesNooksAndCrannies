# Storage Feature — Spec

## Summary

A dual-write storage layer that persists extracted locations to SQLite (local, fast, offline-safe) and Supabase (remote, API-ready, collaboration-ready). Replaces the current JSON-only output.

## Problem

- `saveResults()` writes a single JSON file per run — no accumulation across runs
- No deduplication across runs (same location found via different queries)
- No querying or filtering (must load entire JSON into memory)
- No schema enforcement
- No path to frontend/API — JSON files can't serve a web app

## Requirements

### Functional

1. **Accumulate** — locations from multiple pipeline runs merge into persistent store
2. **Dedup** — same location found across runs/queries upserts (merges engagement), never duplicates
3. **Query** — retrieve locations by category, neighborhood, gem level, min engagement, city
4. **Track provenance** — each location record knows which run, query, and pipeline mode found it
5. **Export** — produce the final CSV output (single file, 50 rows, matches hidden-gems schema)
6. **Sync** — push locally-cached data to Supabase when connectivity is available
7. **Recover** — if Supabase is unreachable, data is safe in SQLite; sync later

### Non-Functional

1. **Zero network dependency during scraping** — SQLite writes are synchronous and local; Supabase writes happen after or async
2. **Idempotent** — running the same pipeline twice produces the same store state (upsert, not append)
3. **No Supabase required to start** — works with SQLite alone; Supabase config is optional
4. **Pluggable** — `StorageAdapter` interface so the pipeline doesn't know about SQLite or Supabase specifically

## Users

1. **Scraper operator** (CLI) — runs pipelines, views local results, syncs to Supabase when ready
2. **Future frontend** — reads from Supabase to browse/explore locations
3. **Future API consumers** — query locations via Supabase REST API
4. **Collaborators** — multiple people scraping different cities, all writing to shared Supabase

## Data Model

### Core entity: Location

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | text | Cleaned location name |
| normalized_name | text | Lowercase, alphanumeric only — used for dedup |
| description | text | From TikTok video description |
| category | text | Inferred from query or AI |
| city | text | From pipeline config |
| neighborhood | text | TBD (future enrichment) |
| latitude | float | TBD (future geocoding) |
| longitude | float | TBD (future geocoding) |
| address | text | TBD (future geocoding) |
| gem_level | int | 1=Iconic, 2=Local Favorite, 3=Hidden Gem (future classification) |
| extraction_method | text | `poi_tag` or `ai_extraction` |
| social_proof | JSON | Aggregated engagement: likes, comments, shares, collects, playCount, totalEngagement |
| source_video_count | int | How many distinct videos mention this location |
| tags | JSON array | Hashtags from source videos |
| created_at | timestamp | First seen |
| updated_at | timestamp | Last updated |

### Supporting entity: ScrapeRun

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| mode | text | `google`, `tags`, or `hybrid` |
| queries | JSON array | Queries used in this run |
| city | text | Target city |
| videos_scraped | int | Total videos processed |
| locations_found | int | Total locations extracted |
| errors | JSON array | Error messages |
| started_at | timestamp | |
| completed_at | timestamp | |

### Supporting entity: LocationSource (linking table)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| location_id | UUID | FK → locations |
| run_id | UUID | FK → scrape_runs |
| source_url | text | TikTok video URL |
| author | text | TikTok username |
| author_followers | int | |
| raw_engagement | JSON | Per-video engagement (before aggregation) |

## Dedup Strategy

- Dedup key: `normalized_name + city`
- On conflict: merge social_proof (sum engagement), increment source_video_count, update `updated_at`, keep best description
- `normalized_name` = lowercase + strip non-alphanumeric (matches existing `processor.ts` logic)

## Integration Points

- **Input**: receives `LocationExtraction[]` from `processResults()` (existing)
- **CLI**: new `--sync` flag to push SQLite → Supabase without re-scraping
- **TUI**: new menu option to sync local → remote
- **Pipeline**: `StorageAdapter` injected into pipeline config (or called after `run()`)

## Out of Scope

- Geocoding / coordinate enrichment (future feature)
- Gem level classification (future feature)
- Frontend / API server (separate project)
- Authentication / multi-tenancy
- Real-time subscriptions

## Dependencies

- `better-sqlite3` — local SQLite (required)
- `@supabase/supabase-js` — Supabase client (optional, only if Supabase is configured)
- Supabase project with matching schema (self-hosted or cloud)
