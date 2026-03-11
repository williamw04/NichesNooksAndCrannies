# References Index

**Last Updated**: 2026-03-10

Quick reference guides for common tasks and technologies.

## Reddit Scraping Methods

| Method | Document | Use When | Cost | Setup |
|--------|----------|----------|------|-------|
| **`.json` endpoint** | [Quick Reference](./reddit-scraping-quick-reference.md) | Primary choice | Free | 5 min |
| **Apify** | [Quick Reference](./reddit-scraping-quick-reference.md) | `.json` blocked | $0.50/1K | 10 min |
| **Scrapling** | [Quick Reference](./reddit-scraping-quick-reference.md) | Anti-bot needed | Free | 30 min |
| **Crawlee** | [Full Spec](./reddit-crawlee-spec.md) | Full browser control | Proxies | 1-2 hr |
| **Pydoll** | [Full Spec](./reddit-pydoll-spec.md) | Stealth automation | Free | 1 hr |
| **old.reddit.com** | [Full Spec](./reddit-old-reddit-spec.md) | HTML parsing | Free | 30 min |

## Available References

| Reference | Description |
|-----------|-------------|
| [Reddit Scraping Quick Reference](./reddit-scraping-quick-reference.md) | Primary methods (`.json`, Apify, Scrapling) |
| [Reddit Crawlee Spec](./reddit-crawlee-spec.md) | Full implementation for Crawlee framework |
| [Reddit Pydoll Spec](./reddit-pydoll-spec.md) | Full implementation for Pydoll browser automation |
| [Reddit old.reddit.com Spec](./reddit-old-reddit-spec.md) | Full implementation for legacy Reddit interface |

## Adding New References

Create reference docs in this directory for:
- Technology-specific guides
- API usage patterns
- Code snippets for common tasks
- Configuration references

Format reference docs for LLM consumption:
- Start with a summary
- Include code examples
- Use tables for comparisons
- Keep under 200 lines