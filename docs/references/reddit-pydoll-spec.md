# Reddit Scraping: Pydoll Implementation Spec

**Version**: 1.0.0
**Last Updated**: 2026-03-10
**Status**: Fallback Option

## Overview

Pydoll is a Python library for browser automation via Chrome DevTools Protocol (CDP). Unlike Selenium/Playwright, it doesn't set the `navigator.webdriver` flag, making it harder to detect as automation.

**Recommendation**: Use only if `.json` endpoint is blocked, Apify is not an option, and you need stealth browser automation. Overkill for basic Reddit scraping.

---

## What is Pydoll?

- Browser automation via Chrome DevTools Protocol (CDP)
- No WebDriver dependency (no chromedriver/geckodriver)
- Stealth-first design (no `navigator.webdriver` flag)
- Human-like mouse movement and typing
- Built-in Cloudflare/reCAPTCHA bypass
- Async-native (built on asyncio)

---

## Installation

```bash
pip install pydoll-python
```

No external browser driver needed - connects to Chrome/Edge directly via CDP.

---

## Why Pydoll vs Selenium/Playwright?

| Feature | Pydoll | Selenium | Playwright |
|---------|--------|----------|------------|
| `navigator.webdriver` | Not set | Set | Set (can hide) |
| Browser driver | Not needed | Needed | Built-in |
| Cloudflare bypass | Built-in | Manual | Manual |
| Mouse movement | Human-like (Bezier) | Linear | Linear |
| Anti-detection | Built-in | Manual | Manual |
| Setup complexity | Low | Medium | Low |

---

## Architecture

```
Pydoll Pipeline
├── Chrome Browser (CDP connection)
│   ├── Human-like Interactions
│   ├── Network Interception
│   └── Shadow DOM Access
├── Page Handler
│   ├── Navigate to Reddit
│   ├── Wait for Content
│   └── Extract Posts
└── Data Output
    └── List of posts
```

---

## Implementation

### Basic Setup

```python
import asyncio
from pydoll.browser.chromium import Chrome
from pydoll.browser.options import ChromiumOptions
from typing import List, Dict
import time

class RedditPydollScraper:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.results = []
    
    async def scrape_subreddit(
        self, 
        subreddit: str, 
        query: str = None,
        limit: int = 25
    ) -> List[Dict]:
        """Scrape Reddit posts using Pydoll browser automation."""
        
        options = ChromiumOptions()
        if self.headless:
            options.add_argument('--headless=new')
        
        # Anti-detection options
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--disable-infobars')
        options.add_argument('--no-first-run')
        options.add_argument('--no-default-browser-check')
        
        async with Chrome(options=options) as browser:
            tab = await browser.start()
            
            # Build URL
            if query:
                url = f'https://www.reddit.com/r/{subreddit}/search/?q={query}&restrict_sr=1&sort=relevance'
            else:
                url = f'https://www.reddit.com/r/{subreddit}/hot/'
            
            # Navigate with human-like delay
            await tab.go_to(url)
            await asyncio.sleep(2)  # Wait for JS to render
            
            # Handle potential login popup
            try:
                close_btn = await tab.query('button[aria-label="Close"]')
                if close_btn:
                    await close_btn.click()
                    await asyncio.sleep(0.5)
            except:
                pass
            
            # Scroll to load more posts
            for _ in range(3):
                await tab.evaluate('window.scrollBy(0, 1000)')
                await asyncio.sleep(1)
            
            # Extract posts
            posts = await self._extract_posts(tab, limit)
            
            return posts
    
    async def _extract_posts(self, tab, limit: int) -> List[Dict]:
        """Extract post data from Reddit page."""
        posts = []
        
        # Find all post elements
        post_elements = await tab.query_all('shreddit-post')
        
        for post in post_elements[:limit]:
            try:
                data = await self._extract_post_data(post)
                if data:
                    posts.append(data)
            except Exception as e:
                print(f"Error extracting post: {e}")
                continue
        
        return posts
    
    async def _extract_post_data(self, post_element) -> Dict:
        """Extract data from a single post element."""
        
        # Title
        title_el = await post_element.query('a[slot="title"]')
        title = await title_el.text if title_el else ""
        
        # Score (upvotes)
        score_el = await post_element.query('shreddit-post-action-button[upvote]')
        score_text = await score_el.text if score_el else "0"
        score = self._parse_score(score_text)
        
        # Post URL
        link_el = await post_element.query('a[slot="title"]')
        post_path = await link_el.get_attribute('href') if link_el else ""
        post_url = f"https://reddit.com{post_path}" if post_path.startswith('/') else post_path
        
        # Author
        author_el = await post_element.query('a[href*="/user/"]')
        author = await author_el.text if author_el else ""
        
        # Number of comments
        comments_el = await post_element.query('a[href*="/comments/"] span')
        comments_text = await comments_el.text if comments_el else "0"
        num_comments = int(comments_text.replace('k', '000').replace(',', '')) if comments_text else 0
        
        # Post body (if self post)
        body_el = await post_element.query('div[slot="text-body"]')
        body = await body_el.text if body_el else ""
        
        return {
            'title': title.strip(),
            'score': score,
            'url': post_url,
            'author': author.strip(),
            'num_comments': num_comments,
            'selftext': body.strip()[:500],  # Truncate long bodies
        }
    
    def _parse_score(self, score_text: str) -> int:
        """Parse score text like '12.3k' to integer."""
        score_text = score_text.strip().lower()
        
        if not score_text:
            return 0
        
        try:
            if 'k' in score_text:
                return int(float(score_text.replace('k', '')) * 1000)
            elif 'm' in score_text:
                return int(float(score_text.replace('m', '')) * 1000000)
            else:
                return int(score_text.replace(',', ''))
        except:
            return 0


# Usage
async def main():
    scraper = RedditPydollScraper(headless=True)
    
    # Search for hidden gems
    results = await scraper.scrape_subreddit(
        subreddit='nyc',
        query='hidden gem',
        limit=25
    )
    
    print(f"Found {len(results)} posts")
    for r in results:
        print(f"  {r['title'][:50]}... ({r['score']} upvotes)")

if __name__ == '__main__':
    asyncio.run(main())
```

