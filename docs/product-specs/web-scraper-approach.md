# Product Specification: Web Scraper Approach

**Version**: 2.0.0
**Last Updated**: 2026-03-10

## Overview

Build targeted scrapers for specific platforms to extract location data programmatically. Uses deterministic parsing rather than AI reasoning.

**Note**: The official Reddit API (PRAW) is not accessible due to Reddit's 2023 API restrictions. See [Reddit Scraping Method](../design-docs/reddit-scraping-method.md) for alternatives.

---

## Architecture

### Core Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Reddit Scraper │     │ Atlas Obscura    │     │ Google Maps     │
│  (JSON/Apify)   │     │ BeautifulSoup    │     │ Places API      │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 ▼
                     ┌─────────────────────┐
                     │  Cross-Reference    │
                     │  & Deduplication    │
                     └──────────┬──────────┘
                                ▼
                     ┌─────────────────────┐
                     │   Gem Classifier    │
                     └──────────┬──────────┘
                                ▼
                     ┌─────────────────────┐
                     │    CSV Output       │
                     └─────────────────────┘
```

---

## Component Specifications

### 1. Reddit Scraper

**Problem**: Official Reddit API (PRAW) requires `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` which are not accessible.

**Solutions**: Three alternatives researched and documented.

#### Option A: Reddit `.json` Endpoint ⭐ PRIMARY

**How it works**: Add `.json` to any Reddit URL to receive JSON without authentication.

**Endpoints**:
| Purpose | URL Pattern |
|---------|-------------|
| Hot posts | `https://www.reddit.com/r/{subreddit}/hot.json` |
| Search | `https://www.reddit.com/r/{subreddit}/search.json?q={query}&restrict_sr=1` |
| Post details | `https://www.reddit.com/comments/{post_id}.json` |

**Implementation**:
```python
import requests
from typing import List, Dict

def search_reddit(subreddit: str, query: str, limit: int = 25) -> List[Dict]:
    url = f"https://www.reddit.com/r/{subreddit}/search.json"
    params = {
        "q": query,
        "restrict_sr": 1,
        "limit": limit,
        "sort": "relevance"
    }
    headers = {"User-Agent": "NYC-Hidden-Gems/1.0"}
    
    response = requests.get(url, params=params, headers=headers)
    
    if response.status_code == 429:
        # Rate limited - wait and retry
        reset_time = int(response.headers.get("x-ratelimit-reset", 60))
        time.sleep(reset_time)
        return search_reddit(subreddit, query, limit)
    
    data = response.json()
    posts = data["data"]["children"]
    
    return [
        {
            "title": post["data"]["title"],
            "selftext": post["data"]["selftext"],
            "score": post["data"]["score"],
            "num_comments": post["data"]["num_comments"],
            "url": f"https://reddit.com{post['data']['permalink']}",
            "created_utc": post["data"]["created_utc"],
        }
        for post in posts
    ]
```

**Pros**:
- ✅ No authentication required
- ✅ Simple HTTP requests
- ✅ Full post data available
- ✅ Search and pagination work

**Cons**:
- ⚠️ Rate limited (~600 requests/hour)
- ⚠️ Could break if Reddit changes API

**Cost**: Free

**Rate Limits**:
- ~600 requests per 10 minutes
- Check `x-ratelimit-remaining` header
- Implement exponential backoff on 429

---

#### Option B: Apify Reddit Scraper ⭐ BACKUP

**How it works**: Pre-built scraper on Apify platform with proxy rotation.

**Actor**: `macrocosmos/reddit-scraper`

**Implementation**:
```python
from apify_client import ApifyClient

def scrape_reddit_apify(searches: List[str], max_items: int = 100) -> List[Dict]:
    client = ApifyClient("YOUR_API_TOKEN")
    
    run_input = {
        "searches": searches,
        "searchPosts": True,
        "maxItems": max_items,
        "sort": "relevance"
    }
    
    run = client.actor("macrocosmos/reddit-scraper").call(run_input=run_input)
    
    results = []
    for item in client.dataset(run["defaultDatasetId"]).iterate_items():
        results.append({
            "title": item.get("title"),
            "selftext": item.get("body"),
            "score": item.get("ups"),
            "url": item.get("url"),
            "subreddit": item.get("subreddit"),
        })
    
    return results

# Usage
posts = scrape_reddit_apify(["hidden gem NYC", "underrated NYC"])
```

