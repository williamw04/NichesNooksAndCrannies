# NYC Hidden Gems Discovery System

A data collection system for building a database of 50 NYC locations with 3-tier gem classification (Iconic/Local Favorite/Hidden Gem).

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev,web-scraper]"

# Or for AI agent approach
pip install -e ".[dev,ai-agent]"

# Or for hybrid
pip install -e ".[dev,hybrid]"

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Run web scraper approach
python -m src.approaches.web_scraper.main

# Run AI agent approach
python -m src.approaches.ai_agent.main

# Run hybrid approach
python -m src.approaches.hybrid.main
```

## Approaches

| Approach | Best For | Cost/Loc | Time/50 |
|----------|----------|----------|---------|
| Web Scraper | Scale, cost efficiency | $0.12-0.25 | 2-5 min |
| AI Agent | Quality, nuance | $0.30-0.50 | 15-45 min |
| Hybrid | Balance of both | $0.28-0.50 | 10-15 min |

## Documentation

- [AGENTS.md](AGENTS.md) - Agent navigation guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [docs/product-specs/](docs/product-specs/) - Detailed specifications
- [docs/quality-score.md](docs/quality-score.md) - Quality metrics

## Output Schema

```csv
name,description,category,latitude,longitude,city,country,address,
price_level,google_maps_url,rating,image_url,tags,ai_vibe_summary,
gem_level,neighborhood
```

## Development

```bash
# Run tests
pytest

# Run linter
ruff check .

# Run type checker
mypy src/
```