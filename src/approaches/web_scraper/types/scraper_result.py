"""Scraper result types."""

from typing import Optional

from pydantic import BaseModel, Field

from src.shared.types.location import Category
from src.shared.types.sources import SourceType


class RedditScrapeResult(BaseModel):
    name: str
    subreddit: str
    post_title: str
    post_url: str
    score: int
    num_comments: int
    context: Optional[str] = None
    mentions: int = 1


class AtlasObscuraResult(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[Category] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    url: str
    neighborhood: Optional[str] = None


class GoogleMapsResult(BaseModel):
    name: str
    place_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    price_level: Optional[int] = None
    category: Optional[Category] = None
    google_maps_url: Optional[str] = None
    website: Optional[str] = None
    photo_url: Optional[str] = None
    neighborhood: Optional[str] = None


class ScraperResult(BaseModel):
    name: str
    source_type: SourceType
    source_url: str
    raw_data: dict = Field(default_factory=dict)
    reddit_mentions: int = 0
    atlas_obscura_match: bool = False
    google_maps_verified: bool = False
