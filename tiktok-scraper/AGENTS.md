# TikTok Location Scraper

Scrapes TikTok videos via Google SERP to discover and extract named locations with social proof scoring.

## Capabilities

- Google SERP → TikTok video URLs
- TikTok discover/tag page scraping
- Individual video page scraping (engagement, location tags, VTT captions)
- AI location extraction (OpenRouter)
- Deduplication + social proof aggregation

## File Map

| File | Purpose |
|------|---------|
| `src/google-scraper.ts` | Core scraper: Google SERP discovery, discover pages, video pages |
| `src/ai-extractor.ts` | AI location extraction via OpenRouter with model fallback |
| `src/processor.ts` | Location extraction pipeline: POI tags + AI, dedup, aggregation |
| `src/types.ts` | All TypeScript interfaces, defaults, category keywords |
| `src/index.ts` | Library entry: `runScraper()`, `saveResults()`, re-exports |
| `src/cli.ts` | CLI entry: full pipeline with `--input` JSON config |
| `src/tui.ts` | Interactive TUI: menu-driven config and execution |
| `src/test-scrape.ts` | Integration test suite against live Google/TikTok |
| `src/debug-*.ts` | Debug scripts for individual pipeline stages |
| `docs/build-and-run.md` | Build, run, test, and config reference |

## Critical Constraints

- View counts between 2000–2100 are rejected (Google "2025" year filter false positive) — see `google-scraper.ts:185,200`
- TikTok blocks `__NEXT_DATA__` for unauthenticated sessions — embedded data is hardcoded to `null` at `google-scraper.ts:519`
- `headless: false` required — Google captcha and TikTok bot detection require a visible browser

## Entry Points

- `npm start` / `npm run tui` — Interactive TUI
- `npm run scrape -- --input file.json` — CLI pipeline
- `npm run scrape:example` — CLI with example-input.json
- `import { runScraper } from './index.js'` — Library

## See Also

- Build & run details: `docs/build-and-run.md`
- Component design: `docs/google-scraper/design.md`, `docs/ai-extractor/design.md`, `docs/processor/design.md`
- Architecture decisions: `docs/adr/`
