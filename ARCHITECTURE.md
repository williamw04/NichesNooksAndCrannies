# Architecture

**Version:** 1.0.0  
**Last Updated:** 2026-03-10

## Overview

This document describes the architecture of the NYC Hidden Gems Discovery System. It defines the three approaches, shared components, and dependency rules.

## Approach Map

### Core Approaches

**AI Agent Approach** (`src/approaches/ai_agent/`)
- Discovery, validation, and enrichment via AI agents
- Framework: CrewAI or LangChain
- Best for: Quality, nuanced content, small batches
- Cost: ~$0.30-0.50/location
- Dependencies: Shared types, Shared services

**Web Scraper Approach** (`src/approaches/web_scraper/`)
- Deterministic scraping of specific platforms
- Tools: PRAW, BeautifulSoup, Scrapy, Google Places API
- Best for: Scale, cost efficiency, large batches
- Cost: ~$0.12-0.25/location
- Dependencies: Shared types, Shared services

**Hybrid Approach** (`src/approaches/hybrid/`)
- Combines scrapers (bulk collection) + AI (enrichment)
- Best balance of speed, cost, and quality
- Cost: ~$0.28-0.50/location
- Dependencies: AI Agent, Web Scraper, Shared

## Layer Structure

Within each approach, code is organized into layers:

```
Types → Config → Sources → Processors → Output
```

### Layer Descriptions

**Types** (`types/`)
- Data type definitions, schemas
- Location model, API responses
- Dependencies: None

**Config** (`config/`)
- Configuration constants, environment variables
- API keys, rate limits, search queries
- Dependencies: Types

**Sources** (`sources/`)
- Data fetching/scraping modules
- Reddit client, Atlas Obscura scraper, Google Maps API
- Dependencies: Types, Config

**Processors** (`processors/`)
- Data transformation and validation
- Deduplication, enrichment, scoring
- Dependencies: Types, Config, Sources

**Output** (`output/`)
- Final data export
- CSV generation, database persistence
- Dependencies: Types, Processors

## Shared Components

Located in `src/shared/`:

**Types** (`src/shared/types/`)
- `location.ts` - Location model and schema
- `sources.ts` - Source types and interfaces
- `output.ts` - Output format definitions

**Utils** (`src/shared/utils/`)
- `validation.ts` - Coordinate validation, data checks
- `formatting.ts` - Text formatting, normalization
- `deduplication.ts` - Location matching and dedup

**Services** (`src/shared/services/`)
- `cache.ts` - Response caching
- `rate-limiter.ts` - Rate limiting utilities
- `logger.ts` - Structured logging

## Package Structure

```
src/
├── approaches/
│   ├── ai_agent/
│   │   ├── types/
│   │   ├── config/
│   │   ├── agents/          # Agent definitions
│   │   ├── tools/           # Agent tools
│   │   ├── processors/
│   │   └── main.py
│   ├── web_scraper/
│   │   ├── types/
│   │   ├── config/
│   │   ├── scrapers/        # Scraper modules
│   │   │   ├── reddit.py
│   │   │   ├── atlas_obscura.py
│   │   │   └── google_maps.py
│   │   ├── processors/
│   │   └── main.py
│   └── hybrid/
│       ├── types/
│       ├── config/
│       ├── pipeline.py      # Orchestrates scraper + AI
│       └── main.py
├── shared/
│   ├── types/
│   │   ├── location.py
│   │   ├── sources.py
│   │   └── output.py
│   ├── utils/
│   │   ├── validation.py
│   │   ├── formatting.py
│   │   └── deduplication.py
│   └── services/
│       ├── cache.py
│       ├── rate_limiter.py
│       └── logger.py
├── data/
│   ├── raw/
│   ├── processed/
│   └── output/
└── tests/
    ├── ai_agent/
    ├── web_scraper/
    ├── hybrid/
    └── shared/
```

## Dependency Rules

### Intra-Approach Dependencies
```
Types → Config → Sources → Processors → Output
```

### Cross-Approach Dependencies
```
Hybrid → AI Agent (processors)
Hybrid → Web Scraper (scrapers)
All Approaches → Shared (types, utils, services)
```

