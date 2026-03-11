# Reddit Scraping: Crawlee Implementation Spec

**Version**: 1.0.0
**Last Updated**: 2026-03-10
**Status**: Fallback Option

## Overview

Crawlee is Apify's open-source web scraping library for Python. It provides browser automation with built-in anti-blocking features, making it suitable for scraping JavaScript-heavy sites like Reddit.

**Recommendation**: Use only if `.json` endpoint is blocked AND Apify service is not an option. Requires residential proxies for reliable Reddit scraping.

---

## What is Crawlee?

- Open-source web scraping framework by Apify
- Available for Python and JavaScript
- Multiple crawler types: `PlaywrightCrawler`, `BeautifulSoupCrawler`, `ParselCrawler`
- Built-in: auto-scaling, proxy rotation, session management, request queuing
- MIT licensed (free)

---

## Installation

```bash
# Core installation
pip install crawlee

# With Playwright for JS-rendered sites (Reddit)
pip install 'crawlee[all]'
playwright install
```

---

## Architecture

```
Crawlee Pipeline
├── PlaywrightCrawler (browser automation)
│   ├── Proxy Configuration
│   ├── Session Pool
│   └── Request Queue
├── Router/Handlers
│   ├── Subreddit List Handler
│   ├── Search Results Handler
│   └── Post Details Handler
└── Dataset Export
    └── JSON/CSV output
```

---

## Implementation

### Basic Setup

```python
import asyncio
from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
from crawlee.proxy_configuration import ProxyConfiguration

class RedditCrawleeScraper:
    def __init__(self, use_proxies: bool = False, proxy_urls: list[str] = None):
        self.use_proxies = use_proxies
        self.proxy_urls = proxy_urls or []
        self.results = []
    
    async def scrape_subreddit_search(
        self, 
        subreddit: str, 
        query: str, 
        max_items: int = 50
    ) -> list[dict]:
        """Scrape Reddit search results using Crawlee."""
        
        # Configure proxy if available
        proxy_config = None
        if self.use_proxies and self.proxy_urls:
            proxy_config = ProxyConfiguration(proxy_urls=self.proxy_urls)
        
        # Create crawler
        crawler = PlaywrightCrawler(
            max_requests_per_crawl=100,
            headless=True,
            proxy_configuration=proxy_config,
            use_session_pool=True,
            request_handler_timeout=timedelta(seconds=60),
        )
        
        @crawler.router.default_handler
        async def handler(context: PlaywrightCrawlingContext):
            page = context.page
            
            # Wait for posts to load
            await page.wait_for_selector('shreddit-post', timeout=10000)
            
            # Scroll to load more posts
            for _ in range(3):
                await page.evaluate('window.scrollBy(0, 1000)')
                await asyncio.sleep(1)
            
            # Extract posts
            posts = await page.query_selector_all('shreddit-post')
            
            for post in posts[:max_items]:
                try:
                    title_el = await post.query('[slot="title"]')
                    title = await title_el.inner_text() if title_el else ""
                    
                    score_el = await post.query('shreddit-post-action-button[upvote] ~ span')
                    score = await score_el.inner_text() if score_el else "0"
                    
                    link_el = await post.query('a[slot="title"]')
                    post_url = await link_el.get_attribute('href') if link_el else ""
                    
                    author_el = await post.query('a[href*="/user/"]')
                    author = await author_el.inner_text() if author_el else ""
                    
                    self.results.append({
                        'title': title.strip(),
                        'score': int(score.replace('k', '000').replace('.', '')) if score else 0,
                        'url': f"https://reddit.com{post_url}" if post_url.startswith('/') else post_url,
                        'author': author.strip(),
                        'subreddit': subreddit,
                        'query': query,
                    })
                except Exception as e:
                    print(f"Error extracting post: {e}")
        
        # Build search URL
        search_url = f"https://www.reddit.com/r/{subreddit}/search/?q={query}&restrict_sr=1&sort=relevance"
        
        # Run crawler
        await crawler.run([search_url])
        
        return self.results[:max_items]


# Usage
async def main():
    scraper = RedditCrawleeScraper(
        use_proxies=True,
        proxy_urls=['http://proxy1:8080', 'http://proxy2:8080']
    )
    
    results = await scraper.scrape_subreddit_search(
        subreddit='nyc',
        query='hidden gem',
        max_items=25
    )
    
    for r in results:
        print(f"{r['title']} - {r['score']} upvotes")

if __name__ == '__main__':
    asyncio.run(main())
```