**Pros**:
- ✅ Zero setup - works immediately
- ✅ Built-in residential proxy rotation
- ✅ Handles anti-bot measures
- ✅ Free tier covers ~1,000 results

**Cons**:
- ⚠️ Ongoing cost for scale
- ⚠️ External dependency

**Cost**:
| Plan | Monthly Credit | Cost per 1K Results |
|------|----------------|---------------------|
| Free | $5 | $0.50 |
| Starter | $29 | $0.50 |
| Scale | $199 | $0.50 |

**Free tier covers**: ~1,000 Reddit results

---

#### Option C: Scrapling Framework ⭐ ANTI-BOT

**How it works**: Python framework with built-in Cloudflare bypass.

**Installation**:
```bash
pip install "scrapling[fetchers]"
scrapling install  # Downloads browsers (~300MB)
```

**Implementation**:
```python
from scrapling.fetchers import StealthyFetcher

def scrape_reddit_scrapling(url: str) -> List[Dict]:
    page = StealthyFetcher.fetch(
        url,
        headless=True,
        network_idle=True
    )
    
    posts = []
    for post in page.css('[data-testid="post-container"]'):
        posts.append({
            "title": post.css('h3::text').get(),
            "upvotes": post.css('[data-click-id="upvote"] + span::text').get(),
            "url": post.css('a[href*="/comments/"]::attr(href)').get(),
        })
    
    return posts

# Usage
posts = scrape_reddit_scrapling(
    "https://www.reddit.com/r/AskNYC/search/?q=hidden+gems&type=link"
)
```

**Pros**:
- ✅ Bypasses Cloudflare/anti-bot
- ✅ Scrapy-like API
- ✅ Built-in proxy rotation
- ✅ Open source (free)

**Cons**:
- ⚠️ Heavier (~300MB browser)
- ⚠️ Slower than HTTP
- ⚠️ More complex setup

**Cost**: Free (open source)

**When to use**: If `.json` endpoint is blocked and Apify is not an option.

---

#### Reddit Scraper Recommendation

| Priority | Method | Use Case |
|----------|--------|----------|
| 1️⃣ Primary | `.json` endpoint | Default - works without auth |
| 2️⃣ Backup | Apify | If `.json` fails or blocked |
| 3️⃣ Fallback | Scrapling | If both fail and budget is $0 |

**Target Subreddits**:
- `r/nyc` - General NYC discussions
- `r/AskNYC` - Questions about NYC
- `r/FoodNYC` - Food recommendations
- `r/nycbars` - Bar recommendations
- `r/NYCinTheWild` - Tourist questions

**Search Queries**:
- "hidden gem"
- "underrated"
- "locals only"
- "secret spot"
- "tourist trap alternative"
- "favorite place"

---

### 2. Atlas Obscura Scraper

**URL**: `https://www.atlasobscura.com/things-to-do/new-york-city`

**Implementation**:
```python
from bs4 import BeautifulSoup
import requests
import time

def scrape_atlas_obscura() -> List[Dict]:
    url = "https://www.atlasobscura.com/things-to-do/new-york-city"
    headers = {"User-Agent": "NYC-Hidden-Gems/1.0"}
    
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "lxml")
    
    places = []
    for card in soup.select(".content-card"):
        places.append({
            "name": card.select_one(".title").text.strip(),
            "description": card.select_one(".subtitle").text.strip() if card.select_one(".subtitle") else "",
            "url": "https://www.atlasobscura.com" + card.select_one("a")["href"],
        })
    
    return places
```

**Rate Limit**: 1 request per 2 seconds (respectful scraping)

**Output**: Structured location data with URLs for detail pages

---

### 3. Google Maps Client

**API**: Google Places API

**Implementation**:
```python
import googlemaps

def search_google_maps(name: str, neighborhood: str = None) -> Dict:
    gmaps = googlemaps.Client(key="YOUR_API_KEY")
    
    query = f"{name} NYC"
    if neighborhood:
        query = f"{name} {neighborhood} NYC"
    
    results = gmaps.places(query)
    
    if not results["results"]:
        return None
    
    place = results["results"][0]
    details = gmaps.place(place["place_id"])
    
    return {
        "name": place["name"],
        "address": place.get("formatted_address"),
        "latitude": place["geometry"]["location"]["lat"],
        "longitude": place["geometry"]["location"]["lng"],
        "rating": place.get("rating"),
        "user_ratings_total": place.get("user_ratings_total"),
        "price_level": place.get("price_level"),
        "url": details["result"].get("url"),
        "types": place.get("types", []),
    }
```

