# ADR-0005: View Count 2000-2100 Rejection

## Context

The Google SERP parser extracts view counts from link text and `<cite>` elements. Sometimes the year "2025" appears in a position where a view count is expected.

## Decision

Reject any parsed number in the range 2000–2100 as a view count. This range is treated as a year filter artifact, not a legitimate view count.

## Why

[NEEDS HUMAN INPUT]

Observable facts:
- Google SERP sometimes appends "2025" (the current year) as a date filter indicator
- The number appears in the same DOM position as view counts
- No TikTok video has exactly 2000–2100 views in practice (extremely unlikely)
- The same check is applied in both `parseSerpLinkText` and the global view count fallback
