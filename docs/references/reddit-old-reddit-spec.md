# Reddit Scraping: old.reddit.com Implementation Spec

**Version**: 1.0.0
**Last Updated**: 2026-03-10
**Status**: Fallback Option

## Overview

`old.reddit.com` is Reddit's legacy interface with simpler, static HTML. It's easier to scrape than the modern React-based interface, but still has rate limiting and anti-bot measures.

**Recommendation**: Use only if `.json` endpoint is blocked. Simpler HTML parsing but still subject to rate limits. Lowest priority fallback.

---

## What is old.reddit.com?

- Legacy Reddit interface (pre-2018 redesign)
- Server-side rendered HTML (no JavaScript required)
- Simpler DOM structure
- No React/shadow DOM complications
- Works with basic BeautifulSoup

---

## Comparison: old.reddit.com vs new Reddit

| Feature | old.reddit.com | new Reddit |
|---------|----------------|------------|
| HTML | Static, simple | Dynamic, React |
| JavaScript | Not required | Required |
| DOM | Simple tables/divs | Shadow DOM |
| Parsing | Easy (BeautifulSoup) | Harder |
| Load time | Faster | Slower |
| Anti-bot | Same | Same |
| Rate limit | Same | Same |

---

## Installation

```bash
pip install requests beautifulsoup4 lxml
```

No browser or driver needed.

---

## Architecture

```
old.reddit.com Pipeline
├── HTTP Request (requests)
│   ├── User-Agent header
│   └── Session management
├── HTML Parser (BeautifulSoup)
│   ├── Parse post listings
│   └── Extract post data
└── Data Output
    └── List of posts
```

---

## Implementation

### Basic Scraper

