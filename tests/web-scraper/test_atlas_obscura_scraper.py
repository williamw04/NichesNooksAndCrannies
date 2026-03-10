"""Tests for Atlas Obscura scraper."""

import pytest
from unittest.mock import MagicMock, patch

from src.approaches.web_scraper.scrapers.atlas_obscura import AtlasObscuraScraper
from src.approaches.web_scraper.types.scraper_result import AtlasObscuraResult


class TestAtlasObscuraScraper:
    def test_init(self):
        scraper = AtlasObscuraScraper()
        assert scraper.session is not None
        assert scraper.rate_limiter is not None

    def test_infer_category(self):
        scraper = AtlasObscuraScraper()

        from src.shared.types.location import Category

        assert (
            scraper._infer_category("The Met Museum", "Art gallery in Manhattan") == Category.MUSEUM
        )
        assert scraper._infer_category("Central Park", "Beautiful nature spot") == Category.NATURE
        assert scraper._infer_category("Joe's Coffee", "Best cafe in town") == Category.CAFE
        assert scraper._infer_category("Secret Bar", "Hidden speakeasy") == Category.NIGHTLIFE

    def test_extract_coordinates_from_data_attrs(self):
        scraper = AtlasObscuraScraper()

        mock_element = MagicMock()
        mock_element.get = MagicMock(
            side_effect=lambda x: {
                "data-lat": "40.7128",
                "data-lng": "-74.0060",
            }.get(x)
        )

        lat, lng = scraper._extract_coordinates(mock_element)

        assert lat == 40.7128
        assert lng == -74.0060

    def test_parse_card_minimal(self):
        scraper = AtlasObscuraScraper()

        from bs4 import BeautifulSoup

        html = """
        <div class="index-card-wrap">
            <h3>Secret Garden NYC</h3>
            <a href="/places/secret-garden">Learn more</a>
        </div>
        """

        soup = BeautifulSoup(html, "lxml")
        card = soup.find("div")

        result = scraper._parse_card(card)

        assert result is not None
        assert result.name == "Secret Garden NYC"
        assert "atlasobscura.com" in result.url

    @patch("src.approaches.web_scraper.scrapers.atlas_obscura.requests.Session")
    def test_scrape_things_to_do_with_mock(self, mock_session_class):
        mock_session = MagicMock()
        mock_response = MagicMock()
        mock_response.text = """
        <html>
            <body>
                <div class="index-card-wrap">
                    <h3>Test Place</h3>
                    <a href="/places/test">Link</a>
                </div>
            </body>
        </html>
        """
        mock_response.raise_for_status = MagicMock()
        mock_session.get.return_value = mock_response
        mock_session_class.return_value = mock_session

        scraper = AtlasObscuraScraper()

        results = scraper.scrape_things_to_do(max_pages=1)

        assert isinstance(results, list)
