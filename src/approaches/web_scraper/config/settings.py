"""Environment settings and configuration."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class Settings:
    REDDIT_CLIENT_ID: str = os.getenv("REDDIT_CLIENT_ID", "")
    REDDIT_CLIENT_SECRET: str = os.getenv("REDDIT_CLIENT_SECRET", "")
    REDDIT_USER_AGENT: str = os.getenv("REDDIT_USER_AGENT", "hidden-gems/0.1.0")
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

    OUTPUT_DIR: Path = Path(os.getenv("OUTPUT_DIR", "data/output"))
    MAX_LOCATIONS: int = int(os.getenv("MAX_LOCATIONS", "50"))
    REQUESTS_PER_MINUTE: int = int(os.getenv("REQUESTS_PER_MINUTE", "60"))

    REDDIT_RATE_LIMIT: int = int(os.getenv("REDDIT_RATE_LIMIT", "60"))
    GOOGLE_MAPS_RATE_LIMIT: int = int(os.getenv("GOOGLE_MAPS_RATE_LIMIT", "50"))

    ATLAS_OBSCURA_RATE_LIMIT: int = 30

    NYC_CENTER_LAT: float = 40.7128
    NYC_CENTER_LNG: float = -74.0060
    NYC_SEARCH_RADIUS: int = 25000

    MIN_RATING: float = 4.3
    MAX_REVIEWS_HIDDEN_GEM: int = 500
    MAX_REVIEWS_LOCAL_FAVORITE: int = 1000

    @property
    def reddit_configured(self) -> bool:
        return bool(self.REDDIT_CLIENT_ID and self.REDDIT_CLIENT_SECRET)

    @property
    def google_maps_configured(self) -> bool:
        return bool(self.GOOGLE_MAPS_API_KEY)


settings = Settings()
