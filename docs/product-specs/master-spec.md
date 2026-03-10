# NYC Hidden Gems Discovery System - Master Product Specification

## Executive Summary

A dual-mode data collection system for building a high-quality database of 50 NYC locations spanning iconic landmarks to true hidden gems. The system supports both AI agent-based discovery (for quality and nuance) and web scraping (for scale and cost efficiency).

---

## System Overview

### Core Objective
Build a comprehensive location database with:
- **50 total locations** across 11 categories
- **3-tier gem classification system**
- **Rich content**: descriptions, vibe summaries, tags
- **Data quality**: verified coordinates, ratings, sources

### Gem Level Distribution
| Level | Type | Target % | Count | Description |
|-------|------|----------|-------|-------------|
| 1 | Iconic | 15% | ~8 | World-famous landmarks (High Line, MoMA, Brooklyn Bridge) |
| 2 | Local Favorite | 35% | ~17 | Community-loved spots, moderate online presence |
| 3 | Hidden Gem | 50% | ~25 | Under 500 reviews, discovered via Reddit/social |

### Category Distribution
Minimum 2-3 locations per category:
- cafe, restaurant, nature, historical, museum, shopping
- adventure, relaxation, nightlife, festival, local

---

## Approach 1: AI Agent-Based Discovery

### Philosophy
Use autonomous AI agents with web browsing capabilities to intelligently discover, validate, and categorize locations. Agents handle unstructured data (Reddit threads, blog posts) and generate rich content.

### Architecture

#### Agent Workflow
```
Discovery Agent → Validation Agent → Social Proof Agent → Enrichment Agent → Persistence
      ↓                ↓                    ↓                    ↓                  ↓
  Reddit/Atlas    GMaps/Yelp API      Web Search           Review/Photo      SQLite/CSV
  Local Blogs     Foursquare          TikTok/IG Proxy      Analysis
```

#### Agent Definitions

**1. Discovery Agent**
- **Role**: Location Researcher
- **Goal**: Find raw location candidates from multiple sources
- **Tools**:
  - Reddit search (PRAW)
  - Atlas Obscura scraping
  - Google search proxy (SerpAPI)
  - Local blog RSS feeds
- **Output**: JSON list of candidates with source URLs

**2. Validation Agent**
- **Role**: Data Validator
- **Goal**: Verify location existence and quality
- **Tools**:
  - Google Places API
  - Yelp Fusion API
  - Chain/franchise detection
  - Coordinate verification
- **Output**: Validated locations with coordinates, ratings

**3. Social Proof Agent**
- **Role**: Social Signals Analyst
- **Goal**: Calculate social validation scores
- **Tools**:
  - Google search (TikTok/Instagram proxy)
  - Reddit mention counter
  - Blog reference finder
- **Scoring**:
  - +3: TikTok/Instagram page appears
  - +2: Appears in "hidden gems" content
  - +2: Multiple independent sources
  - +1: Single Reddit mention
  - -2: Only on generic tourism sites

**4. Enrichment Agent**
- **Role**: Content Creator
- **Goal**: Generate compelling descriptions and vibe summaries
- **Tools**:
  - Review analysis (sentiment, keywords)
  - Photo analysis (aesthetic detection)
  - Description generator
  - Tag creator
- **Output**: Rich content for each location

**5. Orchestration Agent**
- **Role**: Workflow Manager
- **Goal**: Coordinate multi-agent workflow, handle errors

### Technical Stack

#### Framework Options

**Option A: CrewAI (Recommended for Rapid Prototyping)**
```python
from crewai import Agent, Task, Crew

researcher = Agent(
    role='Location Researcher',
    goal='Find hidden gem locations in NYC',
    tools=[search_reddit, browse_web, validate_location],
    llm='gpt-4-turbo'
)

crew = Crew(agents=[researcher, validator, enricher], tasks=[...])
result = crew.kickoff()
```
**Pros**: Simple API, role-based, good docs  
**Cons**: Less flexible for complex workflows

**Option B: LangChain + LangGraph (Recommended for Control)**
```python
from langgraph.graph import StateGraph

workflow = StateGraph(dict)
workflow.add_node("discover", discover_node)
workflow.add_node("validate", validate_node)
workflow.add_edge("discover", "validate")
app = workflow.compile()
```
**Pros**: Full control, state management, complex workflows  
**Cons**: Steeper learning curve

**Option C: AutoGen (Multi-Agent Conversations)**
```python
import autogen
assistant = autogen.AssistantAgent(name="researcher", ...)
user_proxy = autogen.UserProxyAgent(name="user_proxy", ...)
```
**Pros**: Multi-agent conversations, code execution  
**Cons**: Complex setup

