# Google Scraper

## Purpose

Bypasses TikTok's anti-bot protections by discovering video URLs through Google SERP instead of TikTok's own search. Scrapes video metadata from individual TikTok video pages using DOM selectors and meta tags.

## Key Methods

- `searchGoogle(query, page)`: Searches Google for `{query} tiktok`, extracts all TikTok URLs, classifies them as video/discover/unknown (`google-scraper.ts:282`)
- `scrapeSearchPage(url, page)`: Scrapes TikTok discover/tag pages for video containers with view counts (`google-scraper.ts:396`)
- `scrapeTikTokVideo(url, page, serpData)`: Scrapes a single TikTok video page for engagement, location, captions, and metadata (`google-scraper.ts:472`)
- `scrape()`: Full pipeline orchestrator — iterates queries, scrapes SERP, discover pages, and individual videos (`google-scraper.ts:684`)
- `parseSerpLinkText(text)`: Parses Google SERP link text to extract title, creator, and view count (`google-scraper.ts:159`)
- `classifyTikTokUrl(url)`: Determines if a URL is a video, discover/search page, or unknown (`google-scraper.ts:149`)

## How It Works

1. **Google SERP discovery**: Searches Google for `{query} tiktok`, collects all `<a>` elements containing `tiktok.com` URLs
2. **URL classification**: Regex-based classification into video URLs (`/video/`, `/t/`) vs search/discover URLs (`/discover/`, `/tag/`, `/category/`, `/f/`)
3. **Discover page fallback**: If Google doesn't return enough video URLs, scrapes up to 2 discover/tag pages for more
4. **Video page scraping**: Visits each video URL, captures VTT captions via response interception, then extracts metadata from DOM selectors and meta tags
5. **SERP metadata passthrough**: View counts from Google's `<cite>` elements are passed to `scrapeTikTokVideo` as fallback (since `__NEXT_DATA__` is blocked)

## Weird Details

- **View count 2000-2100 rejection**: Google's SERP sometimes shows "2025" (the year) where a view count would be. The parser rejects any parsed number in the 2000–2100 range to avoid treating the year as view count (`google-scraper.ts:185-186,200-201`)
- **`__NEXT_DATA__` is dead**: TikTok's Next.js SSR data (`__NEXT_DATA__`) returns `null` for unauthenticated sessions. The code hardcodes `const embedded = null` and relies entirely on DOM scraping and SERP metadata (`google-scraper.ts:524`)
- **No playCount in DOM**: TikTok individual video pages do NOT display a view count element. `playCount` is sourced from `serpData.viewCount` (discover page or SERP `<cite>` element). See `google-scraper.ts:570`
- **VTT captions served as `video/mp4`**: TikTok CDN serves VTT subtitle files with `content-type: video/mp4`. The scraper identifies them by combining the wrong content-type with a size check (`contentLength < 2000`) and verifying the body starts with `WEBVTT` (`google-scraper.ts:488-493`)
- **`SpanLikes` is misnamed**: TikTok reuses the CSS class `SpanLikes` for view/play count on discover pages (not likes). The code uses this class to extract view counts from discover page containers (`google-scraper.ts:426-427`)
- **Captcha pause**: If no TikTok links are found on Google SERP, the scraper pauses 15 seconds for the user to solve a captcha manually, then retries (`google-scraper.ts:307-311`)
- **Date-as-creator guard**: `parseSerpLinkText` iterates `·`-delimited segments backwards, skipping date patterns like "6 months ago" or "Jan 1" to avoid treating them as creator names (`google-scraper.ts:168,191`)
- **Author name from meta tags**: Author nickname is extracted from `og:title` ("Name on TikTok") and `meta[name=description]` ("from Name (@handle)") as fallbacks when embedded data is unavailable (`google-scraper.ts:554-563`)

## Source

- Main file: `src/google-scraper.ts`
- Types: `src/types.ts`
- Debug scripts: `test/debug-google.ts`, `test/debug-search.ts`, `test/debug-video.ts`, `test/debug-subtitles.ts`, `test/debug-captions.ts`, `test/debug-discover-structure.ts`
