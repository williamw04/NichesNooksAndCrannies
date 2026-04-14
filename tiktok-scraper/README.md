# TikTok Location Scraper

Discovers TikTok videos about places via Google SERP, scrapes engagement data and location tags, and extracts named locations with social proof scoring. Supports AI-powered location extraction via OpenRouter.

## Installation

```bash
cd tiktok-scraper
npm install
npx playwright install chromium
```

## Usage

### Interactive TUI (Recommended)

```bash
npm start
```

### Command Line

```bash
npm run scrape -- --input example-input.json
```

### Quick Start

```bash
npm run scrape:example
```

### Library / Programmatic

```typescript
import { runScraper, processResults } from './index.js';

const output = await runScraper({
  searchQueries: ['best coffee shops nyc'],
  city: 'nyc',
  resultsPerPage: 10,
  maxItems: 50,
});

const locations = await processResults(output.results, {
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
});
console.log(locations);
```

### Example Input Format

```json
{
  "searchQueries": ["best cafe spots", "hidden gems", "underrated places"],
  "city": "nyc",
  "resultsPerPage": 5,
  "maxItems": 55,
  "openRouterModel": "google/gemma-3-27b-it:free",
  "minEngagement": 0
}
```

## Output

The scraper produces two output files in the `output/` directory:

1. **Full Results** (`tiktok-scrape-[timestamp].json`): Complete scraping data including videos and stats
2. **Extracted Locations** (`locations-[timestamp].json`): Processed location data with social proof scores

### Location Output Structure

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
  music?: string;
  extractionMethod: 'poi_tag' | 'ai_extraction';
}

interface SocialProof {
  likes: number;
  comments: number;
  shares: number;
  collects: number;
  playCount: number;
  totalEngagement: number;
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `searchQueries` | string[] | `[]` | Google search queries (appends "tiktok" automatically) |
| `city` | string | `""` | Target city for location context |
| `resultsPerPage` | number | `5` | Max video URLs to collect per query |
| `maxItems` | number | `55` | Total videos to scrape across all queries |
| `openRouterApiKey` | string | env var | OpenRouter API key for AI location extraction |
| `openRouterModel` | string | `gemma-3-27b-it:free` | Preferred LLM model for extraction |
| `minEngagement` | number | `0` | Minimum likes+comments to include a video |

## Notes

- **`headless: false` required**: Google captcha and TikTok bot detection require a visible browser
- **Google captcha**: If no TikTok links are found, the scraper pauses 15s for you to solve a captcha manually
- **`__NEXT_DATA__` is blocked**: TikTok blocks embedded data for unauthenticated sessions — all data comes from DOM scraping
- **No login required**: The scraper works without TikTok authentication by going through Google SERP
- Uses Playwright with anti-detection measures (custom user agent, webdriver property hidden)
- Includes random delays between requests to avoid rate limiting

## Integration with Hidden Gems Pipeline

The extracted locations can be further processed with:

1. Google Places API for coordinates and validation
2. AI enrichment for descriptions and vibe summaries
3. Deduplication with other data sources

See `../docs/product-specs/` for the full pipeline specification.
