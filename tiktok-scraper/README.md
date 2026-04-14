# TikTok Location Scraper

Discovers NYC locations from TikTok videos via Google SERP, extracts business names with AI (Qwen), validates via Google Places API, and stores with social proof scoring.

## Features

- **Google SERP discovery** → TikTok video URLs + discover/tag page URLs
- **AI location extraction** → Qwen via DashScope extracts business names from descriptions/subtitles
- **Places API validation** → Precise coordinates, addresses, ratings
- **Dual-write storage** → SQLite (local) + Supabase (remote)
- **Interactive visualizer** → Map-based exploration of scraped locations

## Installation

```bash
npm install
npx playwright install chromium
```

## Environment Setup

Create `.env` with:

```
QWEN_API_KEY=your_dashscope_key
GOOGLE_MAPS_API_KEY=your_maps_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

- **QWEN_API_KEY**: Get from [DashScope](https://dashscope.aliyuncs.com/) — used for AI location extraction
- **GOOGLE_MAPS_API_KEY**: Get from [Google Cloud Console](https://console.cloud.google.com/) — enable Maps JavaScript API, Geocoding API, Places API
- **SUPABASE_URL/KEY**: Optional — for remote storage sync

## Usage

### Interactive TUI

```bash
npm start
```

### CLI Pipeline

```bash
# Default (google mode)
npm run scrape -- --input input.json

# Tag mode (no Google captchas)
npm run scrape -- --input input.json --mode tags

# Hybrid mode (maximum coverage)
npm run scrape -- --input input.json --mode hybrid

# Sync to Supabase
npm run scrape -- --sync

# Export to CSV
npm run scrape -- --export-csv output.csv
```

### Example Input Format

```json
{
  "searchQueries": ["hidden gem cafes nyc", "underrated restaurants brooklyn"],
  "city": "nyc",
  "resultsPerPage": 10,
  "maxItems": 100,
  "minEngagement": 500
}
```

**Note**: Don't include "tiktok" in queries — it's appended automatically. Include city name for better targeting.

## Pipeline Architecture

```
Extract → Transform → Load
   │         │        │
   │         │        └─ SQLite (sync) + Supabase (async)
   │         │
   │         └─ AI extraction (Qwen) + Places API validation
   │
   └─ Google SERP → TikTok video pages
```

### Filtering Rules

- Skip videos with no description AND no subtitles AND no POI tag
- Skip generic POI tags (neighborhoods like "East Village", "Manhattan")
- Minimum engagement threshold (`minEngagement`)

## Output

Location output structure:

```typescript
interface LocationExtraction {
  name: string;
  description: string;
  category: string;
  source: 'tiktok_video' | 'ai_extraction';
  sourceUrl: string;
  sourceVideoCount: number;
  hashtags: string[];
  mentions: string[];
  author: string;
  authorFollowers: number;
  socialProof: SocialProof;
  locationTag?: string;
  locationUrl?: string;
  extractionMethod: 'poi_tag' | 'ai_extraction';
  latitude?: number;
  longitude?: number;
  address?: string;
  rating?: number;
  placeId?: string;
}
```

## Visualizer

Explore scraped locations on an interactive map:

```bash
npm run serve
# Open http://localhost:8000/visualizer/
```

Features:
- Auto-centers on NYC (or your location if permitted)
- Shows rating and address in popup
- Color-coded markers by gem level (when assigned)
- Search by city name

## Critical Constraints

- **`headless: false` required** — Google captcha and TikTok bot detection require visible browser
- **Google captcha** — If no TikTok links found, scraper pauses 15s for manual solve
- **`__NEXT_DATA__` blocked** — TikTok blocks embedded data for unauthenticated sessions
- **View counts 2000-2100 rejected** — Google year filter false positive
- **POI tags unreliable** — Often neighborhoods, not businesses. AI extraction is primary method
- **Places API for validation** — Geocoding API resolves neighborhoods to center points; Places API finds actual businesses

## History

### v2.0.0 (2026-04-14)

- **Switched AI extraction**: OpenRouter → Qwen/DashScope (rate limit issues)
- **Switched geocoder**: Geocoding API → Places Text Search API (business-precise)
- **Added validation pipeline**: Filter invalid locations before storage
- **Added storage columns**: `rating`, `placeId` in SQLite/Supabase
- **Fixed Supabase FK**: Preserve existing location IDs on upsert
- **Large scrape**: 18 queries, 90 videos, 93 locations extracted
- **Updated visualizer**: Shows ratings, addresses, fallback loading

### v1.0.0 (2026-03-26)

- Initial release
- Google SERP → TikTok discovery
- POI tag extraction
- OpenRouter AI extraction
- SQLite storage

## File Map

| Path | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry point |
| `src/tui.ts` | TUI entry (exports from `tui/`) |
| `src/tui/menu.ts` | Menu loop |
| `src/tui/executor.ts` | Run, sync, export actions |
| `src/tui/prompts.ts` | Configuration prompts |
| `src/index.ts` | Library exports |
| `src/ai-extractor.ts` | Qwen/DashScope extraction |
| `src/validation/geocoder.ts` | Places API validation |
| `src/storage/sqlite.ts` | Local SQLite |
| `src/storage/supabase.ts` | Remote Supabase |
| `visualizer/index.html` | Map visualization |

## See Also

- Build & run: `docs/build-and-run.md`
- Architecture: `docs/adr/`
- AGENTS.md: Full development guide