# Product Specification: AI Agent-Based Location Discovery

## Overview
Use AI agents with web browsing capabilities to intelligently discover, validate, and categorize NYC locations following the system prompt workflow.

## Architecture

### Core Components

#### 1. Discovery Agent
- **Tool**: Web search (Google/SERP API)
- **Capabilities**: 
  - Execute searches for "hidden gems NYC", "underrated spots [neighborhood]"
  - Browse Reddit threads and extract location mentions
  - Navigate Atlas Obscura and local blogs
- **Output**: Raw location candidates with source URLs
- **Rate Limit**: 100 searches/hour (respecting SERP API limits)

#### 2. Validation Agent
- **Tool**: Web browser + Google Maps
- **Capabilities**:
  - Verify location exists on Google Maps
  - Extract coordinates, ratings, review counts
  - Check if location is a chain/franchise
  - Validate addresses
- **Output**: Enriched location data with verification status

#### 3. Social Proof Agent
- **Tool**: Web search across platforms
- **Capabilities**:
  - Search TikTok/Instagram via Google proxy
  - Check Reddit for mentions
  - Calculate social proof scores
- **Output**: Social validation scores + source links

#### 4. Vibe Analysis Agent
- **Tool**: Web browser + Image analysis
- **Capabilities**:
  - Analyze location photos and reviews
  - Generate ai_vibe_summary
  - Create descriptive tags
- **Output**: Rich descriptive content

#### 5. Data Persistence Agent
- **Tool**: Database/SQLite
- **Capabilities**:
  - Store validated locations
  - Prevent duplicates
  - Track discovery sources

### Data Flow
```
Discovery → Validation → Social Proof → Vibe Analysis → Persistence
     ↓           ↓              ↓              ↓              ↓
  Reddit     GMaps API      Web Search      Reviews      SQLite
  Blogs      Yelp API       TikTok/IG       Photos       CSV Export
  Atlas Ob   Foursquare     Reddit          AI Gen
```

## Technical Stack

### Required APIs
| Service | Cost | Purpose |
|---------|------|---------|
| OpenAI GPT-4 | $0.03-0.06/1K tokens | Agent reasoning, vibe analysis |
| Anthropic Claude | $0.03/1K tokens | Alternative agent backend |
| SerpAPI | $50/month (5,000 searches) | Google search proxy |
| Google Maps API | $200 free/month, then $7/1K requests | Geocoding, place details |
| Foursquare API | Free tier: 100K calls/day | Venue data backup |

### Implementation Options

#### Option A: Single Agent with Tools (Simpler)
- One agent with access to multiple tools
- Sequential processing
- Easier to debug
- **Cost estimate**: $2-5 per 50 locations

#### Option B: Multi-Agent Workflow (Scalable)
- Specialized agents for each step
- Parallel processing possible
- Better error isolation
- **Cost estimate**: $5-10 per 50 locations

## Pros
✅ **Handles unstructured data well** - Can parse Reddit threads, blog posts, social media
✅ **Intelligent filtering** - Understands context (e.g., "not a hidden gem anymore")
✅ **Generates rich content** - Creates compelling descriptions and vibe summaries
✅ **Adapts to changes** - Works even if websites change layout
✅ **Quality control** - Can apply nuanced rules (like the gem_level scoring)

## Cons
❌ **Higher cost per location** - AI tokens add up
❌ **Slower** - Sequential processing, API latency
❌ **Non-deterministic** - May produce different results each run
❌ **Rate limiting** - Search APIs have strict limits
❌ **Debugging complexity** - Hard to trace why agent made specific decisions

## Cost Projection (50 locations)

| Component | Cost |
|-----------|------|
| AI tokens (discovery + validation + analysis) | $8-15 |
| SERP API (250 searches) | $2.50 |
| Google Maps API | $1-2 |
| **Total per batch** | **$12-20** |
| **Cost per location** | **$0.24-0.40** |

## Time Estimate
- **Per location**: 30-60 seconds (with rate limiting)
- **50 locations**: 45-90 minutes (with parallelization: 15-30 minutes)

## Recommended For
- Initial dataset creation
- Quality over quantity
- Locations requiring nuanced analysis
- When budget allows $0.30/location
