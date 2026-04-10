# Processor

## Purpose

Transforms raw scraped videos into deduplicated, aggregated locations with social proof scores. Combines POI tag extraction (from TikTok location tags) with AI-powered location extraction, then deduplicates and aggregates engagement metrics.

## Key Methods

- `processResults(results, config)`: Main pipeline — extracts locations from all videos, deduplicates, aggregates, and filters by engagement (`processor.ts:124`)
- `buildSocialProof(video)`: Converts video engagement metrics into a `SocialProof` object (`processor.ts:28`)
- `inferCategoryFromQuery(query, keywords)`: Maps search query text to a category using keyword matching (`processor.ts:45`)

## How It Works

1. **Two extraction paths per video**:
   - **POI tag**: If a video has a TikTok location tag (`data-e2e="poi-tag"`), it's extracted directly as a location
   - **AI extraction**: If AI is configured and the video has description or subtitles, the AI extractor is called to find named locations in the text
2. **Deduplication**: Location names are normalized (lowercased, stripped of non-alphanumeric chars) and grouped. The highest-engagement instance is kept as the canonical entry
3. **Aggregation**: Social proof (likes, comments, shares, collects, play count) is summed across all duplicate entries
4. **Filtering**: Locations below `minEngagement` threshold are removed
5. **Sorting**: Results are sorted by total engagement (descending)

## Weird Details

- **Category from query, not video**: Category is inferred from the search query that found the video, not from the video's content. A video found via "best coffee spots nyc" gets category `cafe` regardless of its actual content (`processor.ts:131`)
- **AI gets the video's raw category**: When AI extracts locations, `loc.type` from the AI response overrides the query-inferred category. For POI tag extractions, the query category is always used (`processor.ts:173`)
- **500ms delay between AI calls**: A fixed 500ms sleep between AI extraction calls to avoid rate limiting (`processor.ts:194`)
- **Location name cleaning**: POI tag names are stripped of `·` and everything after it (TikTok sometimes appends extra data after a middle dot) (`processor.ts:61-65`)

## Source

- Main file: `src/processor.ts`
- AI extractor: `src/ai-extractor.ts`
- Types: `src/types.ts`
