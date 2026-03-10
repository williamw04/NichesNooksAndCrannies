"""Location model and related types."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class Category(str, Enum):
    CAFE = "cafe"
    RESTAURANT = "restaurant"
    NATURE = "nature"
    HISTORICAL = "historical"
    MUSEUM = "museum"
    SHOPPING = "shopping"
    ADVENTURE = "adventure"
    RELAXATION = "relaxation"
    NIGHTLIFE = "nightlife"
    FESTIVAL = "festival"
    LOCAL = "local"


class GemLevel(int, Enum):
    ICONIC = 1
    LOCAL_FAVORITE = 2
    HIDDEN_GEM = 3


class Location(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=50, max_length=500)
    category: Category
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    city: str = Field(default="New York", max_length=100)
    country: str = Field(default="USA", max_length=100)
    address: Optional[str] = Field(None, max_length=300)
    price_level: Optional[int] = Field(None, ge=1, le=4)
    google_maps_url: Optional[str] = Field(None, max_length=500)
    rating: Optional[float] = Field(None, ge=0, le=5)
    image_url: Optional[str] = Field(None, max_length=500)
    tags: list[str] = Field(default_factory=list, min_length=6, max_length=12)
    ai_vibe_summary: str = Field(..., min_length=10, max_length=100)
    gem_level: GemLevel
    neighborhood: Optional[str] = Field(None, max_length=100)
    source_urls: list[str] = Field(default_factory=list)

    model_config = {"use_enum_values": True}


class RawLocation(BaseModel):
    name: str
    category: Optional[Category] = None
    neighborhood: Optional[str] = None
    source_url: str
    source_type: str
    raw_data: dict = Field(default_factory=dict)


class LocationCandidate(BaseModel):
    name: str
    category: Optional[Category] = None
    neighborhood: Optional[str] = None
    address: Optional[str] = None
    source_urls: list[str] = Field(default_factory=list)
    mentions: int = 0
    context: Optional[str] = None


GEM_LEVEL_DISTRIBUTION = {
    GemLevel.ICONIC: {"target_percent": 0.15, "target_count": 8},
    GemLevel.LOCAL_FAVORITE: {"target_percent": 0.35, "target_count": 17},
    GemLevel.HIDDEN_GEM: {"target_percent": 0.50, "target_count": 25},
}

CHAIN_BLACKLIST = {
    "starbucks",
    "mcdonald's",
    "mcdonalds",
    "subway",
    "chipotle",
    "dunkin'",
    "dunkin",
    "domino's",
    "dominos",
    "pizza hut",
    "kfc",
    "taco bell",
    "burger king",
    "wendy's",
    "wendys",
    "panera",
    "five guys",
    "shake shack",
    "chick-fil-a",
    "chickfila",
    "panda express",
    "applebee's",
    "applebees",
    "olive garden",
    "tgi fridays",
    "chili's",
    "chilis",
    "cheesecake factory",
    "buffalo wild wings",
    "ihop",
    "denny's",
    "dennys",
}
