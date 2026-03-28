# TikTok Scraper

Playwright-based TikTok scraper for discovering NYC hidden gems.

## Installation

```bash
cd tiktok-scraper
npm install
npx playwright install chromium
```

## Usage

### Step 1: Authentication (Required)

TikTok requires login to access search results. First, authenticate:

```bash
npm run login
```

This will:
1. Open a browser window to TikTok
2. Wait for you to log in manually
3. Save your session cookies to `auth/tiktok-cookies.json`
4. Press Enter in the terminal after logging in

**Note:** Cookies expire periodically. Re-run `npm run login` if scraping fails.

### Step 2: Run the Scraper

#### Interactive TUI (Recommended)

```bash
npm start
```

#### Command Line

```bash
npm run scrape -- --input custom-input.json
```

#### Quick Start

```bash
npm run scrape:example
```

### Example Input Format

```json
{
  "searchQueries": [
    "best cafe spots in New York City",
    "hidden gems NYC restaurants"
  ],
  "resultsPerPage": 5,
  "maxItems": 55,
  "shouldDownloadVideos": false,
  "shouldDownloadCovers": false,
  "shouldDownloadSubtitles": false,
  "shouldDownloadSlideshowImages": false,
  "profileScrapeSections": ["videos"],
  "profileSorting": "latest",
  "excludePinnedPosts": false,
  "searchSection": "",
  "maxProfilesPerQuery": 10,
  "searchSorting": "0",
  "searchDatePosted": "0",
  "scrapeRelatedVideos": false,
  "shouldDownloadAvatars": false,
  "shouldDownloadMusicCovers": false,
  "downloadSubtitlesOptions": "NEVER_DOWNLOAD_SUBTITLES",
  "proxyCountryCode": "None"
}
```

## Output

The scraper produces two output files in the `output/` directory:

1. **Full Results** (`tiktok-scrape-[timestamp].json`): Complete scraping data including videos and profiles
2. **Extracted Locations** (`locations-[timestamp].json`): Processed location data ready for the hidden gems database

### Output Structure

```typescript
interface LocationExtraction {
  name: string;
  description: string;
  category: string;
  source: 'tiktok_video' | 'tiktok_profile';
  sourceUrl: string;
  hashtags: string[];
  mentions: string[];
  author: string;
  authorFollowers: number;
  playCount: number;
}
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `searchQueries` | string[] | List of search queries to execute |
| `resultsPerPage` | number | Number of results per search query |
| `maxItems` | number | Maximum total items to scrape |
| `shouldDownloadVideos` | boolean | Download video files (not implemented) |
| `shouldDownloadCovers` | boolean | Download cover images (not implemented) |
| `profileScrapeSections` | string[] | Profile sections to scrape: 'videos', 'liked', 'favorites' |
| `profileSorting` | string | Sort order: 'latest', 'oldest', 'popular' |
| `maxProfilesPerQuery` | number | Maximum profiles to scrape per query |
| `searchSection` | string | Filter by: '', 'user', 'video', 'hashtag', 'sound' |
| `searchDatePosted` | string | Filter by date: '0', '1', '7', '30' days |

## Programmatic Usage

```typescript
import { runScraper, processResults } from './src/index.js';

const output = await runScraper({
  searchQueries: ['best pizza NYC'],
  resultsPerPage: 10,
  maxItems: 50
});

const locations = processResults(output.results);
console.log(locations);
```

## Notes

- **Authentication required**: Run `npm run login` before scraping
- **Use a dedicated account**: Consider creating a separate TikTok account for scraping to avoid risking your personal account
- **Cookies expire**: Re-authenticate if scraping stops working
- Uses Playwright with anti-detection measures
- Includes random delays between requests to avoid rate limiting
- TikTok may still detect automation - use responsibly
- Consider using proxies for large-scale scraping

## Integration with Hidden Gems Pipeline

The extracted locations can be further processed with:

1. Google Places API for coordinates and validation
2. AI enrichment for descriptions and vibe summaries
3. Deduplication with other data sources

See `../docs/product-specs/` for the full pipeline specification.