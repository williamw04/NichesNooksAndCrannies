"""Google Maps location validation tool."""

import json
from typing import Optional

from pydantic import BaseModel, Field

from src.approaches.ai_agent.config.settings import get_settings
from src.shared.services.cache import get_cache
from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import get_rate_limiter
from src.shared.types.location import CHAIN_BLACKLIST

logger = get_logger(__name__)
cache = get_cache()
rate_limiter = get_rate_limiter("google_maps")


class LocationValidationResult(BaseModel):
    name: str
    place_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    price_level: Optional[int] = None
    google_maps_url: Optional[str] = None
    types: list[str] = Field(default_factory=list)
    is_chain: bool = False
    verified: bool = False
    error: Optional[str] = None


def validate_location(
    name: str,
    neighborhood: Optional[str] = None,
    address_hint: Optional[str] = None,
) -> LocationValidationResult:
    """Validate a location using Google Maps API.

    Args:
        name: Location name to search
        neighborhood: Optional neighborhood for context
        address_hint: Optional address hint for better matching

    Returns:
        LocationValidationResult with verified data
    """
    settings = get_settings()

    if not settings.google_maps_api_key:
        return LocationValidationResult(
            name=name,
            error="Google Maps API key not configured",
        )

    cache_key = f"validate:{name}:{neighborhood}:{address_hint}"
    cached = cache.get(cache_key)
    if cached:
        return LocationValidationResult(**cached)

    rate_limiter.wait("google_maps")

    try:
        import googlemaps
    except ImportError:
        return LocationValidationResult(
            name=name,
            error="googlemaps not installed. Install with: pip install googlemaps",
        )

    try:
        gmaps = googlemaps.Client(key=settings.google_maps_api_key)

        query = f"{name}"
        if neighborhood:
            query += f", {neighborhood}"
        query += ", New York, NY"

        places_result = gmaps.places(query)

        if not places_result.get("results"):
            return LocationValidationResult(
                name=name,
                error="Location not found on Google Maps",
            )

        first_result = places_result["results"][0]
        place_id = first_result.get("place_id")

        rate_limiter.wait("google_maps")
        details = gmaps.place(
            place_id,
            fields=[
                "name",
                "formatted_address",
                "geometry",
                "rating",
                "user_ratings_total",
                "price_level",
                "url",
                "types",
                "website",
            ],
        )

        result_data = details.get("result", {})

        location = result_data.get("geometry", {}).get("location", {})

        found_name = result_data.get("name", name)
        normalized_name = found_name.lower().strip()
        is_chain = any(chain in normalized_name for chain in CHAIN_BLACKLIST)

        result = LocationValidationResult(
            name=found_name,
            place_id=place_id,
            latitude=location.get("lat"),
            longitude=location.get("lng"),
            address=result_data.get("formatted_address"),
            rating=result_data.get("rating"),
            review_count=result_data.get("user_ratings_total"),
            price_level=result_data.get("price_level"),
            google_maps_url=result_data.get("url"),
            types=result_data.get("types", []),
            is_chain=is_chain,
            verified=True,
        )

        cache.set(cache_key, result.model_dump(), ttl=86400)

        logger.info(
            f"Validated location: {result.name}",
            rating=result.rating,
            reviews=result.review_count,
            is_chain=is_chain,
        )

        return result

    except Exception as e:
        logger.error(f"Location validation failed for {name}: {e}")
        return LocationValidationResult(name=name, error=str(e))


def batch_validate_locations(
    candidates: list[dict],
) -> list[LocationValidationResult]:
    """Validate multiple location candidates.

    Args:
        candidates: List of dicts with 'name' and optional 'neighborhood'

    Returns:
        List of LocationValidationResult
    """
    results = []
    for candidate in candidates:
        result = validate_location(
            name=candidate.get("name", ""),
            neighborhood=candidate.get("neighborhood"),
        )
        results.append(result)
    return results


class ValidateLocationTool:
    """Tool class for CrewAI integration."""

    name: str = "validate_location"
    description: str = """Validate a location using Google Maps API.
    
    Input: JSON with 'name', optional 'neighborhood', optional 'address_hint'
    Output: JSON with validated location data including coordinates
    """

    def _run(
        self,
        name: str,
        neighborhood: Optional[str] = None,
        address_hint: Optional[str] = None,
    ) -> str:
        result = validate_location(name, neighborhood, address_hint)
        return json.dumps(result.model_dump(), indent=2)
