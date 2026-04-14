"""NYC Parks scraper for nature category locations."""

import re
import time
from dataclasses import dataclass
from typing import Optional

import requests
from bs4 import BeautifulSoup

from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import RateLimiter


@dataclass
class NYCPark:
    name: str
    address: str
    borough: str
    latitude: Optional[float]
    longitude: Optional[float]
    description: str
    amenities: list[str]
    url: str
    size_acres: Optional[float]


class NYCParksScraper:
    """Scraper for NYC Parks website to find hidden nature spots."""

    name = "nyc_parks"
    BASE_URL = "https://www.nycgovparks.org"
    PARKS_LIST_URL = f"{BASE_URL}/parks"

    HIDDEN_GEM_KEYWORDS = [
        "community garden",
        "pocket park",
        "nature preserve",
        "wildlife sanctuary",
        "greenstreet",
        "sitting area",
        "esplanade",
        "nature trail",
    ]

    def __init__(self, rate_limit_per_minute: int = 30):
        self.logger = get_logger("nyc_parks_scraper")
        self.rate_limiter = RateLimiter(requests_per_minute=rate_limit_per_minute)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "NYC-Hidden-Gems/1.0",
                "Accept": "text/html,application/xhtml+xml",
            }
        )

    def _wait_for_rate_limit(self) -> None:
        self.rate_limiter.wait()

    def _fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch and parse a page."""
        self._wait_for_rate_limit()

        try:
            response = self.session.get(url, timeout=30)
            if response.status_code != 200:
                self.logger.error(
                    "Failed to fetch page",
                    url=url,
                    status=response.status_code,
                )
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            self.logger.error("Page fetch error", url=url, error=str(e))
            return None

    def _parse_park_page(self, url: str) -> Optional[NYCPark]:
        """Parse individual park page for details."""
        soup = self._fetch_page(url)
        if not soup:
            return None

        name_elem = soup.select_one("h1.title")
        name = name_elem.get_text(strip=True) if name_elem else ""

        if not name:
            return None

        desc_elem = soup.select_one(".park-description, .content p")
        description = desc_elem.get_text(strip=True) if desc_elem else ""

        address_elem = soup.select_one(".location-address, .address")
        address = address_elem.get_text(strip=True) if address_elem else ""

        borough_elem = soup.select_one(".borough, .location-borough")
        borough = borough_elem.get_text(strip=True) if borough_elem else ""

        lat, lng = None, None
        map_link = soup.select_one("a[href*='maps.google.com']")
        if map_link:
            href = map_link.get("href", "")
            coords_match = re.search(r"q=([-\d.]+),([-\d.]+)", href)
            if coords_match:
                lat = float(coords_match.group(1))
                lng = float(coords_match.group(2))

        amenities = []
        amenity_elems = soup.select(".amenities li, .amenity-list li")
        for elem in amenity_elems:
            amenity = elem.get_text(strip=True)
            if amenity:
                amenities.append(amenity)

        size = None
        size_elem = soup.select_one(".size, .acres")
        if size_elem:
            size_text = size_elem.get_text(strip=True)
            size_match = re.search(r"([\d.]+)\s*acres?", size_text, re.I)
            if size_match:
                size = float(size_match.group(1))

        return NYCPark(
            name=name,
            address=address,
            borough=borough,
            latitude=lat,
            longitude=lng,
            description=description[:500] if description else "",
            amenities=amenities,
            url=url,
            size_acres=size,
        )

    def search_parks_by_borough(
        self,
        borough: str,
        limit: int = 20,
    ) -> list[NYCPark]:
        """Search parks in a specific borough."""
        borough_slug = borough.lower().replace(" ", "-")
        url = f"{self.PARKS_LIST_URL}/{borough_slug}"

        soup = self._fetch_page(url)
        if not soup:
            return []

        parks = []
        park_links = soup.select("a.park-link, .park-listing a, li a[href*='/parks/']")

        for link in park_links[:limit]:
            href = link.get("href", "")
            if not href:
                continue

            full_url = href if href.startswith("http") else f"{self.BASE_URL}{href}"
            park = self._parse_park_page(full_url)
            if park:
                parks.append(park)
            time.sleep(0.5)

        self.logger.info(
            "Parks fetched for borough",
            borough=borough,
            count=len(parks),
        )
        return parks

    def find_hidden_nature_gems(
        self,
        limit: int = 30,
        max_size_acres: float = 10.0,
    ) -> list[NYCPark]:
        """Find smaller, lesser-known parks and nature spots."""
        all_parks = []

        boroughs = ["manhattan", "brooklyn", "queens", "bronx", "staten-island"]

        for borough in boroughs:
            parks = self.search_parks_by_borough(borough, limit=limit // len(boroughs))
            all_parks.extend(parks)
            time.sleep(1)

        hidden_gems = []
        for park in all_parks:
            is_small = park.size_acres is None or park.size_acres <= max_size_acres
            has_hidden_keyword = any(
                kw in park.description.lower() or kw in park.name.lower()
                for kw in self.HIDDEN_GEM_KEYWORDS
            )

            if is_small or has_hidden_keyword:
                hidden_gems.append(park)

        seen = set()
        unique_gems = []
        for park in hidden_gems:
            if park.name.lower() not in seen:
                seen.add(park.name.lower())
                unique_gems.append(park)

        self.logger.info(
            "Hidden nature gems found",
            total_parks=len(all_parks),
            hidden_gems=len(unique_gems),
        )
        return unique_gems[:limit]

    def search_community_gardens(self, limit: int = 20) -> list[NYCPark]:
        """Find community gardens specifically."""
        url = f"{self.BASE_URL}/things-to-do/gardens"

        soup = self._fetch_page(url)
        if not soup:
            return []

        gardens = []
        garden_links = soup.select("a[href*='/gardens/'], .garden-listing a")

        for link in garden_links[:limit]:
            href = link.get("href", "")
            if not href:
                continue

            name = link.get_text(strip=True)
            full_url = href if href.startswith("http") else f"{self.BASE_URL}{href}"

            garden = NYCPark(
                name=name,
                address="",
                borough="",
                latitude=None,
                longitude=None,
                description="Community garden in NYC",
                amenities=["garden"],
                url=full_url,
                size_acres=None,
            )
            gardens.append(garden)

        self.logger.info("Community gardens found", count=len(gardens))
        return gardens


if __name__ == "__main__":
    scraper = NYCParksScraper()

    print("=== Testing NYC Parks Scraper ===\n")

    print("1. Finding hidden nature gems:")
    gems = scraper.find_hidden_nature_gems(limit=10)
    for i, park in enumerate(gems, 1):
        print(f"  {i}. {park.name} ({park.borough})")
        if park.size_acres:
            print(f"      Size: {park.size_acres} acres")

    print("\n2. Searching community gardens:")
    gardens = scraper.search_community_gardens(limit=5)
    for i, garden in enumerate(gardens, 1):
        print(f"  {i}. {garden.name}")
