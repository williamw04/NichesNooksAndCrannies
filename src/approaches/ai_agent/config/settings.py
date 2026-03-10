"""Settings and configuration for AI agents."""

import os
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_base_url: Optional[str] = Field(default=None, alias="OPENAI_BASE_URL")
    openai_model_default: str = Field(default="gpt-3.5-turbo", alias="OPENAI_MODEL_DEFAULT")
    openai_model_enrichment: str = Field(default="gpt-4-turbo", alias="OPENAI_MODEL_ENRICHMENT")

    serpapi_key: str = Field(default="", alias="SERPAPI_KEY")
    google_maps_api_key: str = Field(default="", alias="GOOGLE_MAPS_API_KEY")

    reddit_client_id: str = Field(default="", alias="REDDIT_CLIENT_ID")
    reddit_client_secret: str = Field(default="", alias="REDDIT_CLIENT_SECRET")
    reddit_user_agent: str = Field(default="hidden-gems/0.1.0", alias="REDDIT_USER_AGENT")

    max_locations: int = Field(default=50, alias="MAX_LOCATIONS")
    output_dir: str = Field(default="./data/output", alias="OUTPUT_DIR")

    requests_per_minute: int = Field(default=60, alias="REQUESTS_PER_MINUTE")
    reddit_rate_limit: int = Field(default=60, alias="REDDIT_RATE_LIMIT")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
