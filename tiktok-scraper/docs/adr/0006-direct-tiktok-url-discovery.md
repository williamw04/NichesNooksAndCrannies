# ADR-0006: Direct TikTok URL Discovery (Tags + Discover)

## Status: Accepted (partially — tags viable, discover limited)

## Context

The current pipeline relies on Google SERP as the sole discovery mechanism (`searchGoogle()`). This has two problems:

1. **Google captcha** — first query often returns 0 results, requiring a 15s manual pause
2. **Single point of failure** — if Google blocks us, the entire pipeline stops

We investigated whether we could bypass Google by generating TikTok URLs directly from user queries.

## Research

Tested 30 URLs (5 queries × 6 patterns) with results saved to `output/discover-url-patterns.json`.

### Pattern Results

| Pattern | Success Rate | Containers/Page | Notes |
|---------|-------------|-----------------|-------|
| `/tag/{tag}` | **100%** (5/5) | 58-60 | Concatenated lowercase, e.g. `coffeeshopsnyc` |
| `/discover/{kebab}` | 80% (4/5) | 15-16 | Curated whitelist — unknown slugs redirect to `/` |
| `/discover/{kebab}-in-{city}` | 40% (2/5) | 15-16 | Fails when query already contains city |
| `/discover/{city}-{kebab}` | 40% (2/5) | 15-16 | Same city-doubling problem |
| `/search?q={raw}` | **0%** (0/5) | 0 | Dead — requires authentication, returns empty skeleton |
| `/search?q={raw}+{city}` | **0%** (0/5) | 0 | Dead — same auth wall |

### Key Findings

- **Tag pages are reliable and rich**: 100% success, ~60 containers per page, never redirect. But tags return videos *with that hashtag*, not *query-matched* videos. `#coffeeshops` is global, not location-specific.
- **Discover pages are a curated whitelist**: TikTok has a fixed set of discover pages. Unknown slugs redirect to homepage. Cannot reliably generate discover URLs from arbitrary queries.
- **Search pages require authentication**: `/search?q=...` returns an empty skeleton (9 nav links) for unauthenticated sessions. Completely unusable.
- **Tag quality concern**: A raw query like "best coffee shops in NYC" cannot be naively converted to a tag. There must be a translation step (query → relevant hashtags).

## Decision

1. **Google SERP stays** — it discovers discover pages, tag pages, and direct video URLs that we cannot generate ourselves. It remains the primary discovery mechanism for discover pages and direct video links.
2. **Tag pages as supplementary discovery** — add a tag-based discovery path that can run independently of Google. This requires a "query → hashtags" translation step (AI-generated or heuristic).
3. **Pipeline must become modular** — the current monolithic `scrape()` method hardcodes the Google-first flow. Refactor into composable stages (discovery → listing → extraction) so different modes can be plugged in.

### The Missing Link: Query → Tags

Tags work but `#bestcoffeeshopsnyc` ≠ "best coffee shops in NYC". Options:

- **AI tag generation**: Feed query to OpenRouter, ask for 5-10 relevant TikTok hashtags. Cheap, flexible, already have the API wired.
- **Heuristic generation**: Strip stop words, concatenate. Simpler but misses popular tag variants (e.g., `nyccafe` vs `nyc cafe`).
- **Hybrid**: Generate heuristically + validate by checking if `/tag/{tag}` returns containers before committing.

## Consequences

- Pipeline becomes multi-source: Google SERP + AI-generated tags + discover pages
- New dependency: AI tag generation requires OpenRouter (already integrated for location extraction)
- More complex pipeline orchestration, but more resilient (no single point of failure)
- Tag pages return ~4x more containers than discover pages — higher throughput per page load

## See Also

- Test results: `output/discover-url-patterns.json`
- Debug script: `test/debug-discover-urls.ts`
- Existing ADR-0001 (Google SERP discovery)
