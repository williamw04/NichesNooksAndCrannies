# Agent Operating Guide

**Version:** 2.0.0  
**Last Updated:** 2026-04-14

## Purpose

This file is your navigation map. It points to the right context for your current task. This is NOT a comprehensive instruction manual—it's a table of contents.

## Core Principles

1. **Repository as System of Record**: If it's not in this repository, it doesn't exist.
2. **Progressive Disclosure**: Start here, then navigate to specific documentation as needed.
3. **Mechanical Enforcement**: Rules are enforced by tests and linters where possible.
4. **Documentation is Code**: All docs are versioned, structured, and kept current.

## Project Overview

**NYC Hidden Gems Discovery System**: Build a database of 50 NYC locations with 3-tier gem classification (Iconic/Local Favorite/Hidden Gem) using multiple data collection approaches.

### Current Status

| Component | Language | Status | Notes |
|-----------|----------|--------|-------|
| `tiktok-scraper/` | TypeScript | **Active** | 93 locations scraped, validated, stored |
| `src/approaches/unified_pipeline.py` | Python | Ready | DI refactor complete |
| `src/approaches/web-scraper/` | Python | Planned | Yelp, Reddit, Timeout scrapers |

## Getting Started

### First-Time Setup

1. **TikTok Scraper** (primary): See `tiktok-scraper/README.md`
2. **Python Pipeline**: `pip install -e ".[dev,hybrid]"`

### Before Starting Work

1. Check `tiktok-scraper/AGENTS.md` for scraper development
2. Review `docs/exec-plans/active/` for ongoing initiatives
3. Check `docs/quality-score.md` for current data status

## Where to Find Information

### TikTok Scraper (Primary Component)

| Need | Location |
|------|----------|
| Scraper overview | `tiktok-scraper/README.md` |
| Development guide | `tiktok-scraper/AGENTS.md` |
| Build & run | `tiktok-scraper/docs/build-and-run.md` |
| Architecture decisions | `tiktok-scraper/docs/adr/` |

### Python Approaches

| Need | Location |
|------|----------|
| System architecture | `ARCHITECTURE.md` |
| Master specification | `docs/product-specs/master-spec.md` |
| Web scraper approach | `docs/product-specs/web-scraper-approach.md` |

## Directory Structure

```
├── tiktok-scraper/           # TypeScript scraper (primary)
│   ├── src/
│   │   ├── pipeline/         # Discovery modes: google, tags, hybrid
│   │   ├── scraping/         # Browser, video pages, search pages
│   │   ├── validation/       # Places API geocoding
│   │   ├── storage/          # SQLite, Supabase, CSV export
│   │   └── tui/              # Interactive menu
│   ├── docs/                 # ADRs, design docs
│   └── visualizer/           # Map-based explorer
│
├── src/approaches/           # Python approaches
│   ├── unified_pipeline.py   # Combined scraper with DI
│   ├── web-scraper/          # Reddit, Yelp, Timeout, etc.
│   ├── ai-agent/             # CrewAI/LangChain (planned)
│   └── hybrid/               # Combined approach
│
├── docs/                     # Specifications, planning
│   ├── product-specs/        # WHAT to build
│   ├── exec-plans/           # HOW to build
│   └── quality-score.md      # Status tracking
│
└── data/                     # Data storage
    ├── raw/                  # Unprocessed
    ├── processed/            # Cleaned intermediate
    └── output/               # Final CSV
```

## UnifiedPipeline (Python)

The `src/approaches/unified_pipeline.py` combines all Python scrapers with dependency injection:

```python
# Production usage
from src.approaches.unified_pipeline import create_pipeline
pipeline = create_pipeline(max_locations=50)
locations = pipeline.run()

# Testing with mocks
from src.approaches.unified_pipeline import UnifiedPipeline
pipeline = UnifiedPipeline(reddit=MockReddit(), yelp=MockYelp())
```

**Data Sources:**
- Reddit (JSON API)
- Yelp (API)
- Timeout NYC (listicle scraping)
- Eater NY (map articles)
- NYC Parks (official site)
- Google Maps (enrichment)

## Key Constraints

### Data Quality
- ❌ No fabricated coordinates/addresses
- ❌ No chains/franchises (unless iconic original)
- ✅ Descriptions must have personality
- ✅ Gem level 3 must have verifiable community source
- ✅ All 50 rows in single CSV output

### Gem Level Distribution
| Level | Type | Target % | Count |
|-------|------|----------|-------|
| 1 | Iconic | 15% | ~8 |
| 2 | Local Favorite | 35% | ~17 |
| 3 | Hidden Gem | 50% | ~25 |

### Output Schema
```csv
name,description,category,latitude,longitude,city,country,address,
price_level,google_maps_url,rating,image_url,tags,ai_vibe_summary,
gem_level,neighborhood
```

## Working in This Repository

### Development Workflow

1. **Understand the Task**: Check relevant AGENTS.md
2. **Choose Component**: TikTok scraper or Python pipeline
3. **Implement**: Follow architectural constraints
4. **Validate**: Test against quality requirements
5. **Document**: Update docs in same commit

### Quality Gates
- All locations have verified coordinates
- Gem level 3 locations have community sources
- Descriptions pass "friend test"
- Output matches schema exactly

## Navigation Quick Reference

| Need | Location |
|------|----------|
| TikTok scraper | `tiktok-scraper/AGENTS.md` |
| Python pipeline | `src/approaches/unified_pipeline.py` |
| What to build | `docs/product-specs/` |
| System architecture | `ARCHITECTURE.md` |
| Current status | `docs/quality-score.md` |

---

**Remember**: Start with `tiktok-scraper/AGENTS.md` for scraper work, or this file for Python pipeline work.