# NYC Hidden Gems Discovery System

A data collection system for building a database of 50 NYC locations with 3-tier gem classification (Iconic/Local Favorite/Hidden Gem).

## Project Components

| Component | Language | Purpose | Status |
|-----------|----------|---------|--------|
| `tiktok-scraper/` | TypeScript | TikTok video discovery + AI extraction + Places validation | **Active** |
| `src/approaches/` | Python | Web scraper, AI agent, hybrid approaches | Planned |

## Directory Structure

```
├── tiktok-scraper/           # Main scraper (TypeScript/Node)
│   ├── src/                  # Source code
│   ├── visualizer/           # Map-based explorer
│   ├── docs/                 # Architecture decisions, design docs
│   └── output/               # Scraped location data
│
├── src/                      # Python approaches (planned)
│   ├── approaches/
│   │   ├── web-scraper/      # Reddit, Atlas Obscura scraping
│   │   ├── ai-agent/         # CrewAI/LangChain discovery
│   │   └── hybrid/           # Combined approach
│   └── shared/               # Types, utils, services
│
├── docs/                     # Specifications and planning
│   ├── product-specs/        # WHAT to build
│   ├── exec-plans/           # HOW to build
│   └── quality-score.md      # Status tracking
│
├── data/                     # Data storage
│   ├── raw/                  # Unprocessed data
│   ├── processed/            # Cleaned intermediate
│   └── output/               # Final CSV
│
└── storage/                  # Apify storage (if used)
```

## Quick Start

### TikTok Scraper (Primary)

```bash
cd tiktok-scraper
npm install
npx playwright install chromium

# Create .env with:
# QWEN_API_KEY=your_dashscope_key
# GOOGLE_MAPS_API_KEY=your_maps_key
# SUPABASE_URL/KEY (optional)

npm start              # Interactive TUI
npm run scrape:example # Quick test
npm run serve          # Visualizer at localhost:8000/visualizer/
```

### Python Approaches (Planned)

```bash
pip install -e ".[dev,web-scraper]"
python -m src.approaches.web_scraper.main
```

## TikTok Scraper Pipeline

```
Google SERP → TikTok videos → AI extraction (Qwen) → Places validation → Storage
```

- **Discovery**: Google search finds TikTok videos about NYC places
- **Extraction**: Qwen extracts business names from video descriptions/subtitles
- **Validation**: Places API returns coordinates, addresses, ratings
- **Storage**: SQLite (local) + Supabase (remote sync)

### Results (2026-04-14)

- 18 queries, 90 videos scraped
- 93 locations extracted
- Average engagement: 25,073 (likes+comments+shares+saves)
- All locations have coordinates and addresses from Places API

## Output Schema

```csv
name,description,category,latitude,longitude,city,country,address,
price_level,google_maps_url,rating,image_url,tags,ai_vibe_summary,
gem_level,neighborhood
```

## History

### 2026-04-14
- TikTok scraper v2.0: Qwen/DashScope AI, Places API validation
- Large scrape: 93 validated locations stored
- Visualizer updated with ratings/addresses
- Supabase sync fixed (FK constraint)

### 2026-03-26
- TikTok scraper v1.0: OpenRouter AI, SQLite storage
- Initial Python project structure

## Documentation

- [tiktok-scraper/README.md](tiktok-scraper/README.md) — Scraper docs
- [tiktok-scraper/AGENTS.md](tiktok-scraper/AGENTS.md) — Development guide
- [AGENTS.md](AGENTS.md) — Parent repo navigation
- [docs/product-specs/](docs/product-specs/) — Specifications