```python
import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import time
import re

class OldRedditScraper:
    BASE_URL = "https://old.reddit.com"
    
    def __init__(self, user_agent: str = "NYC-Hidden-Gems/1.0"):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': user_agent,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        self.last_request_time = 0
        self.min_request_interval = 2  # 2 seconds between requests
    
    def _rate_limit(self):
        """Implement rate limiting."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - elapsed)
        self.last_request_time = time.time()
    
    def _make_request(self, url: str) -> BeautifulSoup:
        """Make a rate-limited request and return parsed HTML."""
        self._rate_limit()
        
        response = self.session.get(url)
        
        if response.status_code == 429:
            # Rate limited
            retry_after = int(response.headers.get('Retry-After', 60))
            print(f"Rate limited. Waiting {retry_after} seconds...")
            time.sleep(retry_after)
            return self._make_request(url)
        
        if response.status_code != 200:
            raise Exception(f"Request failed: {response.status_code}")
        
        return BeautifulSoup(response.text, 'lxml')
    
    def search_subreddit(
        self, 
        subreddit: str, 
        query: str, 
        limit: int = 25,
        sort: str = 'relevance'
    ) -> List[Dict]:
        """Search within a subreddit."""
        
        # Build search URL
        # old.reddit.com/r/{sub}/search?q={query}&restrict_sr=on&sort={sort}
        params = {
            'q': query,
            'restrict_sr': 'on',
            'sort': sort,
            't': 'all',  # all time
        }
        url = f"{self.BASE_URL}/r/{subreddit}/search"
        
        self._rate_limit()
        response = self.session.get(url, params=params)
        
        if response.status_code != 200:
            print(f"Search failed: {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.text, 'lxml')
        return self._parse_search_results(soup, limit)
    
    def get_subreddit_hot(self, subreddit: str, limit: int = 25) -> List[Dict]:
        """Get hot posts from a subreddit."""
        url = f"{self.BASE_URL}/r/{subreddit}/hot/"
        soup = self._make_request(url)
        return self._parse_listing(soup, limit)
    
    def get_subreddit_top(
        self, 
        subreddit: str, 
        time: str = 'all',
        limit: int = 25
    ) -> List[Dict]:
        """Get top posts from a subreddit."""
        url = f"{self.BASE_URL}/r/{subreddit}/top/?t={time}"
        soup = self._make_request(url)
        return self._parse_listing(soup, limit)
    
    def get_post(self, post_id: str) -> Dict:
        """Get details of a specific post."""
        url = f"{self.BASE_URL}/comments/{post_id}/"
        soup = self._make_request(url)
        return self._parse_post_detail(soup)
    
    def _parse_listing(self, soup: BeautifulSoup, limit: int) -> List[Dict]:
        """Parse a subreddit listing page."""
        posts = []
        
        # Posts are in divs with class "thing"
        post_elements = soup.select('div.thing.link')[:limit]
        
        for post_el in post_elements:
            try:
                post_data = self._extract_post_data(post_el)
                if post_data:
                    posts.append(post_data)
            except Exception as e:
                print(f"Error parsing post: {e}")
                continue
        
        return posts
    
    def _parse_search_results(self, soup: BeautifulSoup, limit: int) -> List[Dict]:
        """Parse search results page."""
        posts = []
        
        # Search results have similar structure to listings
        post_elements = soup.select('div.thing.link')[:limit]
        
        for post_el in post_elements:
            try:
                post_data = self._extract_post_data(post_el)
                if post_data:
                    posts.append(post_data)
            except Exception as e:
                print(f"Error parsing search result: {e}")
                continue
        
        return posts
    
    def _extract_post_data(self, post_el) -> Dict:
        """Extract data from a post element."""
        
        # Post ID
        post_id = post_el.get('data-fullname', '').replace('t3_', '')
        
        # Title and link
        title_el = post_el.select_one('a.title')
        title = title_el.text.strip() if title_el else ""
        post_url = title_el.get('href', '') if title_el else ""
        
        # Score
        score_el = post_el.select_one('div.score.unvoted')
        score_text = score_el.text if score_el else "0"
        score = self._parse_score(score_text)
        
        # Author
        author_el = post_el.select_one('a.author')
        author = author_el.text if author_el else "[deleted]"
        
        # Subreddit
        subreddit_el = post_el.select_one('a.subreddit')
        subreddit = subreddit_el.text.replace('r/', '') if subreddit_el else ""
        
        # Comments count
        comments_el = post_el.select_one('a.comments')
        comments_text = comments_el.text if comments_el else "0"
        num_comments = self._parse_comments_count(comments_text)
        
        # Domain
        domain_el = post_el.select_one('span.domain a')
        domain = domain_el.text if domain_el else ""
        
        # Is self post?
        is_self = 'self' in post_el.get('class', [])
        
        # Thumbnail
        thumb_el = post_el.select_one('img.thumbnail')
        thumbnail = thumb_el.get('src', '') if thumb_el else ""
        
        return {
            'id': post_id,
            'title': title,
            'url': f"https://reddit.com{post_url}" if post_url.startswith('/') else post_url,
            'permalink': f"https://reddit.com/r/{subreddit}/comments/{post_id}/",
            'score': score,
            'author': author,
            'subreddit': subreddit,
            'num_comments': num_comments,
            'domain': domain,
            'is_self': is_self,
            'thumbnail': thumbnail,
        }
    
    def _parse_score(self, score_text: str) -> int:
        """Parse score text like '12.3k' to integer."""
        score_text = score_text.strip().lower().replace('points', '').strip()
        
        if not score_text or score_text == '•':
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
    
    def _parse_comments_count(self, text: str) -> int:
        """Parse comments count text."""
        match = re.search(r'(\d+)', text.replace(',', ''))
        return int(match.group(1)) if match else 0
    
    def _parse_post_detail(self, soup: BeautifulSoup) -> Dict:
        """Parse post detail page (with comments)."""
        post_el = soup.select_one('div.thing.link')
        
        if not post_el:
            return {}
        
        post_data = self._extract_post_data(post_el)
        
        # Extract self text if available
        selftext_el = soup.select_one('div.expando div.usertext-body')
        if selftext_el:
            post_data['selftext'] = selftext_el.text.strip()
        
        return post_data
    
    def get_next_page(self, soup: BeautifulSoup, subreddit: str) -> str:
        """Get URL for next page of results."""
        next_link = soup.select_one('span.next-button a')
        if next_link:
            return next_link.get('href', '')
        return None
    
    def scrape_all_pages(
        self, 
        subreddit: str, 
        max_pages: int = 5,
        limit_per_page: int = 25
    ) -> List[Dict]:
        """Scrape multiple pages of a subreddit."""
        all_posts = []
        url = f"{self.BASE_URL}/r/{subreddit}/hot/"
        
        for page in range(max_pages):
            print(f"Scraping page {page + 1}...")
            
            soup = self._make_request(url)
            posts = self._parse_listing(soup, limit_per_page)
            all_posts.extend(posts)
            
            next_url = self.get_next_page(soup, subreddit)
            if not next_url:
                break
            
            url = next_url
        
        return all_posts


# Usage
def main():
    scraper = OldRedditScraper()
    
    # Search for hidden gems
    print("Searching r/nyc for 'hidden gem'...")
    results = scraper.search_subreddit('nyc', 'hidden gem', limit=25)
    
    print(f"\nFound {len(results)} posts:\n")
    for r in results:
        print(f"  [{r['score']:>5}] {r['title'][:60]}...")
    
    # Get hot posts
    print("\n\nHot posts from r/AskNYC:")
    hot = scraper.get_subreddit_hot('AskNYC', limit=10)
    for r in hot:
        print(f"  [{r['score']:>5}] {r['title'][:60]}...")

if __name__ == '__main__':
    main()
```

---

## HTML Selectors Reference

| Data | Selector |
|------|----------|
| Post container | `div.thing.link` |
| Post ID | `data-fullname` attribute |
| Title | `a.title` |
| Post URL | `a.title[href]` |
| Score | `div.score.unvoted` |
| Author | `a.author` |
| Subreddit | `a.subreddit` |
| Comments count | `a.comments` |
| Domain | `span.domain a` |
| Thumbnail | `img.thumbnail` |
| Self text | `div.usertext-body` |
| Next page | `span.next-button a` |

---

## Rate Limiting Strategy

