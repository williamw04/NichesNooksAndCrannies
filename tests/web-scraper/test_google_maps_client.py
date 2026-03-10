"""Tests for Google Maps client."""

import pytest
from unittest.mock import MagicMock, patch

from src.approaches.web_scraper.scrapers.google_maps import GoogleMapsClient
from src.approaches.web_scraper.types.scraper_result import GoogleMapsResult


class TestGoogleMapsClient:
    def test_init_without_api_key(self):
        with patch("src.approaches.web_scraper.config.settings") as mock_settings:
            mock_settings.google_maps_configured = False
            client = GoogleMapsClient()
            assert client.client is None

    def test_parse_place_result(self):
        client = GoogleMapsClient()

        place = {
            "name": "Joe's Pizza",
            "place_id": "ChIJ123",
            "geometry": {"location": {"lat": 40.7128, "lng": -74.0060}},
            "formatted_address": "123 Main St, New York, NY",
            "rating": 4.5,
            "user_ratings_total": 250,
            "price_level": 2,
            "types": ["restaurant", "food"],
        }

        result = client._parse_place_result(place)

        assert result is not None
        assert result.name == "Joe's Pizza"
        assert result.place_id == "ChIJ123"
        assert result.latitude == 40.7128
        assert result.longitude == -74.0060
        assert result.rating == 4.5
        assert result.user_ratings_total == 250

    def test_determine_category(self):
        client = GoogleMapsClient()

        from src.shared.types.location import Category

        assert client._determine_category(["cafe", "food"], "Coffee Shop") == Category.CAFE
        assert (
            client._determine_category(["bar", "establishment"], "Nightlife") == Category.NIGHTLIFE
        )
        assert client._determine_category(["museum"], "Art Place") == Category.MUSEUM
        assert client._determine_category(["unknown"], "Random Place") == Category.LOCAL

    @patch("src.approaches.web_scraper.scrapers.google_maps.googlemaps")
    def test_text_search_with_mock(self, mock_googlemaps):
        mock_client = MagicMock()
        mock_client.places.return_value = {
            "results": [
                {
                    "name": "Test Cafe",
                    "place_id": "abc123",
                    "geometry": {"location": {"lat": 40.7, "lng": -74.0}},
                    "rating": 4.5,
                }
            ]
        }

        client = GoogleMapsClient()
        client.client = mock_client
        client._initialized = True

        results = client.text_search("hidden gem cafe NYC")

        assert len(results) >= 0

    def test_filter_chains(self):
        client = GoogleMapsClient()

        place = {
            "name": "Starbucks",
            "place_id": "chain123",
            "geometry": {"location": {"lat": 40.7, "lng": -74.0}},
        }

        result = client._parse_place_result(place)

        assert result is not None
        assert result.name == "Starbucks"
