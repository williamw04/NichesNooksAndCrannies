"""Yelp Fusion API scraper for cross-validation and ratings."""

import os
import time
from dataclasses import dataclass
from typing import Optional

import requests

from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import RateLimiter


@dataclass
class YelpBusiness:
    id: str
    name: str
    rating: float
    review_count: int
    price: Optional[str]
    categories: list[str]
    address: str
    city: str
    latitude: Optional[float]
    longitude: Optional[float]
    url: str
    image_url: Optional[str]
    phone: Optional[str]


class YelpScraper:
    """Yelp Fusion API client for business search and details."""

    name = "yelp"
    BASE_URL = "https://api.yelp.com/v3"

    def __init__(
        self,
        api_key: Optional[str] = None,
        rate_limit_per_minute: int = 50,
    ):
        self.api_key = api_key or os.getenv("YELP_API_KEY", "")
        self.logger = get_logger("yelp_scraper")
        self.rate_limiter = RateLimiter(requests_per_minute=rate_limit_per_minute)
        self.session = requests.Session()
        if self.api_key:
            self.session.headers.update({"Authorization": f"Bearer {self.api_key}"})

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _wait_for_rate_limit(self) -> None:
        self.rate_limiter.wait()

    def _make_request(self, endpoint: str, params: dict) -> Optional[dict]:
        """Make authenticated request to Yelp API."""
        if not self.is_configured:
            self.logger.error("Yelp API key not configured")
            return None

        self._wait_for_rate_limit()

        url = f"{self.BASE_URL}/{endpoint}"
        try:
            response = self.session.get(url, params=params, timeout=30)

            if response.status_code == 429:
                self.logger.warning("Rate limited by Yelp API")
                time.sleep(60)
                return self._make_request(endpoint, params)

            if response.status_code != 200:
                self.logger.error(
                    "Yelp API error",
                    status=response.status_code,
                    endpoint=endpoint,
                )
                return None

            return response.json()

        except Exception as e:
            self.logger.error("Yelp API request failed", error=str(e))
            return None

    def search_businesses(
        self,
        term: str,
        location: str = "New York, NY",
        categories: Optional[list[str]] = None,
        limit: int = 20,
        sort_by: str = "rating",
        price: Optional[str] = None,
    ) -> list[YelpBusiness]:
        """Search for businesses on Yelp."""
        params = {
            "term": term,
            "location": location,
            "limit": limit,
            "sort_by": sort_by,
        }

        if categories:
            params["categories"] = ",".join(categories)
        if price:
            params["price"] = price

        data = self._make_request("businesses/search", params)
        if not data:
            return []

        businesses = []
        for item in data.get("businesses", []):
            location_data = item.get("location", {})
            coord = item.get("coordinates", {})
            categories_list = [c.get("title", "") for c in item.get("categories", [])]

            business = YelpBusiness(
                id=item.get("id", ""),
                name=item.get("name", ""),
                rating=item.get("rating", 0.0),
                review_count=item.get("review_count", 0),
                price=item.get("price"),
                categories=categories_list,
                address=", ".join(location_data.get("display_address", [])),
                city=location_data.get("city", ""),
                latitude=coord.get("latitude"),
                longitude=coord.get("longitude"),
                url=item.get("url", ""),
                image_url=item.get("image_url"),
                phone=item.get("phone"),
            )
            businesses.append(business)

        self.logger.info(
            "Yelp search completed",
            term=term,
            results=len(businesses),
        )
        return businesses

    def get_business_details(self, business_id: str) -> Optional[YelpBusiness]:
        """Get detailed information for a specific business."""
        data = self._make_request(f"businesses/{business_id}", {})
        if not data:
            return None

        location_data = data.get("location", {})
        coord = data.get("coordinates", {})
        categories_list = [c.get("title", "") for c in data.get("categories", [])]

        return YelpBusiness(
            id=data.get("id", ""),
            name=data.get("name", ""),
            rating=data.get("rating", 0.0),
            review_count=data.get("review_count", 0),
            price=data.get("price"),
            categories=categories_list,
            address=", ".join(location_data.get("display_address", [])),
            city=location_data.get("city", ""),
            latitude=coord.get("latitude"),
            longitude=coord.get("longitude"),
            url=data.get("url", ""),
            image_url=data.get("image_url"),
            phone=data.get("phone"),
        )

    def search_hidden_gems(
        self,
        categories: Optional[list[str]] = None,
        limit: int = 50,
    ) -> list[YelpBusiness]:
        """Search for hidden gems (high rating, lower review count)."""
        all_businesses = []

        search_terms = [
            "hidden gem",
            "underrated",
            "neighborhood favorite",
            "local secret",
            "off the beaten path",
        ]

        for term in search_terms:
            businesses = self.search_businesses(
                term=term,
                categories=categories,
                limit=limit // len(search_terms),
            )
            all_businesses.extend(businesses)
            time.sleep(0.5)

        seen = set()
        unique = []
        for b in all_businesses:
            if b.id not in seen:
                seen.add(b.id)
                unique.append(b)

        hidden_gems = [b for b in unique if b.rating >= 4.0 and b.review_count < 500]

        self.logger.info(
            "Hidden gems search completed",
            total_found=len(unique),
            hidden_gems=len(hidden_gems),
        )
        return hidden_gems


if __name__ == "__main__":
    scraper = YelpScraper()

    if not scraper.is_configured:
        print("Set YELP_API_KEY environment variable to test")
    else:
        print("=== Testing Yelp Scraper ===\n")

        print("1. Searching for 'hidden gem' restaurants:")
        results = scraper.search_hidden_gems(categories=["restaurants"], limit=20)
        for i, biz in enumerate(results[:5], 1):
            print(f"  {i}. {biz.name} - {biz.rating}★ ({biz.review_count} reviews)")

        print("\n2. Searching for coffee shops:")
        cafes = scraper.search_businesses(term="coffee", categories=["coffee"], limit=5)
        for i, biz in enumerate(cafes, 1):
            print(f"  {i}. {biz.name} - {biz.address}")