---

### With Camoufox (Stealth Mode)

Camoufox is a Firefox-based browser designed to avoid detection.

```python
from crawlee.crawlers import PlaywrightCrawler
from crawlee.fingerprint_suite import FingerprintGenerator

async def scrape_stealth():
    crawler = PlaywrightCrawler(
        headless=True,
        browser_type='firefox',  # Use Firefox
        fingerprint_generator=FingerprintGenerator(
            browsers=['firefox'],
            operating_systems=['windows', 'macos'],
        ),
        use_session_pool=True,
    )
    
    # ... rest of handler
```

---

## Configuration Options

```python
crawler = PlaywrightCrawler(
    # Request limits
    max_requests_per_crawl=100,
    max_concurrency=5,
    
    # Browser
    headless=True,
    browser_type='chromium',  # or 'firefox', 'webkit'
    
    # Anti-blocking
    proxy_configuration=proxy_config,
    use_session_pool=True,
    session_pool_max_size=100,
    
    # Timeouts
    request_handler_timeout=timedelta(seconds=60),
    navigation_timeout=timedelta(seconds=30),
    
    # Retry
    max_request_retries=3,
    retry_on_blocked=True,
    
    # Output
    persist_state=True,  # Can pause/resume
)
```

---

## Proxy Configuration

### With Residential Proxies (Recommended)

```python
from crawlee.proxy_configuration import ProxyConfiguration

# Using proxy list
proxy_config = ProxyConfiguration(
    proxy_urls=[
        'http://user:pass@proxy1.example.com:8080',
        'http://user:pass@proxy2.example.com:8080',
    ]
)

# Using proxy tier (Apify)
proxy_config = ProxyConfiguration(
    tier='residential',  # or 'datacenter', 'google SERPs'
)

crawler = PlaywrightCrawler(proxy_configuration=proxy_config)
```

### Proxy Costs

| Provider | Type | Cost |
|----------|------|------|
| Bright Data | Residential | $10-15/GB |
| Oxylabs | Residential | $8-12/GB |
| IPRoyal | Residential | $1.75/GB |
| SmartProxy | Residential | $8-12/GB |

**Estimate for 50 locations**: ~$2-5/month

---

## Rate Limiting Strategy

```python
import asyncio
from datetime import timedelta

class RateLimitedCrawler:
    def __init__(self, requests_per_minute: int = 30):
        self.min_delay = 60 / requests_per_minute
        self.last_request = 0
    
    async def wait_for_rate_limit(self):
        now = asyncio.get_event_loop().time()
        elapsed = now - self.last_request
        
        if elapsed < self.min_delay:
            await asyncio.sleep(self.min_delay - elapsed)
        
        self.last_request = asyncio.get_event_loop().time()

# Use in handler
@crawler.router.default_handler
async def handler(context):
    await rate_limiter.wait_for_rate_limit()
    # ... scraping logic
```

---

## Data Extraction

### Post Data Structure

```python
post_data = {
    'id': str,
    'title': str,
    'selftext': str,
    'score': int,
    'upvote_ratio': float,
    'num_comments': int,
    'author': str,
    'created_utc': int,
    'url': str,
    'permalink': str,
    'subreddit': str,
    'link_flair_text': str,
    'is_self': bool,
    'media': dict,
}
```

### Extraction Selectors

