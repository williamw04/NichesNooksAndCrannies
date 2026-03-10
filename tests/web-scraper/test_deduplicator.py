"""Tests for deduplication processor."""

import pytest

from src.approaches.web_scraper.processors.deduplicator import DeduplicationProcessor
from src.approaches.web_scraper.types.scraper_result import (
    AtlasObscuraResult,
    GoogleMapsResult,
    RedditScrapeResult,
)
from src.shared.types.location import LocationCandidate, Location, Category, GemLevel


class TestDeduplicationProcessor:
    def test_init(self):
        processor = DeduplicationProcessor()
        assert processor.similarity_threshold == 0.85

    def test_deduplicate_candidates(self):
        processor = DeduplicationProcessor()

        candidates = [
            LocationCandidate(name="Joe's Pizza", mentions=2),
            LocationCandidate(name="Joe's Pizza", mentions=1),
            LocationCandidate(name="Lucali's", mentions=3),
        ]

        unique = processor.deduplicate_candidates(candidates)

        assert len(unique) == 2
        joes = next(c for c in unique if "joe" in c.name.lower())
        assert joes.mentions == 3

    def test_deduplicate_reddit_results(self):
        processor = DeduplicationProcessor()

        results = [
            RedditScrapeResult(
                name="Place A",
                subreddit="nyc",
                post_title="Test",
                post_url="https://reddit.com/1",
                score=100,
                num_comments=10,
            ),
            RedditScrapeResult(
                name="place a",
                subreddit="nyc",
                post_title="Test",
                post_url="https://reddit.com/2",
                score=50,
                num_comments=5,
            ),
        ]

        unique = processor.deduplicate_reddit_results(results)

        assert len(unique) == 1

    def test_deduplicate_google_results(self):
        processor = DeduplicationProcessor()

        results = [
            GoogleMapsResult(name="Place A", place_id="abc123", rating=4.5),
            GoogleMapsResult(name="Place A", place_id="abc123", rating=4.5),
            GoogleMapsResult(name="Place B", place_id="def456", rating=4.0),
        ]

        unique = processor.deduplicate_google_results(results)

        assert len(unique) == 2

    def test_merge_candidates(self):
        processor = DeduplicationProcessor()

        candidates = [
            LocationCandidate(
                name="Test Place",
                source_urls=["https://reddit.com/1"],
                mentions=3,
            ),
        ]

        reddit_results = [
            RedditScrapeResult(
                name="Test Place",
                subreddit="nyc",
                post_title="Great spot",
                post_url="https://reddit.com/1",
                score=100,
                num_comments=20,
                mentions=3,
            ),
        ]

        atlas_results = [
            AtlasObscuraResult(
                name="Test Place",
                url="https://atlasobscura.com/test",
                description="Amazing hidden gem",
            ),
        ]

        google_results = [
            GoogleMapsResult(
                name="Test Place",
                place_id="abc123",
                rating=4.5,
                user_ratings_total=200,
            ),
        ]

        merged = processor.merge_candidates(
            candidates, reddit_results, atlas_results, google_results
        )

        assert len(merged) == 1
        assert merged[0]["reddit_mentions"] == 3
        assert merged[0]["atlas_url"] == "https://atlasobscura.com/test"
        assert merged[0]["place_id"] == "abc123"
        assert merged[0]["rating"] == 4.5

    def test_deduplicate_locations(self):
        processor = DeduplicationProcessor()

        locations = [
            Location(
                name="Place A",
                description="A great place",
                category=Category.CAFE,
                tags=["coffee", "nyc"],
                ai_vibe_summary="Cozy neighborhood spot",
                gem_level=GemLevel.HIDDEN_GEM,
            ),
            Location(
                name="Place A",
                description="Another description",
                category=Category.CAFE,
                tags=["coffee", "brooklyn"],
                ai_vibe_summary="Hidden gem",
                gem_level=GemLevel.HIDDEN_GEM,
            ),
        ]

        unique = processor.deduplicate_locations(locations)

        assert len(unique) == 1
