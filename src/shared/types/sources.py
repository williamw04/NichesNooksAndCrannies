"""Source types for data collection."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SourceType(str, Enum):
    REDDIT = "reddit"
    ATLAS_OBSCURA = "atlas_obscura"
    GOOGLE_MAPS = "google_maps"
    WEB_SEARCH = "web_search"
    LOCAL_BLOG = "local_blog"
    SOCIAL_MEDIA = "social_media"


class RedditPost(BaseModel):
    title: str
    url: str
    subreddit: str
    score: int
    num_comments: int
    selftext: Optional[str] = None
    created_utc: float
    post_id: str


class AtlasObscuraPlace(BaseModel):
    name: str
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    url: str
    category: Optional[str] = None


class GoogleMapsPlace(BaseModel):
    name: str
    place_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    price_level: Optional[int] = None
    types: list[str] = Field(default_factory=list)
    url: Optional[str] = None
    website: Optional[str] = None
    photos: list[str] = Field(default_factory=list)


class SourceMatch(BaseModel):
    name: str
    sources: list[SourceType]
    reddit_mentions: int = 0
    atlas_obscura_match: bool = False
    google_maps_verified: bool = False
    social_signals: int = 0
    social_proof_score: int = 0


class SocialProofResult(BaseModel):
    location_name: str
    tiktok_videos: int = 0
    instagram_posts: int = 0
    reddit_mentions: int = 0
    blog_mentions: int = 0
    tourism_site: bool = False
    hidden_gem_content: bool = False
    score: int = 0

    def calculate_score(self) -> int:
        score = 0
        if self.tiktok_videos > 0:
            score += 3
        if self.instagram_posts > 0:
            score += 2
        if self.hidden_gem_content:
            score += 2
        if self.reddit_mentions >= 2:
            score += 2
        elif self.reddit_mentions == 1:
            score += 1
        if self.tourism_site:
            score -= 2
        self.score = max(0, score)
        return self.score