| Data | Selector |
|------|----------|
| Post container | `shreddit-post` |
| Title | `[slot="title"]` |
| Score | `shreddit-post-action-button[upvote] ~ span` |
| Author | `a[href*="/user/"]` |
| Comments link | `a[href*="/comments/"]` |
| Post body | `div[slot="text-body"]` |
| Thumbnail | `img[slot="thumbnail"]` |

---

## Error Handling

```python
from crawlee.errors import SessionError, ProxyError

@crawler.router.default_handler
async def handler(context):
    try:
        # Check if blocked
        if await context.page.query_selector('iframe[src*="challenge"]'):
            raise SessionError('Cloudflare challenge detected')
        
        # Check for rate limit
        if context.response.status == 429:
            raise ProxyError('Rate limited')
        
        # ... scraping logic
        
    except SessionError as e:
        # Rotate session/proxy
        context.session.retire()
        raise
    
    except Exception as e:
        await context.push_data({
            'error': str(e),
            'url': context.request.url,
        })
```

---

## Export Data

```python
from crawlee.storages import Dataset

async def export_results(crawler):
    dataset = await Dataset.open()
    
    # Export to JSON
    await dataset.export_data('reddit_results.json')
    
    # Export to CSV
    await dataset.export_data('reddit_results.csv', format='csv')
    
    # Get as list
    items = await dataset.get_data()
    return items.items
```

---

## Deployment

### Local

```bash
python reddit_crawlee_scraper.py
```

### Docker

```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app
COPY . .
RUN pip install crawlee

CMD ["python", "reddit_crawlee_scraper.py"]
```

### Apify Platform

```python
# apify_actor.py
from apify import Actor
from crawlee.crawlers import PlaywrightCrawler

async def main():
    async with Actor:
        actor_input = await Actor.get_input()
        
        crawler = PlaywrightCrawler()
        # ... setup crawler
        
        await crawler.run([actor_input['start_url']])
        await Actor.push_data(crawler.results)

if __name__ == '__main__':
    Actor.main(main)
```

---

## Pros and Cons

### Pros
- ✅ Open source (MIT license)
- ✅ Built-in anti-blocking features
- ✅ Auto-scaling and retries
- ✅ Session/proxy management
- ✅ Pause/resume crawling
- ✅ Can deploy to Apify platform

### Cons
- ❌ Requires residential proxies for Reddit ($10-30/mo)
- ❌ Complex setup vs `.json` endpoint
- ❌ Reddit DOM changes break selectors
- ❌ Heavier than HTTP-only scraping
- ❌ Higher maintenance

---

## When to Use

| Scenario | Recommendation |
|----------|----------------|
| `.json` endpoint works | ❌ Don't use Crawlee |
| `.json` blocked, Apify available | ❌ Use Apify service instead |
| `.json` blocked, Apify blocked | ✅ Use Crawlee with proxies |
| Need full browser control | ✅ Use Crawlee |
| Building reusable scraper | ✅ Use Crawlee |

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Crawlee (software) | Free |
| Residential proxies | $10-30/month |
| Server/compute | $5-20/month |
| Development time | 10-20 hours |
| **Monthly operating** | **$15-50** |

---

## File Structure

```
src/approaches/web_scraper/scrapers/
├── reddit_crawlee.py          # Main implementation
├── reddit_crawlee_config.py   # Configuration
└── reddit_crawlee_selectors.py # CSS selectors
```

---

## Implementation Checklist

- [ ] Install Crawlee and Playwright
- [ ] Set up proxy configuration
- [ ] Implement subreddit search handler
- [ ] Implement post extraction logic
- [ ] Add rate limiting
- [ ] Add error handling
- [ ] Test with single subreddit
- [ ] Test with multiple queries
- [ ] Export to shared Location format
- [ ] Add logging with shared logger

---

## References

- Crawlee Python Docs: https://crawlee.dev/python/
- Playwright Docs: https://playwright.dev/python/
- Proxy Providers: Bright Data, Oxylabs, IPRoyal
- Apify Platform: https://apify.com