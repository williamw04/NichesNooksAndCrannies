"""Eater NY scraper for restaurant and cafe discovery."""

import re
import time
from dataclasses import dataclass
from typing import Optional

import requests
from bs4 import BeautifulSoup

from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import RateLimiter


@dataclass
class EaterRestaurant:
    name: str
    description: str
    neighborhood: Optional[str]
    address: Optional[str]
    cuisine: Optional[str]
    price_level: Optional[int]
    url: str


class EaterScraper:
    """Scraper for Eater NY for restaurant discovery."""

    name = "eater"
    BASE_URL = "https://www.eater.com"
    NYC_URL = f"{BASE_URL}/new-york"

    MAP_URLS = [
        f"{NYC_URL}/maps/best-new-restaurants-nyc",
        f"{NYC_URL}/maps/essential-restaurants-nyc",
        f"{NYC_URL}/maps/hidden-gem-restaurants-nyc",
        f"{NYC_URL}/maps/underrated-restaurants-nyc",
        f"{NYC_URL}/maps/best-coffee-shops-nyc",
        f"{NYC_URL}/maps/neighborhood-favorites",
        f"{NYC_URL}/maps/best-bars-nyc-hidden",
    ]

    CUISINE_PATTERNS = {
        "italian": r"italian|pasta|pizza",
        "japanese": r"japanese|sushi|ramen|izakaya",
        "chinese": r"chinese|dim sum|szechuan|cantonese",
        "korean": r"korean|bbq|kimchi",
        "thai": r"thai|pad thai",
        "mexican": r"mexican|taco|quesadilla",
        "american": r"american|burger|steakhouse",
        "french": r"french|bistro|brasserie",
        "mediterranean": r"mediterranean|greek|middle eastern",
        "indian": r"indian|curry|tandoori",
    }

    def __init__(self, rate_limit_per_minute: int = 30):
        self.logger = get_logger("eater_scraper")
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
                    "Failed to fetch Eater page",
                    url=url,
                    status=response.status_code,
                )
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            self.logger.error("Eater page fetch error", url=url, error=str(e))
            return None

    def _extract_price_level(self, text: str) -> Optional[int]:
        """Extract price level from text ($ to $$$$)."""
        dollars = re.search(r"\${1,4}", text)
        if dollars:
            return len(dollars.group())
        return None

    def _guess_cuisine(self, name: str, description: str) -> Optional[str]:
        """Guess cuisine type from name and description."""
        combined = f"{name} {description}".lower()
        for cuisine, pattern in self.CUISINE_PATTERNS.items():
            if re.search(pattern, combined):
                return cuisine
        return None

    def _parse_map_article(self, url: str) -> list[EaterRestaurant]:
        """Parse an Eater map article for restaurant entries."""
        soup = self._fetch_page(url)
        if not soup:
            return []

        restaurants = []

        entries = soup.select(
            "div[data-entry-id], article.entry, .map-item, .restaurant-entry, "
            "section[data-map-item], .c-mapstack__entry"
        )

        if not entries:
            entries = soup.select("div[class*='entry'], section[class*='item']")

        for entry in entries:
            name_elem = entry.select_one(
                "h1, h2, h3, .entry-title, .restaurant-name, "
                "[data-testid='entry-title'], .c-mapstack__entry-title"
            )
            if not name_elem:
                continue

            name = name_elem.get_text(strip=True)
            name = re.sub(r"^\d+\.\s*", "", name)

            if len(name) > 100 or len(name) < 2:
                continue

            desc_elem = entry.select_one(".entry-body, .description, p, .c-mapstack__entry-body")
            description = ""
            if desc_elem:
                paragraphs = desc_elem.find_all("p")
                description = " ".join(p.get_text(strip=True) for p in paragraphs[:2])
                description = description[:500]

            neighborhood = None
            hood_elem = entry.select_one(".neighborhood, .location, .c-mapstack__entry-address")
            if hood_elem:
                hood_text = hood_elem.get_text(strip=True)
                neighborhood = hood_text.split(",")[0].strip()

            address = None
            addr_elem = entry.select_one(".address, .street-address")
            if addr_elem:
                address = addr_elem.get_text(strip=True)

            price = self._extract_price_level(name + description)
            cuisine = self._guess_cuisine(name, description)

            restaurants.append(
                EaterRestaurant(
                    name=name,
                    description=description,
                    neighborhood=neighborhood,
                    address=address,
                    cuisine=cuisine,
                    price_level=price,
                    url=url,
                )
            )

        return restaurants

    def scrape_restaurants(self, max_articles: int = 5) -> list[EaterRestaurant]:
        """Scrape restaurants from Eater NY map articles."""
        all_restaurants = []

        urls_to_scrape = self.MAP_URLS[:max_articles]

        for url in urls_to_scrape:
            self.logger.info("Scraping Eater article", url=url)
            restaurants = self._parse_map_article(url)
            all_restaurants.extend(restaurants)
            time.sleep(1)

        seen = set()
        unique_restaurants = []
        for rest in all_restaurants:
            key = rest.name.lower().strip()
            if key not in seen and len(key) > 2:
                seen.add(key)
                unique_restaurants.append(rest)

        self.logger.info(
            "Eater restaurants scraped",
            total=len(all_restaurants),
            unique=len(unique_restaurants),
        )
        return unique_restaurants

    def search_hidden_gems(self, limit: int = 30) -> list[EaterRestaurant]:
        """Search specifically for hidden gem restaurants."""
        hidden_gem_urls = [url for url in self.MAP_URLS if "hidden" in url or "underrated" in url]

        all_restaurants = []
        for url in hidden_gem_urls:
            restaurants = self._parse_map_article(url)
            all_restaurants.extend(restaurants)
            time.sleep(1)

        seen = set()
        unique_restaurants = []
        for rest in all_restaurants:
            key = rest.name.lower().strip()
            if key not in seen and len(key) > 2:
                seen.add(key)
                unique_restaurants.append(rest)

        return unique_restaurants[:limit]

    def search_by_neighborhood(
        self,
        neighborhood: str,
        limit: int = 20,
    ) -> list[EaterRestaurant]:
        """Search for restaurants in a specific neighborhood."""
        hood_slug = neighborhood.lower().replace(" ", "-")
        url = f"{self.NYC_URL}/maps/best-restaurants-{hood_slug}"

        restaurants = self._parse_map_article(url)
        return restaurants[:limit]


if __name__ == "__main__":
    scraper = EaterScraper()

    print("=== Testing Eater NY Scraper ===\n")

    print("1. Scraping restaurant maps:")
    restaurants = scraper.scrape_restaurants(max_articles=2)
    for i, rest in enumerate(restaurants[:10], 1):
        print(f"  {i}. {rest.name}")
        if rest.cuisine:
            print(f"      Cuisine: {rest.cuisine}")

    print(f"\nTotal restaurants found: {len(restaurants)}")

    print("\n2. Searching for hidden gems:")
    gems = scraper.search_hidden_gems(limit=5)
    for i, rest in enumerate(gems, 1):
        print(f"  {i}. {rest.name}")
