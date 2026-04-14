# Exec Plan: Modular Pipeline Refactor

## Status: COMPLETED

## Goal

Refactor the monolithic `GoogleTikTokScraper.scrape()` into composable stages so we can run different discovery flows (Google SERP, AI tags, hybrid) without code duplication.

## Background

Current state: `GoogleTikTokScraper` is one class with private methods for everything. The `scrape()` method hardcodes: Google SERP → discover pages → video pages. CLI/TUI can only call `runScraper()` — no way to select a different flow.

Research (ADR-0006) showed tag pages are viable supplementary discovery but require a query→tag translation step. Google SERP remains the best source for discover pages and direct video URLs.

## Architecture

### Three Stages

| Stage | Responsibility | Input | Output |
|-------|---------------|-------|--------|
| **Discovery** | Find video URLs + listing URLs | Query + city | `GoogleSerpResult[]` (video URLs with metadata) |
| **Listing** | Scrape discover/tag pages for more video URLs | Listing URL | `GoogleSerpResult[]` (additional video URLs) |
| **Extraction** | Scrape individual video pages for structured data | Video URL + serpData | `TikTokVideo` |

### Directory Structure

```
src/
  discovery/
    google-serp.ts       # searchGoogle() — existing, extracted
    tag-generator.ts     # AI tag generation from queries
    discover-url.ts      # Generate discover URLs from queries (fallback)
  scraping/
    search-page.ts       # scrapeSearchPage() — existing, extracted
    video-page.ts        # scrapeTikTokVideo() — existing, extracted
    browser.ts           # Shared browser lifecycle (launch, context, stealth)
  pipeline/
    types.ts             # Pipeline interfaces (DiscoveryResult, PipelineConfig)
    google-pipeline.ts   # Google SERP → listing → extraction
    tag-pipeline.ts      # AI tags → listing → extraction
    hybrid-pipeline.ts   # Google + tags → merge → listing → extraction
  index.ts               # Public API (updated)
  cli.ts                 # --mode google|tags|hybrid
  tui.ts                 # Mode selection in TUI
```

### Pipeline Interface

```typescript
interface PipelineConfig {
  mode: 'google' | 'tags' | 'hybrid';
  queries: string[];
  city?: string;
  resultsPerPage: number;
  maxItems: number;
  openRouterApiKey?: string;
}

interface PipelineResult {
  results: ScrapingResult[];
  stats: ScraperStats;
}

interface Pipeline {
  run(config: PipelineConfig, browser: BrowserContext): Promise<PipelineResult>;
}
```

## Tasks

### Phase 1: Extract shared utilities (no behavior change)
- [ ] Extract `browser.ts` — browser launch, context setup, stealth, randomDelay
- [ ] Extract `search-page.ts` — `scrapeSearchPage()` as standalone function
- [ ] Extract `video-page.ts` — `scrapeTikTokVideo()` + helpers as standalone functions
- [ ] Keep `GoogleTikTokScraper` working as-is by importing extracted functions

### Phase 2: Extract discovery modules
- [ ] Extract `google-serp.ts` — `searchGoogle()` + `parseSerpLinkText()` + helpers
- [ ] Create `tag-generator.ts` — query→tag translation (AI + heuristic)
- [ ] Create `discover-url.ts` — kebab slug generation + redirect detection

### Phase 3: Build pipelines
- [ ] Create pipeline types/interfaces
- [ ] Build `google-pipeline.ts` — reimplements current `scrape()` using extracted modules
- [ ] Build `tag-pipeline.ts` — tag generation → scrapeSearchPage → scrapeTikTokVideo
- [ ] Build `hybrid-pipeline.ts` — merges Google + tag results, dedup, then video extraction
- [ ] Verify all pipelines produce same output format

### Phase 4: Wire up CLI/TUI
- [ ] Add `--mode` flag to CLI
- [ ] Add mode selection to TUI
- [ ] Update `index.ts` public API
- [ ] Verify `--mode google` produces identical results to current behavior

### Phase 5: Verify + document
- [ ] Run integration tests for each mode
- [ ] Live test tag pipeline against real TikTok
- [ ] Update AGENTS.md, README.md, design docs
- [ ] Write ADR for pipeline architecture

## Constraints

- **No behavior change in Phase 1** — existing Google flow must produce identical results after extraction
- **Each pipeline mode is independently runnable** — no mode should depend on another
- **Shared browser lifecycle** — one browser per run, all pipelines share it
- **`scrapeSearchPage()` must handle tag pages** — verify selectors work on `/tag/` URLs (untested)
- **Existing tests must pass** after each phase

## Open Questions

- Should tag generation be AI-only or also include heuristic fallback?
- How many tags per query should we generate?
- Should hybrid mode run Google and tags in parallel or sequentially?
- Should we cache tag generation results (same query → same tags)?
