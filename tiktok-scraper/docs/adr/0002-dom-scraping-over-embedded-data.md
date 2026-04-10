# ADR-0002: DOM Scraping over API/Embedded Data

## Context

TikTok video pages are Next.js SSR apps that embed structured data in `<script id="__NEXT_DATA__">`. The scraper needs video metadata (description, engagement, author, location).

## Decision

Scrape metadata from DOM selectors (`data-e2e` attributes, meta tags, OG tags) instead of parsing `__NEXT_DATA__`. The embedded data extraction code exists but is bypassed with `const embedded = null`.

## Why

[NEEDS HUMAN INPUT]

Observable facts:
- TikTok returns `null` for `__NEXT_DATA__` when the session is unauthenticated
- DOM selectors (`data-e2e="like-count"`, `data-e2e="video-desc"`, etc.) are available without authentication
- OG/meta tags always contain basic metadata regardless of auth state
- The `extractEmbeddedData()` method exists in code but is unused
