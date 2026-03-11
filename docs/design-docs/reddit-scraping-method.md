# Design Decision: Reddit Scraping Method

**Date**: 2026-03-10
**Status**: Decided
**Decision Makers**: Team

## Problem Statement

We need to scrape Reddit for NYC hidden gem recommendations. The official Reddit API (PRAW) requires `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` which are not accessible due to Reddit's API restrictions introduced in 2023.

We researched 6 alternatives:
1. Reddit `.json` endpoint
2. Apify Reddit scrapers
3. Scrapling framework
4. Crawlee framework
5. Pydoll browser automation
6. old.reddit.com scraping

## Decision

**Primary Method**: Reddit `.json` endpoint
**Backup Method**: Apify Reddit scrapers

## Alternatives Considered

### 1. Reddit `.json` Endpoint ⭐ CHOSEN

**How it works**: Add `.json` to any Reddit URL to receive structured JSON data without authentication.

**Example**:
```
https://www.reddit.com/r/nyc/hot.json
https://www.reddit.com/r/nyc/search.json?q=hidden+gem&restrict_sr=1
```

**Pros**:
- No authentication required
- Simple HTTP requests (no browser overhead)
- Full post data: title, selftext, score, num_comments, permalink
- Search and pagination work
- Rate limit headers included (`x-ratelimit-remaining`)

**Cons**:
- Rate limited to ~600 requests/hour
- No OAuth-only features (not needed for our use case)
- Could break if Reddit changes API

**Cost**: Free

**Why chosen**: Simplest solution that works today. No external dependencies, no authentication, covers all our needs.

---

### 2. Apify Reddit Scrapers ⭐ BACKUP

**How it works**: Pre-built scrapers on Apify platform with built-in proxy rotation.

**Actor**: `macrocosmos/reddit-scraper` ($0.50/1,000 results)

**Pros**:
- Zero setup - works immediately
- Built-in residential proxy rotation
- Handles anti-bot measures
- Free tier covers ~1,000 results
- Structured JSON output
- Actively maintained

**Cons**:
- Ongoing cost for scale
- External dependency
- Reddit could block Apify IPs

**Cost**: 
- Free tier: $5/month credit
- Paid: $0.50 per 1,000 results

**Why backup**: If `.json` endpoint fails or gets blocked, Apify provides a reliable fallback with no development effort.

---

### 3. Scrapling Framework

**How it works**: Python framework with built-in Cloudflare bypass and JS rendering.

**Installation**: `pip install "scrapling[fetchers]"`

**Pros**:
- Bypasses Cloudflare/anti-bot
- Scrapy-like API familiar to developers
- Built-in proxy rotation
- Handles JS-rendered content
- Open source (free)

**Cons**:
- Heavier than HTTP requests (~300MB browser download)
- Slower than direct HTTP
- More complex than `.json` endpoint
- Still subject to Reddit ToS

**Cost**: Free (open source)

**Why not chosen**: More complex than needed. The `.json` endpoint works without anti-bot bypass.

---

### 4. Crawlee Framework

**How it works**: Apify's open-source crawling framework with Playwright integration.

**Pros**:
- Open source (free)
- Auto-scaling
- Browser fingerprint rotation
- Session management
- Pause/resume crawls

**Cons**:
- Requires residential proxies ($10-30/month)
- Complex setup
- Reddit DOM selectors break with UI changes
- Slower than HTTP-only scraping

**Cost**: Free (need proxies ~$10-30/mo)

**Why not chosen**: Requires proxies and more maintenance than `.json` endpoint.

---

### 5. Pydoll

**How it works**: Browser automation via Chrome DevTools Protocol without webdriver flag.

**Pros**:
- Stealthy (no `navigator.webdriver` flag)
- Cloudflare bypass built-in
- Human-like mouse movement

**Cons**:
- Heavy (full browser instance)
- No built-in rate limiting
- Must handle pagination manually
- Overkill for Reddit

**Cost**: Free (open source)

**Why not chosen**: Over-engineered for this use case. Browser automation not needed when `.json` works.

---

### 6. old.reddit.com Scraping

**How it works**: Scrape the legacy Reddit interface with simpler HTML.

**Pros**:
- Simpler HTML than new Reddit
- Works with BeautifulSoup
- No authentication needed

**Cons**:
- Still has anti-bot measures
- No search API
- Requires session management
- Rate limiting still applies

**Cost**: Free

**Why not chosen**: `.json` endpoint provides structured data without HTML parsing.

---

## Decision Matrix

| Method | Setup Time | Cost | Reliability | Maintenance | Score |
|--------|------------|------|-------------|-------------|-------|
| `.json` endpoint | 5 min | Free | High | Low | ⭐⭐⭐⭐⭐ |
| Apify | 10 min | $5/mo free | Very High | None | ⭐⭐⭐⭐ |
| Scrapling | 30 min | Free | Medium | Medium | ⭐⭐⭐ |
| Crawlee | 1-2 hr | Proxies | Medium | High | ⭐⭐ |
| Pydoll | 1 hr | Free | Medium | High | ⭐⭐ |
| old.reddit.com | 30 min | Free | Low | Medium | ⭐ |

---

## Implementation Plan

### Phase 1: Primary Implementation (`.json` endpoint)
1. Create `src/approaches/web_scraper/scrapers/reddit_json.py`
2. Implement search functionality for hidden gems
3. Handle rate limiting with headers
4. Parse and return structured data

### Phase 2: Fallback (Apify)
1. Create `src/approaches/web_scraper/scrapers/reddit_apify.py`
2. Integrate with `macrocosmos/reddit-scraper` actor
3. Use when `.json` endpoint fails

---

## Rate Limiting Strategy

**`.json` endpoint limits**:
- ~600 requests/hour
- Check `x-ratelimit-remaining` header
- Implement exponential backoff on 429

**Implementation**:
```python
import time
import requests

def fetch_with_rate_limit(url, headers):
    response = requests.get(url, headers=headers)
    
    remaining = int(response.headers.get('x-ratelimit-remaining', 600))
    reset_time = int(response.headers.get('x-ratelimit-reset', 600))
    
    if response.status_code == 429:
        time.sleep(reset_time)
        return fetch_with_rate_limit(url, headers)
    
    if remaining < 10:
        time.sleep(reset_time)
    
    return response
```

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `.json` endpoint blocked | Low | High | Fallback to Apify |
| Rate limit exceeded | Medium | Low | Implement backoff |
| Reddit changes API | Medium | Medium | Update parser |
| IP blocked | Low | Medium | Use Apify with proxies |

---

## Conclusion

The `.json` endpoint is the best choice for our needs:
- No authentication required
- Simple HTTP requests
- Covers all data needs
- Free
- Reliable for 50 locations

Apify serves as a reliable backup if the `.json` endpoint fails.

---

## References

- Reddit JSON API documentation: https://www.reddit.com/dev/api
- Apify Reddit Scraper: https://apify.com/macrocosmos/reddit-scraper
- Scrapling: https://github.com/D4Vinci/Scrapling
- Crawlee: https://crawlee.dev/python/