**NOT RECOMMENDED: OpenClaw**
- OpenClaw is a personal AI assistant (like a self-hosted Siri)
- Designed for interactive, ongoing tasks with memory
- Not optimized for batch data processing
- Would require building custom skills from scratch
- Better for: "Monitor Reddit weekly and alert me of new gems"
- Not ideal for: One-time collection of 50 locations

#### Required APIs
| Service | Cost | Purpose |
|---------|------|---------|
| OpenAI GPT-4 | $0.03-0.06/1K tokens | Agent reasoning, enrichment |
| Anthropic Claude | $0.03/1K tokens | Alternative agent backend |
| SerpAPI | $50/month (5,000 searches) | Google search proxy |
| Google Maps API | $200 free/month, then $7/1K | Geocoding, place details |
| Foursquare API | Free tier: 100K calls/day | Venue data backup |
| Reddit API (PRAW) | Free | Subreddit searches |

#### Custom API Provider Support

**If your provider isn't natively supported:**

Use **LiteLLM** as a universal proxy:
```python
from litellm import completion

response = completion(
    model="custom/your-model",
    messages=[...],
    api_base="https://your-provider.com/v1",
    api_key="your-key"
)
```

**Compatible with**: LangChain, CrewAI (via LiteLLM), AutoGen

**Requirements from your provider**:
- Base URL (OpenAI-compatible)
- API key
- Model name
- Endpoints: `/chat/completions`, `/embeddings`

### Data Schema

```csv
name,description,category,latitude,longitude,city,country,address,price_level,google_maps_url,rating,image_url,tags,ai_vibe_summary,gem_level,neighborhood
```

**Field Specifications**:
- `description`: 2-3 sentences, conversational tone, lead with what makes it special
- `ai_vibe_summary`: Max 20 words, captures feeling not facts
- `tags`: 6-12 tags (vibe-focused: cozy, moody-lighting, rooftop, etc.)
- `gem_level`: 1, 2, or 3 (based on review count and source quality)
- `price_level`: 1-4 ($, $$, $$$, $$$$)

### Cost Analysis

**Per 50 Locations**:
| Component | Cost |
|-----------|------|
| AI tokens (GPT-4 for enrichment) | $8-15 |
| GPT-3.5 for discovery/validation | $2-4 |
| SERP API (250 searches) | $2.50 |
| Google Maps API | $1-2 |
| **Total** | **$13.50-23.50** |
| **Per location** | **$0.27-0.47** |

**Time Estimate**:
- Sequential: 45-90 minutes
- Parallel (CrewAI): 15-30 minutes

### Quality Control

**Non-Negotiable Rules**:
- ❌ No fabricated coordinates/addresses (use null if unverifiable)
- ❌ No chains/franchises (unless genuinely iconic original location)
- ✅ Descriptions must have personality (avoid brochure language)
- ✅ Gem level 3 must have verifiable community source
- ✅ All 50 rows in single CSV output

**Validation Checkpoints**:
1. Discovery: Minimum 3 sources per gem_level 3 location
2. Validation: Cross-check on Google Maps + Yelp
3. Social Proof: Score 2+ for gem_level 3, 1+ for gem_level 2
4. Enrichment: AI-generated content reviewed for accuracy

---

## Approach 2: Web Scraper-Based Discovery

### Philosophy
Build targeted, deterministic scrapers for specific platforms. Fast, cheap, scalable, but limited to structured data.

### Architecture

#### Scraping Pipeline
```
Reddit Scraper → Atlas Obscura Scraper → GMaps API → Cross-Reference Engine → Database
      ↓                  ↓                      ↓                 ↓
  PRAW (Python)      BeautifulSoup       Places API       Deduplication
```

#### Component Specifications

**1. Reddit Scraper**
```python
import praw

reddit = praw.Reddit(client_id="...", client_secret="...", user_agent="...")
subreddits = ['nyc', 'AskNYC', 'FoodNYC', 'nycbars']
queries = ['hidden gem', 'underrated', 'locals only', 'secret spot']

# Extract: location mentions, upvotes, context
# Rate limit: 60 requests/minute
# Alternative: Pushshift.io for historical data
```

**2. Atlas Obscura Scraper**
```python
import requests
from bs4 import BeautifulSoup

url = "https://www.atlasobscura.com/things-to-do/new-york-city"
# Parse: Title, description, coordinates, category
# Rate limit: 1 request/2 seconds
# Risk: Site structure changes break parser
```

**3. Google Maps Data (API, not scraping)**
```python
import googlemaps

gmaps = googlemaps.Client(key='YOUR_API_KEY')
places = gmaps.places(query='cafe in Brooklyn', 
                      location=(40.6782, -73.9442),
                      radius=5000)
# Filter: rating >= 4.3, reviews <= 500
```

