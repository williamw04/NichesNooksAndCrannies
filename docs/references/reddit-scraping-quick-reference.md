# Reddit Scraping - Quick Reference

**Last Updated**: 2026-03-10

## Decision Summary

| Method | Use When | Cost | Setup |
|--------|----------|------|-------|
| **`.json` endpoint** | Default choice | Free | 5 min |
| **Apify** | `.json` blocked or scale needed | $0.50/1K | 10 min |
| **Scrapling** | Anti-bot bypass needed | Free | 30 min |

---

## Option 1: `.json` Endpoint (Primary)

### Setup
```bash
pip install requests
```

### Code
```python
import requests
import time

def search_reddit(subreddit: str, query: str, limit: int = 25) -> list:
    """Search Reddit without authentication."""
    url = f"https://www.reddit.com/r/{subreddit}/search.json"
    params = {"q": query, "restrict_sr": 1, "limit": limit, "sort": "relevance"}
    headers = {"User-Agent": "NYC-Hidden-Gems/1.0"}
    
    response = requests.get(url, params=params, headers=headers)
    
    # Handle rate limiting
    if response.status_code == 429:
        reset = int(response.headers.get("x-ratelimit-reset", 60))
        time.sleep(reset)
        return search_reddit(subreddit, query, limit)
    
    return response.json()["data"]["children"]

# Usage
posts = search_reddit("nyc", "hidden gem")
for post in posts:
    data = post["data"]
    print(f"{data['title']} ({data['score']} upvotes)")
```

### Endpoints
| Purpose | URL |
|---------|-----|
| Hot posts | `/r/{sub}/hot.json` |
| New posts | `/r/{sub}/new.json` |
| Top posts | `/r/{sub}/top.json?t=all` |
| Search | `/r/{sub}/search.json?q={query}&restrict_sr=1` |
| Comments | `/comments/{id}.json` |

### Rate Limits
- ~600 requests/hour
- Check `x-ratelimit-remaining` header
- Wait on 429 status

---

## Option 2: Apify (Backup)

### Setup
```bash
pip install apify-client
```

### Code
```python
from apify_client import ApifyClient

client = ApifyClient("YOUR_API_TOKEN")

run = client.actor("macrocosmos/reddit-scraper").call(run_input={
    "searches": ["hidden gem NYC"],
    "searchPosts": True,
    "maxItems": 100,
    "sort": "relevance"
})

for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item["title"], item["ups"])
```

### Pricing
- Free tier: $5/month credit
- After free: $0.50 per 1,000 results

---

## Option 3: Scrapling (Anti-Bot)

### Setup
```bash
pip install "scrapling[fetchers]"
scrapling install  # Downloads browsers
```

### Code
```python
from scrapling.fetchers import StealthyFetcher

page = StealthyFetcher.fetch(
    'https://www.reddit.com/r/AskNYC/search/?q=hidden+gems',
    headless=True
)

for post in page.css('[data-testid="post-container"]'):
    print(post.css('h3::text').get())
```

---

## Target Subreddits

```python
SUBREDDITS = [
    "nyc",
    "AskNYC", 
    "FoodNYC",
    "nycbars",
    "NYCinTheWild",
]

QUERIES = [
    "hidden gem",
    "underrated",
    "locals only",
    "secret spot",
    "tourist trap alternative",
]
```

---

## Implementation Location

```
src/approaches/web_scraper/scrapers/
├── reddit_json.py      # Primary: .json endpoint
├── reddit_apify.py     # Backup: Apify actor
└── reddit_scrapling.py # Fallback: Scrapling
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 429 Too Many Requests | Wait `x-ratelimit-reset` seconds |
| Empty results | Check subreddit exists, try different query |
| Connection refused | Add User-Agent header |
| Rate limit 0 remaining | Switch to Apify or wait |