### Allowed Imports

```python
# ✅ Processor importing from Sources
from ..sources.reddit import RedditScraper

# ✅ Any layer importing from Shared
from shared.types.location import Location
from shared.utils.validation import validate_coordinates

# ✅ Hybrid importing from other approaches
from approaches.ai_agent.processors.enrichment import EnrichmentProcessor
from approaches.web_scaper.scrapers.reddit import RedditScraper
```

### Not Allowed

```python
# ❌ Sources importing from Processors (backward)
from ..processors.enrichment import EnrichmentProcessor

# ❌ Shared importing from approaches
from approaches.ai_agent import DiscoveryAgent
```

## Data Flow

### AI Agent Flow
```
Discovery Agent → Validation Agent → Social Proof Agent → Enrichment Agent → Output
       ↓                  ↓                    ↓                    ↓
   Reddit/Atlas      Google Maps         Web Search          Content Gen
```

### Web Scraper Flow
```
Reddit Scraper → Atlas Obscura → Google Maps API → Cross-Reference → Output
       ↓               ↓                ↓                 ↓
   Mentions         Details          Coords          Deduplication
```

### Hybrid Flow
```
Phase 1: Scraping (Web Scraper)
├── Reddit Scraper → Raw candidates
├── Atlas Obscura → Structured data
└── Google Maps → Coordinates

Phase 2: Enrichment (AI Agent)
├── Validation Agent → Verify candidates
├── Social Proof Agent → Score locations
└── Enrichment Agent → Generate content

Phase 3: Output
└── Export to CSV
```

## Output Schema

All approaches must output to the same schema:

```python
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class Category(str, Enum):
    CAFE = "cafe"
    RESTAURANT = "restaurant"
    NATURE = "nature"
    HISTORICAL = "historical"
    MUSEUM = "museum"
    SHOPPING = "shopping"
    ADVENTURE = "adventure"
    RELAXATION = "relaxation"
    NIGHTLIFE = "nightlife"
    FESTIVAL = "festival"
    LOCAL = "local"

class Location(BaseModel):
    name: str
    description: str
    category: Category
    latitude: Optional[float]
    longitude: Optional[float]
    city: str = "New York"
    country: str = "USA"
    address: Optional[str]
    price_level: Optional[int]  # 1-4
    google_maps_url: Optional[str]
    rating: Optional[float]
    image_url: Optional[str]
    tags: List[str]
    ai_vibe_summary: str
    gem_level: int  # 1, 2, or 3
    neighborhood: Optional[str]
```

## Configuration

### Environment Variables

```bash
# API Keys
OPENAI_API_KEY=sk-...
SERPAPI_KEY=...
GOOGLE_MAPS_API_KEY=...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...

# Rate Limiting
REQUESTS_PER_MINUTE=60
REDDIT_RATE_LIMIT=60

# Output
OUTPUT_DIR=./data/output
MAX_LOCATIONS=50
```

### Rate Limits

| Service | Rate Limit |
|---------|------------|
| Reddit API | 60 requests/minute |
| Google Places | 11,000 calls/day (free tier) |
| SerpAPI | 5,000 searches/month |
| OpenAI | Depends on tier |

## Testing Strategy

### Unit Tests
- All scrapers tested with mock responses
- All processors tested with sample data
- All validators tested with edge cases

### Integration Tests
- End-to-end pipeline tests
- API integration tests (with mocks)
- Output schema validation

### Quality Tests
- Gem level distribution check
- Coordinate validation
- Description quality check

## Evolution Guidelines

### Adding a New Source
1. Create scraper in appropriate approach's `sources/`
2. Define types in approach's `types/` or shared
3. Add to processor pipeline
4. Write tests
5. Update documentation

### Adding a New Approach
1. Create directory in `src/approaches/`
2. Follow layer structure
3. Use shared types and utilities
4. Ensure output schema compatibility
5. Update this document

## References

- See `docs/product-specs/` for detailed specifications
- See `docs/quality-score.md` for quality metrics
- See `docs/design-docs/core-beliefs.md` for foundational principles