**4. Social Media Scrapers**
```python
# TikTok/Instagram via Apify
from apify_client import ApifyClient

client = ApifyClient('YOUR_APIFY_TOKEN')
run = client.actor('tiktok-scraper').call(run_input={
    'searchQueries': ['NYC hidden gem cafe'],
    'resultsPerPage': 50
})
```

**5. Cross-Reference Engine**
```python
# Match locations across sources
# Calculate social proof scores
# Filter chains using business registry
# Deduplicate entries
```

### Technical Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Reddit API | PRAW | Free (rate limited) |
| Atlas Obscura | Scrapy/BeautifulSoup | Free |
| Google Places API | Official API | $200 free/month |
| TikTok/Instagram | Apify Actors | $5-10/run |
| Proxies | Bright Data/ScraperAPI | $10-20/month |
| Database | PostgreSQL/SQLite | Free |

### Cost Analysis

**Per 50 Locations**:
| Component | Cost |
|-----------|------|
| Reddit API | Free |
| Atlas Obscura | Free |
| Google Places API | $1-2 |
| TikTok/Instagram (Apify) | $5-10 |
| Proxies | $10-20/month |
| **Total per batch** | **$6-12** |
| **Per location** | **$0.12-0.24** |

**Time Estimate**:
- Development: 2-3 days (building scrapers)
- Runtime: 2-5 minutes for 50 locations

### Challenges & Limitations

**Technical Challenges**:
- ❌ **Fragile** - Breaks when websites change structure
- ❌ **Anti-bot measures** - CAPTCHAs, IP blocking, requires proxies
- ❌ **Rate limiting** - Reddit (60 req/min), Google (quota-based)
- ❌ **Legal/TOS risks** - Scraping may violate terms of service

**Data Limitations**:
- ❌ **No content generation** - Can't write descriptions or vibe summaries
- ❌ **Limited to structured data** - Can't parse nuance in Reddit discussions
- ❌ **No quality scoring** - Deterministic, no AI judgment

**Platform-Specific Issues**:
- **Reddit**: API restricts commercial use
- **TikTok/Instagram**: Heavily restricted, requires third-party services
- **Atlas Obscura**: No API, scraping required

---

## Recommended: Hybrid Approach

### Philosophy
Combine scrapers for bulk collection with AI agents for enrichment. Best balance of speed, cost, and quality.

### Workflow
```
Phase 1: SCRAPING (Fast, Cheap)
├── Reddit Scraper → Raw candidates
├── Atlas Obscura Scraper → Structured data
└── Google Maps API → Coordinates, ratings

Phase 2: AI ENRICHMENT (Quality)
├── Validation Agent → Verify candidates
├── Social Proof Agent → Score locations
└── Enrichment Agent → Generate content

Phase 3: PERSISTENCE
├── Cross-reference & deduplicate
├── Assign gem_levels
└── Export to CSV
```

### Cost Projection
| Phase | Cost per 50 locations |
|-------|----------------------|
| Scraping | $6-12 |
| AI Enrichment (GPT-4) | $8-12 |
| **Total** | **$14-24** |
| **Per location** | **$0.28-0.48** |

**Time**: 10-15 minutes for 50 locations

### When to Use Each Approach

| Scenario | Recommended Approach |
|----------|---------------------|
| Initial MVP (first 50) | AI Agent |
| Scale (500+ locations) | Web Scraper + AI Enrichment |
| Daily/weekly updates | Web Scraper |
| Quality > Quantity | AI Agent |
| Budget constrained (<$0.20/loc) | Web Scraper only |
| Rich content required | AI Agent |

---

## Implementation Roadmap

### Phase 1: MVP (Week 1)
1. Choose framework (CrewAI recommended)
2. Set up custom LLM provider via LiteLLM
3. Build Discovery Agent (Reddit + Atlas Obscura)
4. Build Validation Agent (Google Maps)
5. Generate first 10 locations end-to-end

### Phase 2: Quality (Week 2)
1. Add Social Proof Agent
2. Add Enrichment Agent
3. Implement quality controls
4. Generate full 50 locations
5. Manual review and refinement

### Phase 3: Scale (Week 3-4)
1. Build web scrapers for bulk collection
2. Create hybrid workflow
3. Add database persistence
4. Build monitoring/alerting
5. Automate weekly updates

### Phase 4: Production (Ongoing)
1. Deploy to cloud (AWS/GCP)
2. Schedule regular runs
3. Build admin dashboard
4. A/B test different sources
5. Expand to other cities

---

## Data Source Priority

### Tier 1 (Highest Signal)
1. **Reddit**: r/nyc, r/AskNYC, r/FoodNYC, r/nycbars
   - Search: "hidden gem", "underrated", "locals only"
   - Extract: Mentions, context, upvotes
