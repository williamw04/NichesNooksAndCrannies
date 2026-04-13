# TikTok Location Scraper

Scrapes TikTok videos via Google SERP to discover and extract named locations with social proof scoring.

## Capabilities

- Google SERP → TikTok video URLs + discover page URLs
- TikTok discover/tag page scraping (video containers with view counts + creator names)
- Individual video page scraping (engagement, location tags, VTT captions)
- AI location extraction (OpenRouter free models with fallback chain)
- Deduplication + social proof aggregation

## File Map

### Source (`src/`)

| File | Purpose |
|------|---------|
| `src/google-scraper.ts` | Core scraper: Google SERP discovery, discover pages, video pages |
| `src/ai-extractor.ts` | AI location extraction via OpenRouter with 4-model fallback |
| `src/processor.ts` | Location extraction pipeline: POI tags + AI, dedup, aggregation |
| `src/types.ts` | All TypeScript interfaces, defaults, category keywords |
| `src/index.ts` | Library entry: `runScraper()`, `saveResults()`, re-exports |
| `src/cli.ts` | CLI entry: full pipeline with `--input` JSON config |
| `src/tui.ts` | Interactive TUI: menu-driven config and execution |

### Tests & Debug (`test/`)

| File | Purpose |
|------|---------|
| `test/test-scrape.ts` | Integration test suite against live Google/TikTok (3 stages) |
| `test/debug-google.ts` | Google SERP link extraction inspector |
| `test/debug-search.ts` | TikTok discover/search page inspector |
| `test/debug-video.ts` | Individual video page DOM inspector |
| `test/debug-subtitles.ts` | VTT caption capture debugger |
| `test/debug-captions.ts` | Caption DOM container poller |
| `test/debug-discover-structure.ts` | Discover page CSS selector + embedded JSON analysis |
| `test/debug.ts` | General TikTok search page debug (uses stealth plugin) |

### Config & Docs

| File | Purpose |
|------|---------|
| `example-input.json` | Sample input with 10 generic queries |
| `docs/build-and-run.md` | Build, run, test, and config reference |
| `docs/*/design.md` | Per-component design docs |

## Critical Constraints

- **`headless: false` required** — Google captcha and TikTok bot detection require a visible browser
- **`__NEXT_DATA__` is blocked** — TikTok blocks embedded Next.js data for unauthenticated sessions. Hardcoded to `null` at `google-scraper.ts:524`. All data comes from DOM selectors and meta tags instead
- **No playCount element on video pages** — TikTok individual video pages do NOT display a view count in the DOM. `playCount` is sourced from discover pages or SERP `<cite>` elements via `serpData.viewCount`
- **View counts 2000–2100 rejected** — Google's "2025" year filter false positive. See `google-scraper.ts:185-186,200-201`
- **`SpanLikes` is misnamed** — TikTok reuses this CSS class for view/play count on discover pages (not likes). See `google-scraper.ts:426-427`
- **VTT captions served as `video/mp4`** — TikTok CDN sends VTT files with wrong content-type. Identified by `content-length < 2000` + body starts with `WEBVTT`. ~50% capture rate. See `google-scraper.ts:488-493`
- **Google captcha** — If no TikTok links found on SERP, scraper pauses 15s for manual captcha solve. See `google-scraper.ts:307-311`
- **Date-as-creator guard** — `parseSerpLinkText` skips date patterns ("6 months ago", "Jan 1") to avoid treating them as creator names. See `google-scraper.ts:168,191`

## Entry Points

- `npm start` / `npm run tui` — Interactive TUI
- `npm run scrape -- --input file.json` — CLI pipeline
- `npm run scrape:example` — CLI with example-input.json
- `npm test` — Run integration test suite
- `import { runScraper, processResults } from './index.js'` — Library

## Feature Workflow

Every feature follows this cycle. Use the todo tool to track progress and always know which phase you're in.

### 1. Define

Before writing any code:
- Write or update the feature spec in `docs/` (what it does, why, edge cases)
- Write or update the design doc for the affected component
- Present specs to the user for approval before proceeding

### 2. Plan

Once specs are approved:
- Create a todo list with the todo tool, breaking the feature into concrete tasks
- Each todo should be a single actionable item (one file change, one test, one doc update)
- Prioritize tasks — core logic first, then tests, then docs

### 3. Iterate

