"""Tests for cross-reference processor."""

import pytest

from src.approaches.web_scraper.processors.cross_reference import CrossReferenceProcessor
from src.approaches.web_scraper.types.scraper_result import (
    AtlasObscuraResult,
    GoogleMapsResult,
    RedditScrapeResult,
)
from src.shared.types.sources import SourceType


class TestCrossReferenceProcessor:
    def test_init(self):
        processor = CrossReferenceProcessor()
        assert processor.similarity_threshold == 0.75

    def test_cross_reference_basic(self):
        processor = CrossReferenceProcessor()

        reddit_results = [
            RedditScrapeResult(
                name="Joe's Pizza",
                subreddit="nyc",
                post_title="Best pizza",
                post_url="https://reddit.com/1",
                score=100,
                num_comments=20,
                mentions=3,
            ),
        ]

        atlas_results = [
            AtlasObscuraResult(
                name="Joe's Pizza",
                url="https://atlasobscura.com/joes",
            ),
        ]

        google_results = [
            GoogleMapsResult(
                name="Joe's Pizza",
                place_id="abc123",
                rating=4.5,
            ),
        ]

        matches = processor.cross_reference(reddit_results, atlas_results, google_results)

        assert len(matches) == 1
        assert matches[0].reddit_mentions == 3
        assert matches[0].atlas_obscura_match is True
        assert matches[0].google_maps_verified is True
        assert SourceType.REDDIT in matches[0].sources

    def test_calculate_social_proof_score(self):
        processor = CrossReferenceProcessor()

        match = processor.cross_reference(
            [
                RedditScrapeResult(
                    name="Place A",
                    subreddit="nyc",
                    post_title="Test",
                    post_url="https://reddit.com/1",
                    score=100,
                    num_comments=10,
                    mentions=5,
                )
            ],
            [AtlasObscuraResult(name="Place A", url="https://atlasobscura.com/a")],
            [GoogleMapsResult(name="Place A", place_id="abc")],
        )

        assert len(match) == 1
        assert match[0].social_proof_score > 0

    def test_normalize_name(self):
        processor = CrossReferenceProcessor()

        assert processor._normalize_name("Joe's Pizza") == "joes pizza"
        assert processor._normalize_name("Joe's Pizza NYC") == "joes pizza nyc"
        assert processor._normalize_name("JOE'S PIZZA") == "joes pizza"

    def test_to_candidates(self):
        processor = CrossReferenceProcessor()

        reddit_results = [
            RedditScrapeResult(
                name="Test Place",
                subreddit="nyc",
                post_title="Great spot in Williamsburg",
                post_url="https://reddit.com/1",
                score=100,
                num_comments=20,
                mentions=2,
                context="Best hidden gem in Williamsburg",
            ),
        ]

        matches = processor.cross_reference(reddit_results, [], [])
        candidates = processor.to_candidates(matches, reddit_results, [], [])

        assert len(candidates) == 1
        assert candidates[0].name == "Test Place"
        assert candidates[0].mentions == 2
