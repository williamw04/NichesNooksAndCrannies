# Product Specification: Traditional Web Scraper Approach

## Overview
Build targeted scrapers for specific platforms to extract location data programmatically. Uses deterministic parsing rather than AI reasoning.

## Architecture

### Core Components

#### 1. Reddit Scraper
```python
# PRAW (Python Reddit API Wrapper)
- Subreddits: r/nyc, r/AskNYC, r/FoodNYC, r/nycbars
- Search queries: "hidden gem", "underrated", "locals only"
- Extract: Location mentions, upvotes, context
- Output: Location name, source URL, mention count
```

#### 2. Atlas Obscura Scraper
```python
# BeautifulSoup/Scrapy
- URL pattern: atlasobscura.com/things-to-do/new-york-city
- Extract: Title, description, coordinates, category
- Rate limit: 1 request/2 seconds
- Output: Structured location data
```

#### 3. Google Maps Scraper
```python
# Google Places API (preferred) or scraping
- API Approach: places.textSearch(), places.details()
- Filter: rating >= 4.3, reviews <= 500
- Extract: name, address, coordinates, rating, photos
- Output: Enriched location data
```

#### 4. Social Media Scrapers
```python
# TikTok/Instagram via third-party or manual
- Apify actors: tiktok-scraper, instagram-scraper
- Search: "NYC hidden gem", "[location name] NYC"
- Extract: Video count, view counts, engagement
- Output: Social proof metrics
```

#### 5. Cross-Reference Engine
```python
# Data matching and validation
- Match locations across sources
- Calculate social proof scores
- Filter chains using business registry data
- Output: Deduplicated, validated locations
```

### Data Flow
```
Reddit → Atlas Obscura → Google Maps → Social APIs → Cross-Reference → DB
   ↓           ↓              ↓             ↓              ↓
 Mentions    Details       Coords       Metrics       Deduplication
```

## Technical Stack

### Required Tools & Libraries
| Component | Technology | Cost |
|-----------|-----------|------|
| Reddit API | PRAW | Free (with rate limits) |
| Atlas Obscura | Scrapy/BeautifulSoup | Free |
| Google Places API | Official API | $200 free/month |
| TikTok Data | Apify Actor | $5-10/run |
| Instagram Data | Apify Actor | $5-10/run |
| Database | PostgreSQL/SQLite | Free |

### Scraping Infrastructure
```
Scrapy Cluster (optional for scale)
├── Spider for Reddit
├── Spider for Atlas Obscura
├── Spider for Local Blogs
└── Scheduler (respects robots.txt, rate limits)
```

## Pros
✅ **Deterministic** - Same inputs = same outputs
✅ **Fast** - Can process thousands of locations/hour
✅ **Cheap** - No AI token costs
✅ **Scalable** - Easy to add new sources
✅ **Maintainable** - Code is explicit and testable

## Cons
❌ **Fragile** - Breaks when websites change
❌ **Limited to structured data** - Can't parse nuance in Reddit discussions
❌ **No content generation** - Can't write descriptions or vibe summaries
❌ **Legal/ethical risks** - TOS violations, robots.txt restrictions
❌ **Anti-bot measures** - CAPTCHAs, IP blocking, requires proxies

## Platform-Specific Challenges

### Reddit
- **Limitation**: API limits (60 requests/minute)
- **Workaround**: Use Pushshift.io archive (historical data)
- **Risk**: API terms prohibit commercial use

### Atlas Obscura
- **Limitation**: No official API
- **Workaround**: Respectful scraping (1 req/2s, robots.txt)
- **Risk**: Site structure changes break parser

### TikTok/Instagram
- **Limitation**: Heavily restricted APIs
- **Workaround**: Third-party services (Apify, Bright Data)
- **Cost**: $50-200/month for reliable access

### Google Maps
- **Limitation**: 11,000 free calls/day, then $7/1K
- **Workaround**: Cache aggressively
- **Alternative**: Use OpenStreetMap Nominatim (free but slower)

## Cost Projection (50 locations)

| Component | Cost |
|-----------|------|
| Reddit API | Free |
| Atlas Obscura | Free |
| Google Places API | $1-2 |
| TikTok/Instagram (Apify) | $5-10 |
| Proxies (if needed) | $10-20/month |
| **Total per batch** | **$6-12** |
| **Cost per location** | **$0.12-0.24** |

## Time Estimate
- **Development**: 2-3 days (building scrapers)
- **Per location**: <1 second (batch processing)
- **50 locations**: 2-5 minutes

## Recommended For
- Large-scale data collection (1000+ locations)
- Regular updates (daily/weekly refresh)
- Budget-constrained projects
- When you need reproducible results

## Hybrid Recommendation
Use **both approaches**:

1. **Scrapers** for bulk data collection (quantity)
   - Reddit mentions
   - Atlas Obscura listings
   - Google Maps base data

2. **AI Agent** for enrichment (quality)
   - Vibe analysis
   - Description writing
   - Gem level classification
   - Social proof validation

**Cost**: ~$0.20/location  
**Time**: 10-15 minutes for 50 locations
