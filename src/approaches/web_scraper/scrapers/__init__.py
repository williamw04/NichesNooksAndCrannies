"""Web scraper scrapers module."""

from src.approaches.web_scraper.scrapers.atlas_obscura import AtlasObscuraScraper
from src.approaches.web_scraper.scrapers.google_maps import GoogleMapsClient
from src.approaches.web_scraper.scrapers.reddit import RedditScraper

__all__ = [
    "RedditScraper",
    "AtlasObscuraScraper",
    "GoogleMapsClient",
]
