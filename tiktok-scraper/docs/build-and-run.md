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

### Interactive TUI

```bash
npm run start
# or
npm run tui
```

Menu-driven interface for configuring queries, settings, then running the scraper. Saves configs to `configs/` for reuse.

### Library / Programmatic

```ts
import { runScraper } from './index.js';

const output = await runScraper({
  searchQueries: ['best coffee shops nyc'],
  city: 'nyc',
  resultsPerPage: 10,
  maxItems: 50,
});
```

### Dev Mode

```bash
npm run dev
```

Runs `src/index.ts` directly with default config. Same as library mode but from the command line.

## Testing

### Integration Test Suite

```bash
npx tsx src/test-scrape.ts
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
  "debug": true,
  "openRouterApiKey": "sk-...",
  "openRouterModel": "google/gemma-3-27b-it:free",
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
| `openRouterApiKey` | env `OPENROUTER_API_KEY` | Enables AI location extraction |
| `minEngagement` | `0` | Minimum likes+comments to include a video |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key for AI location extraction |

## Output

All output goes to `output/`:

| File | Content |
|------|---------|
| `tiktok-scrape-{timestamp}.json` | Full scrape results (videos, stats, errors) |
| `locations-{timestamp}.json` | Extracted locations with social proof scores |
| `test-results-{timestamp}.json` | Test suite pass/fail results |