---

### With Cloudflare Bypass

```python
from pydoll.browser.chromium import Chrome
from pydoll.browser.options import ChromiumOptions

async def scrape_with_cloudflare_bypass(url: str):
    options = ChromiumOptions()
    options.add_argument('--headless=new')
    
    async with Chrome(options=options) as browser:
        tab = await browser.start()
        
        # Navigate
        await tab.go_to(url)
        
        # Wait for Cloudflare challenge
        await asyncio.sleep(5)
        
        # Pydoll handles Turnstile automatically
        # But you can also manually solve:
        try:
            challenge = await tab.query('iframe[src*="challenges.cloudflare.com"]')
            if challenge:
                print("Cloudflare challenge detected")
                await asyncio.sleep(10)  # Wait for auto-solve
        except:
            pass
        
        # Continue with scraping
        content = await tab.query_all('shreddit-post')
        return content
```

---

### With Proxy

```python
from pydoll.browser.options import ChromiumOptions

options = ChromiumOptions()
options.add_argument('--headless=new')
options.add_argument('--proxy-server=http://user:pass@proxy.example.com:8080')

async with Chrome(options=options) as browser:
    tab = await browser.start()
    await tab.go_to('https://www.reddit.com/r/nyc/')
```

---

### Human-like Interactions

```python
async def human_like_scroll(tab):
    """Scroll like a human, not a bot."""
    import random
    
    for _ in range(5):
        # Random scroll amount
        scroll_amount = random.randint(500, 1500)
        await tab.evaluate(f'window.scrollBy(0, {scroll_amount})')
        
        # Random delay
        delay = random.uniform(0.5, 2.0)
        await asyncio.sleep(delay)

async def human_like_click(tab, selector):
    """Click with human-like mouse movement."""
    element = await tab.query(selector)
    if element:
        # Pydoll uses Bezier curves for mouse movement
        await element.click()
        await asyncio.sleep(random.uniform(0.3, 0.8))
```

---

## Rate Limiting