2. **Atlas Obscura**: Unique/historical spots
3. **Google Maps**: Filter 4.3+ stars, <500 reviews
4. **Local neighborhood blogs**

### Tier 2 (Good Signal)
- Eater NY, The Infatuation (secret sections)
- NYC.gov Parks pages
- Timeout "Secret NYC" articles
- Yelp "hidden gem" tags

### Tier 3 (Gem Level 1 Only)
- TripAdvisor, Lonely Planet
- Official NYC Tourism

---

## Success Metrics

### Data Quality
- [ ] 50 locations generated
- [ ] Gem level distribution: 15%/35%/50%
- [ ] All locations have verified coordinates
- [ ] Gem level 3 locations have community sources
- [ ] Zero fabricated data

### Content Quality
- [ ] Descriptions pass "friend test" (sounds like a local recommendation)
- [ ] ai_vibe_summary is evocative and specific
- [ ] Tags are varied and vibe-focused (not repetitive)

### System Performance
- [ ] Cost per location <$0.50
- [ ] Time to generate 50 locations <30 minutes
- [ ] <5% error rate in validation

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| API rate limits | Implement exponential backoff, caching |
| Website changes | Version scrapers, monitor for failures |
| IP blocking | Use rotating proxies |
| Data hallucination | Multi-source validation, manual spot checks |
| Cost overruns | GPT-3.5 for simple tasks, GPT-4 only for enrichment |

### Legal/Ethical Risks
| Risk | Mitigation |
|------|------------|
| TOS violations | Use official APIs where possible |
| Data privacy | Don't store PII, respect robots.txt |
| Copyright | Use public data only, attribute sources |

---

## Decision Matrix

| Factor | AI Agent | Web Scraper | Hybrid |
|--------|----------|-------------|--------|
| **Cost/location** | $0.27-0.47 | $0.12-0.24 | $0.28-0.48 |
| **Speed (50 locs)** | 15-45 min | 2-5 min | 10-15 min |
| **Content quality** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Scale (1000+)** | ❌ Poor | ✅ Excellent | ✅ Good |
| **Handles unstructured** | ✅ Yes | ❌ No | ✅ Yes |
| **Maintenance** | Low | High | Medium |
| **Setup time** | 1-2 days | 2-3 days | 3-4 days |

**Recommendation**: Start with **AI Agent (CrewAI)** for MVP to validate the data model, then transition to **Hybrid** for scale.

---

## Appendix

### A. Tool Specifications

**Web Search Tool**:
```python
@tool
def search_google(query: str) -> str:
    """
    Search Google via SerpAPI
    Args: query (str): Search query
    Returns: JSON with organic results
    """
```

**Reddit Search Tool**:
```python
@tool
def search_reddit(subreddit: str, query: str, limit: int = 25) -> str:
    """
    Search Reddit for location mentions
    Args: subreddit (str), query (str), limit (int)
    Returns: List of posts with mentions
    """
```

**Validation Tool**:
```python
@tool
def validate_location(name: str, address: str) -> dict:
    """
    Verify location on Google Maps
    Returns: {exists, coordinates, rating, review_count, is_chain}
    """
```

### B. LLM Prompts

**Discovery Prompt**:
```
Search Reddit r/AskNYC for mentions of "hidden gem" restaurants.
Extract: name, neighborhood, description snippet, source URL.
Target: 20 candidates. Focus on spots with <500 reviews.
Return as JSON list.
```

**Enrichment Prompt**:
```
Write a 2-3 sentence description for [LOCATION].
Tone: Like a cool local friend recommending it.
Lead with what makes it special.
Avoid: "Located in...", "This place offers..."
```

### C. Database Schema

```sql
CREATE TABLE locations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    latitude REAL,
    longitude REAL,
    address TEXT,
    price_level INTEGER,
    rating REAL,
    tags TEXT,
    ai_vibe_summary TEXT,
    gem_level INTEGER,
    neighborhood TEXT,
    source_urls TEXT,
    social_proof_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Document History

- **Created**: Product specifications based on discussion about AI agent vs web scraper approaches
- **Key Decisions**:
  - AI agents (CrewAI/LangChain) for quality-focused initial collection
  - Web scrapers for scale and cost efficiency
  - Hybrid approach as optimal long-term solution
  - OpenClaw NOT recommended for this batch processing use case
  - LiteLLM for custom API provider support

---

## Next Steps

1. **Choose framework**: CrewAI (ease) vs LangGraph (control)
2. **Verify custom API**: Test with LiteLLM proxy
3. **Build prototype**: Discovery + Validation agents
4. **Generate test batch**: 10 locations
5. **Validate quality**: Manual review against criteria
6. **Iterate**: Refine agents based on results

Ready to build? I recommend starting with a CrewAI prototype using your custom LLM provider.
