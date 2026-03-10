"""Google Maps Places API client."""

import time
from typing import Optional

from src.approaches.web_scraper.config import (
    GOOGLE_MAPS_TYPE_MAPPING,
    KEYWORD_CATEGORY_MAPPING,
    settings,
)
from src.approaches.web_scraper.types.scraper_result import GoogleMapsResult
from src.shared.services.cache import get_cache
from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import get_rate_limiter
from src.shared.types.location import Category
from src.shared.utils.formatting import extract_neighborhood_from_address
from src.shared.utils.validation import is_chain

logger = get_logger(__name__)


class GoogleMapsClient:
    def __init__(self):
        self.client = None
        self.rate_limiter = get_rate_limiter("google_maps")
        self.cache = get_cache()
        self._initialized = False

    def _init_client(self) -> bool:
        if self._initialized:
            return self.client is not None

        self._initialized = True

        if not settings.google_maps_configured:
            logger.warning("Google Maps API key not configured")
            return False

        try:
            import googlemaps

            self.client = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
            logger.info("Google Maps client initialized")
            return True
        except Exception as e:
            logger.error("Failed to initialize Google Maps client", error=str(e))
            return False

    def text_search(
        self,
        query: str,
        location: Optional[tuple[float, float]] = None,
        radius: Optional[int] = None,
    ) -> list[GoogleMapsResult]:
        if not self._init_client():
            return []

        cache_key = f"gmaps_text_search:{query}:{location}:{radius}"
        cached = self.cache.get(cache_key)
        if cached:
            return [GoogleMapsResult(**r) for r in cached]

        results = []
        try:
            self.rate_limiter.wait("google_maps")

            search_params = {"query": query}
            if location:
                search_params["location"] = location
            if radius:
                search_params["radius"] = radius

            response = self.client.places(**search_params)

            for place in response.get("results", []):
                result = self._parse_place_result(place)
                if result and not is_chain(result.name):
                    results.append(result)

            cache_data = [r.model_dump() for r in results]
            self.cache.set(cache_key, cache_data, ttl=86400)

        except Exception as e:
            logger.error("Google Maps text search failed", query=query, error=str(e))

        return results

    def nearby_search(
        self,
        location: tuple[float, float],
        radius: int = 5000,
        place_type: Optional[str] = None,
    ) -> list[GoogleMapsResult]:
        if not self._init_client():
            return []

        results = []
        try:
            self.rate_limiter.wait("google_maps")

            params = {"location": location, "radius": radius}
            if place_type:
                params["type"] = place_type

            response = self.client.places_nearby(**params)

            for place in response.get("results", []):
                result = self._parse_place_result(place)
                if result and not is_chain(result.name):
                    results.append(result)

        except Exception as e:
            logger.error("Google Maps nearby search failed", error=str(e))

        return results

    def get_place_details(self, place_id: str) -> Optional[GoogleMapsResult]:
        if not self._init_client():
            return None

        cache_key = f"gmaps_place_details:{place_id}"
        cached = self.cache.get(cache_key)
        if cached:
            return GoogleMapsResult(**cached)

        try:
            self.rate_limiter.wait("google_maps")

            fields = [
                "place_id",
                "name",
                "formatted_address",
                "geometry",
                "rating",
                "user_ratings_total",
                "price_level",
                "types",
                "url",
                "website",
                "photos",
            ]

            response = self.client.place(place_id, fields=fields)
            result = response.get("result", {})

            if not result:
                return None

            parsed = self._parse_detailed_result(result)

            if parsed:
                self.cache.set(cache_key, parsed.model_dump(), ttl=604800)

            return parsed

        except Exception as e:
            logger.error("Google Maps place details failed", place_id=place_id, error=str(e))
            return None

    def find_place(self, name: str, address: Optional[str] = None) -> Optional[GoogleMapsResult]:
        query = f"{name}, New York, NY"
        if address:
            query = f"{name}, {address}"

        results = self.text_search(query)

        if results:
            for result in results:
                if name.lower() in result.name.lower():
                    return result
            return results[0]

        return None

    def validate_and_enrich(
        self, name: str, address: Optional[str] = None
    ) -> Optional[GoogleMapsResult]:
        result = self.find_place(name, address)

        if result and result.rating and result.rating < settings.MIN_RATING:
            logger.debug("Place filtered by rating", name=name, rating=result.rating)
            return None

        if result:
            detailed = self.get_place_details(result.place_id)
            if detailed:
                return detailed

        return result

    def _parse_place_result(self, place: dict) -> Optional[GoogleMapsResult]:
        try:
            name = place.get("name")
            if not name:
                return None

            place_id = place.get("place_id")
            geometry = place.get("geometry", {})
            location = geometry.get("location", {})

            address = place.get("formatted_address") or place.get("vicinity")

            category = self._determine_category(place.get("types", []), name)

            neighborhood = None
            if address:
                neighborhood = extract_neighborhood_from_address(address)

            return GoogleMapsResult(
                name=name,
                place_id=place_id,
                latitude=location.get("lat"),
                longitude=location.get("lng"),
                address=address,
                rating=place.get("rating"),
                user_ratings_total=place.get("user_ratings_total"),
                price_level=place.get("price_level"),
                category=category,
                neighborhood=neighborhood,
            )

        except Exception as e:
            logger.debug("Failed to parse Google Maps place", error=str(e))
            return None

    def _parse_detailed_result(self, place: dict) -> Optional[GoogleMapsResult]:
        result = self._parse_place_result(place)

        if result:
            result.google_maps_url = place.get("url")
            result.website = place.get("website")

            photos = place.get("photos", [])
            if photos:
                photo_ref = photos[0].get("photo_reference")
                if photo_ref:
                    result.photo_url = self._build_photo_url(photo_ref)

        return result

    def _determine_category(self, types: list[str], name: str) -> Optional[Category]:
        for place_type in types:
            if place_type in GOOGLE_MAPS_TYPE_MAPPING:
                return GOOGLE_MAPS_TYPE_MAPPING[place_type]

        name_lower = name.lower()
        for keyword, category in KEYWORD_CATEGORY_MAPPING.items():
            if keyword in name_lower:
                return category

        return Category.LOCAL

    def _build_photo_url(self, photo_reference: str, max_width: int = 400) -> str:
        return (
            f"https://maps.googleapis.com/maps/api/place/photo?"
            f"maxwidth={max_width}&photoreference={photo_reference}&key={settings.GOOGLE_MAPS_API_KEY}"
        )

    def search_hidden_gems(
        self,
        category: Optional[str] = None,
        max_results: int = 20,
    ) -> list[GoogleMapsResult]:
        if not self._init_client():
            return []

        results = []
        queries = ["hidden gem", "local favorite", "neighborhood spot"]

        if category:
            queries = [f"{q} {category}" for q in queries]
        else:
            queries = [f"{q} NYC" for q in queries]

        location = (settings.NYC_CENTER_LAT, settings.NYC_CENTER_LNG)

        for query in queries[:2]:
            found = self.text_search(query, location=location, radius=settings.NYC_SEARCH_RADIUS)
            results.extend(found)

            if len(results) >= max_results:
                break

        filtered = []
        for result in results:
            if is_chain(result.name):
                continue

            review_count = result.user_ratings_total or 0
            if review_count <= settings.MAX_REVIEWS_HIDDEN_GEM:
                filtered.append(result)

        return filtered[:max_results]

    def geocode(self, address: str) -> Optional[tuple[float, float]]:
        if not self._init_client():
            return None

        cache_key = f"gmaps_geocode:{address}"
        cached = self.cache.get(cache_key)
        if cached:
            return tuple(cached)

        try:
            self.rate_limiter.wait("google_maps")
            results = self.client.geocode(address)

            if results:
                location = results[0].get("geometry", {}).get("location", {})
                lat = location.get("lat")
                lng = location.get("lng")

                if lat and lng:
                    self.cache.set(cache_key, [lat, lng], ttl=2592000)
                    return lat, lng

        except Exception as e:
            logger.error("Geocoding failed", address=address, error=str(e))

        return None