**Rate Limit**: 11,000 calls/day free tier

**Filters**:
- Rating >= 4.3
- Reviews <= 500 for hidden gems
- Chain detection

---

### 4. Cross-Reference Engine

**Purpose**: Match locations across sources and calculate social proof.

**Implementation**:
```python
from src.shared.utils.deduplication import deduplicate_locations

def cross_reference(
    reddit_results: List[Dict],
    atlas_results: List[Dict],
    gmaps_results: List[Dict]
) -> List[Dict]:
    # Combine all sources
    all_candidates = reddit_results + atlas_results
    
    # Deduplicate by name similarity
    unique = deduplicate_locations(all_candidates, key="name")
    
    # Enrich with Google Maps data
    for candidate in unique:
        gmaps_data = search_google_maps(candidate["name"])
        if gmaps_data:
            candidate.update(gmaps_data)
    
    return unique
```

---

### 5. Gem Classifier

**Purpose**: Assign gem level based on review count and social proof.

**Rules**:
| Review Count | Social Proof | Gem Level |
|--------------|--------------|-----------|
| > 1000 | Any | 1 (Iconic) |
| 500-1000 | Low | 1 (Iconic) |
| 500-1000 | Medium+ | 2 (Local Favorite) |
| 200-500 | High | 3 (Hidden Gem) |
| 200-500 | Low-Medium | 2 (Local Favorite) |
| < 200 | Any | 2-3 (based on social proof) |

**Target Distribution**:
- Level 1 (Iconic): 15% (~8 locations)
- Level 2 (Local Favorite): 35% (~17 locations)
- Level 3 (Hidden Gem): 50% (~25 locations)

---

## Data Flow

```
Phase 1: Discovery
├── Reddit JSON API → Raw candidates (mentions, context)
├── Atlas Obscura → Unique/historical spots
└── Google Maps → Validation and enrichment

Phase 2: Processing
├── Cross-reference → Match across sources
├── Deduplication → Remove duplicates
└── Classification → Assign gem levels

Phase 3: Output
└── CSV Export → 50 locations with schema
```

---

## Technical Stack

| Component | Primary | Backup | Cost |
|-----------|---------|--------|------|
| Reddit | `.json` endpoint | Apify | Free / $0.50/1K |
| Atlas Obscura | BeautifulSoup | - | Free |
| Google Maps | Places API | - | $200 free/mo |
| Deduplication | Fuzzy matching | - | Free |
| Output | CSV | - | Free |

---

## Cost Projection

### Using `.json` Endpoint (Recommended)
| Component | Cost |
|-----------|------|
| Reddit `.json` | Free |
| Atlas Obscura | Free |
| Google Places API | $1-2 |
| **Total** | **$1-2** |
| **Per location** | **$0.02-0.04** |

### Using Apify (Backup)
| Component | Cost |
|-----------|------|
| Apify Reddit | $0.50 (free tier) |
| Atlas Obscura | Free |
| Google Places API | $1-2 |
| **Total** | **$1.50-2.50** |
| **Per location** | **$0.03-0.05** |

---

## Time Estimate

| Task | Duration |
|------|----------|
| Reddit scraping (50 queries) | 2-3 minutes |
| Atlas Obscura | 1 minute |
| Google Maps validation | 3-5 minutes |
| Processing & output | 1 minute |
| **Total** | **7-10 minutes** |

---

## Recommended For

- ✅ Budget-constrained projects ($0.02-0.05/location)
- ✅ Fast, deterministic results
- ✅ Large-scale collection (1000+ locations)
- ✅ Reproducible outputs

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `.json` endpoint blocked | Low | Switch to Apify |
| Rate limit exceeded | Medium | Implement backoff |
| IP blocked | Low | Use Apify with proxies |
| Reddit changes API | Medium | Update parser |
| No Reddit data found | Low | Rely on Atlas Obscura |

---

## Quick Start

```bash
# Install dependencies
pip install requests beautifulsoup4 googlemaps

# Set environment variables
export GOOGLE_MAPS_API_KEY="your-key"

# Run scraper
python -m src.approaches.web_scraper.main
```

---

## References

- [Reddit Scraping Method Decision](../design-docs/reddit-scraping-method.md)
- [Master Specification](./master-spec.md)
- [Architecture](../ARCHITECTURE.md)