Implement tasks one at a time:
- Mark each todo `in_progress` before starting, `completed` immediately after finishing
- Only one todo should be `in_progress` at a time
- Run `npx tsc --noEmit` after every code change to catch type errors early
- If you discover new constraints or gotchas, add them to Critical Constraints above

### 4. Test

- Run `npm test` to verify the integration test suite passes
- Test against real services when possible (Google SERP, TikTok pages) — this scraper has no mocks
- Google captcha may block automated tests — the 15s pause exists for manual solving

### 5. Document

Documentation is not a separate phase — it happens alongside code:
- Update AGENTS.md File Map if you added/removed/moved files
- Update Critical Constraints if you discovered a new platform quirk
- Update design docs if you changed how a component works
- Update README.md if you changed the public API or CLI interface
- **All docs must be updated in the same commit as the code change** — never defer

## Code Documentation Standards

Agents and humans read this code without full context. Code must be self-documenting so readers don't infer incorrectly.

### Comments Are Mandatory For

- **Non-obvious selectors**: Every CSS selector or DOM query must explain what it finds and why it works. TikTok's class names are obfuscated and misleading (e.g., `SpanLikes` is actually views, not likes). Without a comment, the next agent will assume the wrong thing.
- **Platform quirks and workarounds**: If TikTok serves VTT files as `video/mp4`, that's invisible from the code alone. Add a comment explaining the workaround and why it's needed.
- **Guards and rejection logic**: If a number range is rejected (e.g., 2000-2100 for year false positives), explain what causes the false positive and what would happen without the guard.
- **Skipped features**: If `__NEXT_DATA__` is hardcoded to `null`, explain that it's intentionally skipped because TikTok blocks it for unauthenticated sessions. Without this, an agent will "fix" it by re-enabling the extraction.
- **Fallback chains**: When there are multiple fallback sources for a value (e.g., `playCount` from embedded → serpData → metaDescription), document the full chain and why each fallback exists.

### Comments Should Answer

- **Why** this code exists or works this way (not *what* it does — the code says that)
- **What would break** if someone removed or changed this
- **What the platform does** that forces this workaround

### Example

```typescript
// BAD — no context, next agent will think this is wrong
const isVttCandidate = contentType.includes('video/mp4') && contentLength < 2000;

// GOOD — explains the platform quirk and the workaround
// TikTok CDN serves VTT subtitle files with wrong content-type: video/mp4.
// Identify them by small size (<2000 bytes) since real videos are much larger.
const isVttCandidate = contentType.includes('video/mp4') && contentLength > 0 && contentLength < 2000;
```

## Scraping & Debugging: Context Management

Web scraping involves inspecting live pages with complex DOMs. This is the fastest way to overload your context window. Use these strategies:

### Offload DOM Inspection to the User

When you need to know if a selector exists or what a page looks like:
1. Tell the user exactly what page to open (URL)
2. Tell them exactly what to look for (selector, element, text pattern)
3. Ask them to paste the relevant HTML or tell you what they see

Example: "Open `https://www.tiktok.com/@user/video/123` in a browser. Right-click the view count area and inspect element. Paste the surrounding HTML — I need to know if there's a `data-e2e` attribute on it."

### Offload DOM Inspection to a Sub-Agent

When the user can't help, launch a sub-agent with the `explore` type to:
- Open a page and dump specific selectors
- Check if elements exist before you build selectors
- Analyze page structure without polluting your context

The debug scripts in `test/` are designed for this — they dump page structure to files that can be read selectively.

### Never Dump Full Pages Into Your Context

- Don't read entire HTML dumps — use grep/search to find specific patterns
- Don't read more than 100 lines of page structure at a time
- If a debug script outputs a file, read only the section you need with offset/limit

## Conventions

- **`src/index.ts` is the public API** — every function, class, and interface shown in docs or used externally must be re-exported from this file. If you add a new export to a source file, add the re-export to `index.ts` in the same commit
- **No line numbers in docs** — use function/method names instead. Line numbers drift on every code change and make docs stale
- **Debug scripts live in `test/`** — not `src/`. They import from `src/` but are not part of the production code
- **Same-commit doc updates** — if you change code, update all affected docs in the same commit. Never leave docs in a stale state.
- **Test the real pipeline** — this project has no mocks. Tests hit real Google and TikTok pages. Account for captcha and network flakiness.

## See Also

- Build & run details: `docs/build-and-run.md`
- Component design: `docs/google-scraper/design.md`, `docs/ai-extractor/design.md`, `docs/processor/design.md`
- Architecture decisions: `docs/adr/`
