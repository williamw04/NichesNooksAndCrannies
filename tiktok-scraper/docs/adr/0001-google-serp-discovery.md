# ADR-0001: Google SERP as TikTok Discovery Layer

## Context

The scraper needs to discover TikTok videos matching location-related queries. TikTok's own search requires authentication and has aggressive bot detection.

## Decision

Use Google SERP as the primary discovery mechanism. Search Google for `{query} tiktok`, parse the results page for TikTok URLs, then scrape those URLs directly. Fall back to TikTok discover/tag pages if Google doesn't return enough video URLs.

## Why

[NEEDS HUMAN INPUT]

Observable benefits:
- No TikTok authentication required for discovery
- Google's SERP provides view counts and creator names for free
- Avoids TikTok's login wall on search pages
- Discover/tag pages are more accessible than TikTok search for unauthenticated sessions
