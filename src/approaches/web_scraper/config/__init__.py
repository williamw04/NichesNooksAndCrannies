"""Web scraper configuration."""

from src.approaches.web_scraper.config.constants import (
    ATLAS_OBSCURA_CONFIG,
    CATEGORY_PRIORITY,
    GOOGLE_MAPS_TYPE_MAPPING,
    KEYWORD_CATEGORY_MAPPING,
)
from src.approaches.web_scraper.config.settings import Settings, settings
from src.approaches.web_scraper.config.subreddits import (
    REDDIT_CONFIG,
    REDDIT_SEARCH_PATTERNS,
)

__all__ = [
    "Settings",
    "settings",
    "REDDIT_CONFIG",
    "REDDIT_SEARCH_PATTERNS",
    "ATLAS_OBSCURA_CONFIG",
    "GOOGLE_MAPS_TYPE_MAPPING",
    "KEYWORD_CATEGORY_MAPPING",
    "CATEGORY_PRIORITY",
]
