# Agent Operating Guide

**Version:** 1.0.0  
**Last Updated:** 2026-03-10

## Purpose

This file is your navigation map. It points to the right context for your current task. This is NOT a comprehensive instruction manual—it's a table of contents.

## Core Principles

1. **Repository as System of Record**: If it's not in this repository, it doesn't exist.
2. **Progressive Disclosure**: Start here, then navigate to specific documentation as needed.
3. **Mechanical Enforcement**: Rules are enforced by tests and linters where possible.
4. **Documentation is Code**: All docs are versioned, structured, and kept current.

## Project Overview

**NYC Hidden Gems Discovery System**: Build a database of 50 NYC locations with 3-tier gem classification (Iconic/Local Favorite/Hidden Gem) using multiple data collection approaches.

## Getting Started

### First-Time Setup
1. Read `ARCHITECTURE.md` for system structure and approach organization
2. Review `docs/product-specs/` for detailed specifications
3. Check `docs/quality-score.md` for current status

### Before Starting Work
1. Identify which approach you're working on (ai-agent, web-scraper, or hybrid)
2. Review relevant product specs in `docs/product-specs/`
3. Check `docs/exec-plans/active/` for ongoing initiatives
4. Follow the layer structure for your approach

## Where to Find Information

### Product & Design
| Need | Location |
|------|----------|
| Master specification | `docs/product-specs/master-spec.md` |
| AI Agent approach | `docs/product-specs/ai-agent-approach.md` |
| Web Scraper approach | `docs/product-specs/web-scraper-approach.md` |
| AI Agent deep dive | `docs/product-specs/ai-agent-deep-dive.md` |

### Architecture & Code
| Need | Location |
|------|----------|
| System architecture | `ARCHITECTURE.md` |
| Quality metrics | `docs/quality-score.md` |
| Core beliefs | `docs/design-docs/core-beliefs.md` |

### Implementation Planning
| Need | Location |
|------|----------|
| Active plans | `docs/exec-plans/active/` |
| Completed plans | `docs/exec-plans/completed/` |
| Tech debt tracker | `docs/exec-plans/tech-debt-tracker.md` |

## Directory Structure

```
src/
├── approaches/
│   ├── ai-agent/      # AI agent-based discovery (CrewAI/LangChain)
│   ├── web-scraper/   # Traditional web scraping (PRAW, BeautifulSoup)
│   └── hybrid/        # Combined approach
├── shared/
│   ├── types/         # Shared type definitions
│   ├── utils/         # Common utilities
│   └── services/      # Shared services
data/
├── raw/               # Raw scraped/fetched data
├── processed/         # Cleaned and validated data
└── output/            # Final CSV/JSON output
```

## Approach-Specific Guidelines

### AI Agent Approach (`src/approaches/ai-agent/`)
- Framework: CrewAI or LangChain
- Tools: SerpAPI, Google Places API, Reddit API
- Focus: Quality, nuance, content generation
- Output: Enriched locations with descriptions and vibe summaries

### Web Scraper Approach (`src/approaches/web-scraper/`)
- Tools: PRAW, BeautifulSoup, Scrapy
- Sources: Reddit, Atlas Obscura, Google Places API
- Focus: Scale, cost efficiency, speed
- Output: Raw location data

### Hybrid Approach (`src/approaches/hybrid/`)
- Combines web scrapers for bulk collection
- Uses AI agents for enrichment
- Best balance of speed, cost, and quality

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
1. **Understand the Task**: Read related product specs
2. **Choose Approach**: ai-agent, web-scraper, or hybrid
3. **Implement**: Follow architectural constraints
4. **Validate**: Test against quality requirements
5. **Document**: Update relevant docs

### Quality Gates
- All locations have verified coordinates
- Gem level 3 locations have community sources
- Descriptions pass "friend test"
- Output matches schema exactly

## Navigation Quick Reference

| Need | Location |
|------|----------|
| What to build | `docs/product-specs/` |
| How approaches are organized | `ARCHITECTURE.md` |
| Current quality status | `docs/quality-score.md` |
| Work in progress | `docs/exec-plans/active/` |

---

**Remember**: This file is your starting point. Navigate to specific documentation as needed for your task.