```python
import time
from functools import wraps

def rate_limit(min_interval: float = 2.0):
    """Rate limit decorator."""
    last_call = [0]
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_call[0]
            if elapsed < min_interval:
                time.sleep(min_interval - elapsed)
            result = func(*args, **kwargs)
            last_call[0] = time.time()
            return result
        return wrapper
    return decorator

class RateLimitedScraper(OldRedditScraper):
    @rate_limit(min_interval=2.0)
    def search_subreddit(self, *args, **kwargs):
        return super().search_subreddit(*args, **kwargs)
    
    @rate_limit(min_interval=2.0)
    def get_subreddit_hot(self, *args, **kwargs):
        return super().get_subreddit_hot(*args, **kwargs)
```

---

## Session Management

```python
class SessionManagedScraper(OldRedditScraper):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.login_cookies = None
    
    def login(self, username: str, password: str) -> bool:
        """Login to Reddit (optional, for authenticated requests)."""
        
        # Get login page
        login_url = f"{self.BASE_URL}/login"
        soup = self._make_request(login_url)
        
        # Find CSRF token
        csrf_input = soup.select_one('input[name="csrf_token"]')
        csrf_token = csrf_input.get('value') if csrf_input else ""
        
        # Submit login
        data = {
            'user': username,
            'passwd': password,
            'csrf_token': csrf_token,
        }
        
        response = self.session.post(
            f"{self.BASE_URL}/post/login",
            data=data
        )
        
        if response.status_code == 200:
            self.login_cookies = self.session.cookies.get_dict()
            return True
        
        return False
    
    def save_session(self, filepath: str):
        """Save session cookies to file."""
        import json
        with open(filepath, 'w') as f:
            json.dump(self.session.cookies.get_dict(), f)
    
    def load_session(self, filepath: str):
        """Load session cookies from file."""
        import json
        with open(filepath) as f:
            cookies = json.load(f)
            self.session.cookies.update(cookies)
```

---

## Error Handling

```python
import time
from requests.exceptions import RequestException

class RobustOldRedditScraper(OldRedditScraper):
    def _make_request(self, url: str, max_retries: int = 3) -> BeautifulSoup:
        """Make request with retries."""
        
        for attempt in range(max_retries):
            try:
                self._rate_limit()
                response = self.session.get(url, timeout=10)
                
                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', 60))
                    print(f"Rate limited. Waiting {retry_after}s...")
                    time.sleep(retry_after)
                    continue
                
                if response.status_code == 503:
                    # Service unavailable
                    print(f"503 error. Waiting 30s...")
                    time.sleep(30)
                    continue
                
                if response.status_code != 200:
                    raise Exception(f"HTTP {response.status_code}")
                
                return BeautifulSoup(response.text, 'lxml')
                
            except RequestException as e:
                print(f"Request error (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(10)
                else:
                    raise
        
        raise Exception("Max retries exceeded")
```

---

## Comparison with `.json` Endpoint

| Feature | old.reddit.com | `.json` endpoint |
|---------|----------------|------------------|
| Data format | HTML (parse needed) | JSON (structured) |
| Setup | BeautifulSoup | requests only |
| Parsing complexity | Medium | Low |
| Speed | Slower (HTML) | Faster (JSON) |
| Rate limit | Same | Same |
| Authentication | Optional | Optional |
| Search support | Yes | Yes |
| Reliability | Lower | Higher |

---

## Pros and Cons

### Pros
- ✅ Simpler HTML than new Reddit
- ✅ Works with BeautifulSoup (no browser)
- ✅ No JavaScript required
- ✅ Lighter than browser automation
- ✅ No authentication needed
- ✅ Free

### Cons
- ❌ Still has rate limits (~600/hr)
- ❌ HTML parsing more complex than JSON
- ❌ Rate limited same as `.json` endpoint
- ❌ Less reliable than `.json` endpoint
- ❌ Could be deprecated by Reddit
- ❌ No advantage over `.json` for data access

---

## When to Use

| Scenario | Recommendation |
|----------|----------------|
| `.json` endpoint works | ❌ Don't use old.reddit.com |
| `.json` blocked | ⚠️ Consider old.reddit.com |
| Need to scrape UI elements | ✅ Use old.reddit.com |
| Want simpler parsing | ⚠️ `.json` is simpler |
| Need to login | ✅ Use old.reddit.com |

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Software | Free |
| Dependencies | Free |
| Proxies (optional) | $10-30/month |
| Development | 2-4 hours |

---

## File Structure

```
src/approaches/web_scraper/scrapers/
├── reddit_old.py              # Main implementation
└── reddit_old_selectors.py    # CSS selectors
```

---

## Implementation Checklist

- [ ] Install requests, beautifulsoup4
- [ ] Implement basic scraper
- [ ] Add rate limiting
- [ ] Add error handling
- [ ] Implement search
- [ ] Implement pagination
- [ ] Test with single subreddit
- [ ] Test with search queries
- [ ] Export to shared Location format
- [ ] Add logging

---

## References

- old.reddit.com: https://old.reddit.com
- BeautifulSoup docs: https://www.crummy.com/software/BeautifulSoup/bs4/doc/
- Reddit API (for comparison): https://www.reddit.com/dev/api