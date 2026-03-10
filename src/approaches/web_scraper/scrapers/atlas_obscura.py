"""Atlas Obscura web scraper."""

import re
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup

from src.approaches.web_scraper.config import ATLAS_OBSCURA_CONFIG, KEYWORD_CATEGORY_MAPPING
from src.approaches.web_scraper.types.scraper_result import AtlasObscuraResult
from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import RateLimiter
from src.shared.types.location import Category

logger = get_logger(__name__)


class AtlasObscuraScraper:
    def __init__(self):
        self.base_url = ATLAS_OBSCURA_CONFIG["base_url"]
        self.rate_limiter = RateLimiter(requests_per_minute=30)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        )

    def scrape_things_to_do(self, max_pages: int = 5) -> list[AtlasObscuraResult]:
        results = []
        url = ATLAS_OBSCURA_CONFIG["nyc_things_to_do"]

        logger.info("Starting Atlas Obscura scrape", url=url, max_pages=max_pages)

        for page in range(1, max_pages + 1):
            page_url = f"{url}?page={page}" if page > 1 else url

            try:
                self.rate_limiter.wait("atlas_obscura")
                response = self.session.get(page_url, timeout=30)
                response.raise_for_status()

                soup = BeautifulSoup(response.text, "lxml")
                page_results = self._parse_listings_page(soup)
                results.extend(page_results)

                logger.debug("Scraped Atlas Obscura page", page=page, results=len(page_results))

                if not page_results:
                    break

            except Exception as e:
                logger.error("Failed to scrape Atlas Obscura page", page=page, error=str(e))
                break

        logger.info("Atlas Obscura scrape complete", total_results=len(results))
        return results

    def _parse_listings_page(self, soup: BeautifulSoup) -> list[AtlasObscuraResult]:
        results = []

        cards = soup.find_all("div", class_="index-card-wrap") or soup.find_all(
            "article", class_="place-card"
        )

        if not cards:
            cards = soup.find_all("a", href=re.compile(r"/places/"))

        for card in cards:
            result = self._parse_card(card)
            if result:
                results.append(result)

        return results

    def _parse_card(self, card) -> Optional[AtlasObscuraResult]:
        try:
            name_elem = card.find("h3") or card.find("h2") or card.find("a")
            if not name_elem:
                return None

            name = name_elem.get_text(strip=True)
            if not name or len(name) < 3:
                return None

            link_elem = card.find("a", href=True) if card.name != "a" else card
            href = link_elem.get("href", "") if link_elem else ""

            if not href.startswith("http"):
                url = (
                    f"{self.base_url}{href}" if href.startswith("/") else f"{self.base_url}/{href}"
                )
            else:
                url = href

            description = None
            desc_elem = card.find("p", class_="description") or card.find("p", class_="subtitle")
            if desc_elem:
                description = desc_elem.get_text(strip=True)

            lat, lng = self._extract_coordinates(card)

            address = None
            addr_elem = card.find("span", class_="address") or card.find("div", class_="location")
            if addr_elem:
                address = addr_elem.get_text(strip=True)

            category = self._infer_category(name, description or "")

            return AtlasObscuraResult(
                name=name,
                description=description,
                category=category,
                latitude=lat,
                longitude=lng,
                address=address,
                url=url,
            )

        except Exception as e:
            logger.debug("Failed to parse Atlas Obscura card", error=str(e))
            return None

    def _extract_coordinates(self, element) -> tuple[Optional[float], Optional[float]]:
        lat, lng = None, None

        data_lat = element.get("data-lat")
        data_lng = element.get("data-lng")

        if data_lat and data_lng:
            try:
                lat = float(data_lat)
                lng = float(data_lng)
                return lat, lng
            except ValueError:
                pass

        map_link = element.find("a", href=re.compile(r"maps\.google"))
        if map_link:
            href = map_link.get("href", "")
            coord_match = re.search(r"q=(-?\d+\.?\d*),(-?\d+\.?\d*)", href)
            if coord_match:
                try:
                    lat = float(coord_match.group(1))
                    lng = float(coord_match.group(2))
                    return lat, lng
                except ValueError:
                    pass

        return lat, lng

    def _infer_category(self, name: str, description: str) -> Optional[Category]:
        text = f"{name} {description}".lower()

        for keyword, category in KEYWORD_CATEGORY_MAPPING.items():
            if keyword in text:
                return category

        if any(word in text for word in ["museum", "gallery", "exhibit", "collection"]):
            return Category.MUSEUM
        if any(word in text for word in ["historic", "landmark", "monument", "memorial"]):
            return Category.HISTORICAL
        if any(word in text for word in ["park", "garden", "nature", "trail"]):
            return Category.NATURE
        if any(word in text for word in ["cafe", "coffee", "bakery"]):
            return Category.CAFE
        if any(word in text for word in ["restaurant", "diner", "eatery"]):
            return Category.RESTAURANT
        if any(word in text for word in ["bar", "pub", "brewery", "club"]):
            return Category.NIGHTLIFE
        if any(word in text for word in ["shop", "store", "market"]):
            return Category.SHOPPING

        return Category.LOCAL

    def get_place_details(self, url: str) -> Optional[AtlasObscuraResult]:
        try:
            self.rate_limiter.wait("atlas_obscura")
            response = self.session.get(url, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "lxml")
            return self._parse_detail_page(soup, url)

        except Exception as e:
            logger.error("Failed to get Atlas Obscura place details", url=url, error=str(e))
            return None

    def _parse_detail_page(self, soup: BeautifulSoup, url: str) -> Optional[AtlasObscuraResult]:
        try:
            title_elem = soup.find("h1")
            if not title_elem:
                return None

            name = title_elem.get_text(strip=True)

            description = None
            desc_elem = soup.find("div", class_="description") or soup.find("div", class_="content")
            if desc_elem:
                paragraphs = desc_elem.find_all("p")
                description = " ".join(p.get_text(strip=True) for p in paragraphs[:2])

            lat, lng = None, None

            map_div = soup.find("div", class_="map") or soup.find("div", id="map")
            if map_div:
                lat = map_div.get("data-lat")
                lng = map_div.get("data-lng")
                if lat and lng:
                    try:
                        lat = float(lat)
                        lng = float(lng)
                    except ValueError:
                        lat, lng = None, None

            address = None
            addr_elem = soup.find("span", class_="address") or soup.find(
                "div", class_="location-address"
            )
            if addr_elem:
                address = addr_elem.get_text(strip=True)

            category = self._infer_category(name, description or "")

            return AtlasObscuraResult(
                name=name,
                description=description,
                category=category,
                latitude=lat,
                longitude=lng,
                address=address,
                url=url,
            )

        except Exception as e:
            logger.error("Failed to parse Atlas Obscura detail page", error=str(e))
            return None

    def scrape_all(self) -> list[AtlasObscuraResult]:
        return self.scrape_things_to_do(max_pages=ATLAS_OBSCURA_CONFIG["max_pages"])
