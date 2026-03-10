"""Web Scraper Approach for NYC Hidden Gems Discovery.

This approach uses deterministic web scraping to collect location data:
- Reddit scraper (PRAW) for community recommendations
- Atlas Obscura scraper (BeautifulSoup) for unique places
- Google Maps API for validation and enrichment
- Cross-reference and deduplication processors
- Gem level classification based on review counts
"""

from src.approaches.web_scraper.main import WebScraperPipeline, main

__all__ = ["WebScraperPipeline", "main"]
