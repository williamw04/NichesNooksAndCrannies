"""Timeout NYC scraper for curated hidden gems articles."""

import re
import time
from dataclasses import dataclass
from typing import Optional

import requests
from bs4 import BeautifulSoup

from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import RateLimiter


@dataclass
class TimeoutLocation:
    name: str
    description: str
    address: Optional[str]
    neighborhood: Optional[str]
    category: str
    url: str


class TimeoutScraper:
    """Scraper for Timeout NYC hidden gems articles."""

    name = "timeout"
    BASE_URL = "https://www.timeout.com"
    NYC_URL = f"{BASE_URL}/newyork"

    HIDDEN_GEMS_URLS = [
        f"{NYC_URL}/things-to-do/secret-new-york",
        f"{NYC_URL}/things-to-do/best-hidden-gems-nyc",
        f"{NYC_URL}/things-to-do/underrated-nyc-attractions",
        f"{NYC_URL}/restaurants/secret-restaurants-nyc",
        f"{NYC_URL}/bars/secret-bars-nyc",
        f"{NYC_URL}/things-to-do/free-hidden-gems-nyc",
    ]

    def __init__(self, rate_limit_per_minute: int = 30):
        self.logger = get_logger("timeout_scraper")
        self.rate_limiter = RateLimiter(requests_per_minute=rate_limit_per_minute)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
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
                    "Failed to fetch Timeout page",
                    url=url,
                    status=response.status_code,
                )
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            self.logger.error("Timeout page fetch error", url=url, error=str(e))
            return None

    def _parse_listicle(self, url: str) -> list[TimeoutLocation]:
        """Parse a Timeout listicle article for locations."""
        soup = self._fetch_page(url)
        if not soup:
            return []

        locations = []

        article_items = soup.select(
            "article.listicle-item, .listicle__item, .xs-mb2 article, .item article"
        )

        if not article_items:
            article_items = soup.select("section[data-testid='listicle-item']")

        for item in article_items:
            name_elem = item.select_one(
                "h2, h3, .listicle-item__title, .headline, [data-testid='listicle-item-title']"
            )
            if not name_elem:
                continue

            name = name_elem.get_text(strip=True)
            name = re.sub(r"^\d+\.\s*", "", name)
            name = re.sub(r"^[•–-]\s*", "", name)

            if len(name) > 100:
                continue

            desc_elem = item.select_one(
                ".listicle-item__body, .body, p, .description, [data-testid='listicle-item-body']"
            )
            description = ""
            if desc_elem:
                paragraphs = desc_elem.find_all("p")
                description = " ".join(p.get_text(strip=True) for p in paragraphs[:2])
                description = description[:500]

            address = None
            addr_elem = item.select_one(".address, .location, [data-testid='address']")
            if addr_elem:
                address = addr_elem.get_text(strip=True)

            neighborhood = None
            hood_elem = item.select_one(".neighborhood, .area, .location-tag")
            if hood_elem:
                neighborhood = hood_elem.get_text(strip=True)

            category = "local"
            if "restaurant" in url or "food" in url or "eat" in url:
                category = "restaurant"
            elif "bar" in url or "drink" in url:
                category = "nightlife"
            elif "museum" in url or "gallery" in url:
                category = "museum"
            elif "nature" in url or "park" in url:
                category = "nature"

            locations.append(
                TimeoutLocation(
                    name=name,
                    description=description,
                    address=address,
                    neighborhood=neighborhood,
                    category=category,
                    url=url,
                )
            )

        return locations

    def scrape_hidden_gems(self, max_articles: int = 5) -> list[TimeoutLocation]:
        """Scrape hidden gems from Timeout NYC articles."""
        all_locations = []

        urls_to_scrape = self.HIDDEN_GEMS_URLS[:max_articles]

        for url in urls_to_scrape:
            self.logger.info("Scraping Timeout article", url=url)
            locations = self._parse_listicle(url)
            all_locations.extend(locations)
            time.sleep(1)

        seen = set()
        unique_locations = []
        for loc in all_locations:
            key = loc.name.lower().strip()
            if key not in seen and len(key) > 3:
                seen.add(key)
                unique_locations.append(loc)

        self.logger.info(
            "Timeout hidden gems scraped",
            total=len(all_locations),
            unique=len(unique_locations),
        )
        return unique_locations

    def search_by_category(self, category: str, limit: int = 20) -> list[TimeoutLocation]:
        """Search for hidden gems in a specific category."""
        category_urls = {
            "restaurant": f"{self.NYC_URL}/restaurants/secret-restaurants-nyc",
            "nightlife": f"{self.NYC_URL}/bars/secret-bars-nyc",
            "nature": f"{self.NYC_URL}/things-to-do/best-parks-nyc",
            "museum": f"{self.NYC_URL}/museums/hidden-museums-nyc",
            "shopping": f"{self.NYC_URL}/shopping/best-vintage-shops-nyc",
        }

        url = category_urls.get(category, f"{self.NYC_URL}/things-to-do/secret-new-york")
        locations = self._parse_listicle(url)

        return locations[:limit]


if __name__ == "__main__":
    scraper = TimeoutScraper()

    print("=== Testing Timeout NYC Scraper ===\n")

    print("1. Scraping hidden gems articles:")
    locations = scraper.scrape_hidden_gems(max_articles=2)
    for i, loc in enumerate(locations[:10], 1):
        print(f"  {i}. {loc.name}")
        if loc.neighborhood:
            print(f"      Neighborhood: {loc.neighborhood}")

    print(f"\nTotal locations found: {len(locations)}")

    print("\n2. Searching for restaurants:")
    restaurants = scraper.search_by_category("restaurant", limit=5)
    for i, loc in enumerate(restaurants, 1):
        print(f"  {i}. {loc.name}")
