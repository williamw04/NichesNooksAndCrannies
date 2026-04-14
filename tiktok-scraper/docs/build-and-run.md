# Build, Compile & Run

## Prerequisites

- Node.js 18+
- npm
- Playwright browsers (`npx playwright install chromium`)

## Install

```bash
npm install
npx playwright install chromium
```

## Build (TypeScript → JS)

```bash
npm run build
```

Outputs to `dist/`. Used for programmatic imports — the app runs via `tsx` in development, so building is optional.

## Run Modes

### CLI — Full Pipeline

```bash
npm run scrape -- --input example-input.json
```

Runs the complete pipeline: Google SERP → discover pages → individual video scraping → AI location extraction → saves results to `output/`.

Supports any JSON file matching `TikTokScraperInput`:

```bash
npm run scrape -- --input my-config.json
```

### CLI — Validation

```bash
npm run scrape -- --validate
```

Geocodes locations stored in SQLite using Google Maps Places Text Search API. Updates coordinates, addresses, ratings, and place IDs.

### Interactive TUI

```bash
npm run start
# or
npm run tui
```

Menu-driven interface for configuring queries, settings, then running the scraper. Saves configs to `configs/` for reuse.

### Library / Programmatic

```ts
import { runScraper, processResults, validateLocations } from './index.js';

const output = await runScraper({
  searchQueries: ['best coffee shops nyc'],
  city: 'nyc',
  resultsPerPage: 10,
  maxItems: 50,
});

const locations = await processResults(output.results);
console.log(locations);

// Validate with Google Maps Places API
await validateLocations({
  storage: { sqlitePath: 'data/locations.db' },
  apiKey: process.env.GOOGLE_MAPS_API_KEY!,
});
```

## Testing

### Integration Test Suite

```bash
npm test
```

Tests each pipeline component individually against real Google and TikTok pages:

| Test Stage | What it verifies |
|------------|-----------------|
| Test 1: Google SERP | Finds TikTok links, classifies video vs discover URLs, extracts view counts |
| Test 2: Discover Page | Scrapes video containers, extracts view counts and creator names |
| Test 3: Video Scraping | Scrapes individual TikTok videos for engagement, VTT captions, location tags |

Outputs results to `output/test-results-{timestamp}.json`.

**Note:** Google may show a captcha. The browser stays open (headless: false) with a 15s pause — solve the captcha manually if prompted. Subsequent runs usually pass.

### Debug Scripts

```bash
npm run debug           # General debug
npm run debug:google    # Google SERP link extraction
npm run debug:search    # TikTok discover/search page scraping
npm run debug:video     # Individual video page scraping
npm run debug:subtitles # VTT caption capture
```

Ad-hoc scripts for inspecting individual components. Output is verbose with DOM structure details.

## Configuration

### Input JSON Schema

```json
{
  "searchQueries": ["best coffee shops nyc"],
  "city": "nyc",
  "resultsPerPage": 5,
  "maxItems": 50,
  "minEngagement": 0,
  "categoryKeywords": { "cafe": ["coffee", "espresso"] }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `searchQueries` | `[]` | Google search queries (appends "tiktok" automatically) |
| `city` | `""` | Target city for location context |
| `resultsPerPage` | `5` | Max video URLs to collect per query |
| `maxItems` | `55` | Total videos to scrape across all queries |
| `debug` | `false` | Dumps `<a>` element HTML for each SERP result |
| `minEngagement` | `0` | Minimum likes+comments to include a video |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `QWEN_API_KEY` | DashScope API key for AI location extraction |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key for validation (Places Text Search) |
| `SUPABASE_URL` | Supabase project URL for remote storage |
| `SUPABASE_KEY` | Supabase service role key |
| `SQLITE_PATH` | Path to SQLite database (default: `data/locations.db`) |

## Output

All output goes to `output/`:

| File | Content |
|------|---------|
| `tiktok-scrape-{timestamp}.json` | Full scrape results (videos, stats, errors) |
| `locations-{timestamp}.json` | Extracted locations with social proof scores |
| `test-results-{timestamp}.json` | Test suite pass/fail results |