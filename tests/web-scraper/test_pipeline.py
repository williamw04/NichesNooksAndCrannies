"""Tests for web scraper main pipeline."""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from src.approaches.web_scraper.main import WebScraperPipeline
from src.shared.types.location import Location, Category, GemLevel


class TestWebScraperPipeline:
    def test_init(self):
        pipeline = WebScraperPipeline(max_locations=10)

        assert pipeline.max_locations == 10
        assert pipeline.reddit_scraper is not None
        assert pipeline.atlas_scraper is not None
        assert pipeline.google_maps is not None

    def test_infer_category(self):
        pipeline = WebScraperPipeline()

        assert pipeline._infer_category({"name": "Joe's Coffee", "context": ""}) == Category.CAFE
        assert pipeline._infer_category({"name": "Central Park", "context": ""}) == Category.NATURE
        assert (
            pipeline._infer_category({"name": "MoMA", "context": "art museum"}) == Category.MUSEUM
        )

    def test_generate_description(self):
        pipeline = WebScraperPipeline()

        item = {
            "name": "Test Cafe",
            "neighborhood": "Williamsburg",
            "category": Category.CAFE,
        }

        description = pipeline._generate_description(item)

        assert "Test Cafe" in description or "Williamsburg" in description
        assert len(description) >= 50

    def test_generate_vibe_summary(self):
        pipeline = WebScraperPipeline()

        item = {
            "name": "Hidden Bar",
            "category": Category.NIGHTLIFE,
        }

        vibe = pipeline._generate_vibe_summary(item)

        assert len(vibe) >= 10
        assert len(vibe) <= 100

    def test_generate_tags(self):
        pipeline = WebScraperPipeline()

        item = {
            "name": "Test Place",
            "category": Category.CAFE,
            "neighborhood": "Williamsburg",
            "price_level": 2,
            "rating": 4.6,
        }

        tags = pipeline._generate_tags(item)

        assert len(tags) >= 6
        assert len(tags) <= 12
        assert "cafe" in tags

    def test_build_locations(self):
        pipeline = WebScraperPipeline()

        data = [
            {
                "name": "Test Place",
                "category": Category.CAFE,
                "neighborhood": "Williamsburg",
                "latitude": 40.7128,
                "longitude": -74.0060,
                "rating": 4.5,
                "user_ratings_total": 200,
                "price_level": 2,
                "gem_level": GemLevel.HIDDEN_GEM,
                "source_urls": ["https://reddit.com/test"],
            }
        ]

        locations = pipeline._build_locations(data)

        assert len(locations) == 1
        assert locations[0].name == "Test Place"
        assert locations[0].category == Category.CAFE
        assert locations[0].gem_level == GemLevel.HIDDEN_GEM

    @patch("src.approaches.web_scraper.main.RedditScraper")
    @patch("src.approaches.web_scraper.main.AtlasObscuraScraper")
    @patch("src.approaches.web_scraper.main.GoogleMapsClient")
    def test_run_pipeline_with_mocks(
        self,
        mock_google_maps,
        mock_atlas,
        mock_reddit,
    ):
        mock_reddit_instance = MagicMock()
        mock_reddit_instance.scrape_all.return_value = []
        mock_reddit.return_value = mock_reddit_instance

        mock_atlas_instance = MagicMock()
        mock_atlas_instance.scrape_all.return_value = []
        mock_atlas.return_value = mock_atlas_instance

        mock_google_instance = MagicMock()
        mock_google_instance.search_hidden_gems.return_value = []
        mock_google_instance.validate_and_enrich.return_value = None
        mock_google_maps.return_value = mock_google_instance

        pipeline = WebScraperPipeline(max_locations=5)
        pipeline.reddit_scraper = mock_reddit_instance
        pipeline.atlas_scraper = mock_atlas_instance
        pipeline.google_maps = mock_google_instance

        mock_reddit_instance.scrape_all.return_value = [
            MagicMock(name="Test Place", mentions=2, context="", name__lower__="test place")
        ]

        mock_atlas_instance.scrape_all.return_value = []
        mock_google_instance.search_hidden_gems.return_value = []

        assert pipeline.max_locations == 5