```python
import asyncio
from datetime import datetime, timedelta

class RateLimitedPydollScraper(RedditPydollScraper):
    def __init__(self, requests_per_minute: int = 30, **kwargs):
        super().__init__(**kwargs)
        self.min_interval = 60 / requests_per_minute
        self.last_request = None
    
    async def _wait_for_rate_limit(self):
        if self.last_request:
            elapsed = datetime.now() - self.last_request
            remaining = self.min_interval - elapsed.total_seconds()
            if remaining > 0:
                await asyncio.sleep(remaining)
        
        self.last_request = datetime.now()
    
    async def scrape_subreddit(self, *args, **kwargs):
        await self._wait_for_rate_limit()
        return await super().scrape_subreddit(*args, **kwargs)
```

---

## Shadow DOM Support

Pydoll can access shadow DOM elements, useful for Reddit's web components:

```python
async def extract_from_shadow_dom(tab):
    """Access elements inside shadow DOM."""
    
    # Reddit uses shadow DOM for posts
    # Pydoll can pierce through automatically
    
    # Method 1: Direct query (works with shadow piercing)
    posts = await tab.query_all('shreddit-post')
    
    # Method 2: If closed shadow DOM
    for post in posts:
        # Access shadow root
        shadow = await post.shadow_root
        
        # Query within shadow
        title = await shadow.query('a[slot="title"]')
        print(await title.text)
```

---

## Error Handling

```python
async def robust_scrape(scraper, subreddit, query, max_retries=3):
    """Scrape with retries and error handling."""
    
    for attempt in range(max_retries):
        try:
            results = await scraper.scrape_subreddit(subreddit, query)
            return results
            
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            
            if attempt < max_retries - 1:
                # Exponential backoff
                delay = (attempt + 1) * 10
                print(f"Retrying in {delay} seconds...")
                await asyncio.sleep(delay)
            else:
                print("Max retries reached")
                return []

# Usage
results = await robust_scrape(scraper, 'nyc', 'hidden gem')
```

---

## Comparison with Other Methods

| Feature | Pydoll | `.json` endpoint | Apify |
|---------|--------|------------------|-------|
| Setup complexity | Medium | Low | Low |
| Cost | Free | Free | $0.50/1K |
| Speed | Slow (browser) | Fast (HTTP) | Fast |
| Anti-bot | Good | None needed | Excellent |
| Maintenance | Medium | Low | None |
| Stealth | Excellent | N/A | Good |

---

## Pros and Cons

### Pros
- ✅ Stealthy (no webdriver flag)
- ✅ No external driver needed
- ✅ Built-in Cloudflare bypass
- ✅ Human-like interactions
- ✅ Shadow DOM support
- ✅ Network interception
- ✅ Free and open source

### Cons
- ❌ Heavier than HTTP requests (full browser)
- ❌ Slower than `.json` endpoint
- ❌ No built-in rate limiting
- ❌ Must handle pagination manually
- ❌ Overkill for Reddit (works without anti-bot)
- ❌ Browser resource usage (~300MB RAM per instance)

---

## When to Use

| Scenario | Recommendation |
|----------|----------------|
| `.json` endpoint works | ❌ Don't use Pydoll |
| Reddit blocks HTTP requests | ✅ Consider Pydoll |
| Need stealth browser automation | ✅ Use Pydoll |
| Cloudflare challenges | ✅ Use Pydoll |
| Scraping other anti-bot sites | ✅ Use Pydoll |
| Just need Reddit data | ❌ Use `.json` endpoint |

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Pydoll (software) | Free |
| Browser resources | Server cost |
| Proxies (optional) | $10-30/month |
| Development time | 5-10 hours |

---

## File Structure

```
src/approaches/web_scraper/scrapers/
├── reddit_pydoll.py           # Main implementation
└── reddit_pydoll_config.py    # Configuration
```

---

## Implementation Checklist

- [ ] Install pydoll-python
- [ ] Implement subreddit scraper
- [ ] Add post extraction logic
- [ ] Add human-like interactions
- [ ] Add rate limiting
- [ ] Add error handling
- [ ] Add Cloudflare handling (if needed)
- [ ] Test with single subreddit
- [ ] Test with search queries
- [ ] Export to shared Location format
- [ ] Add logging

---

## References

- Pydoll GitHub: https://github.com/pydoll/pydoll
- Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/
- Anti-detection techniques: Various blog posts