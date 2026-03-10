"""Tests for gem classifier."""

import pytest

from src.approaches.web_scraper.processors.gem_classifier import GemClassifier
from src.shared.types.location import GemLevel


class TestGemClassifier:
    def test_init(self):
        classifier = GemClassifier()
        assert classifier.max_reviews_hidden_gem == 500
        assert classifier.max_reviews_local_favorite == 1000

    def test_classify_hidden_gem(self):
        classifier = GemClassifier()

        level = classifier.classify(
            review_count=150,
            reddit_mentions=3,
            atlas_match=True,
            google_verified=True,
        )

        assert level == GemLevel.HIDDEN_GEM

    def test_classify_local_favorite(self):
        classifier = GemClassifier()

        level = classifier.classify(
            review_count=750,
            reddit_mentions=2,
            atlas_match=True,
            google_verified=True,
        )

        assert level == GemLevel.LOCAL_FAVORITE

    def test_classify_iconic(self):
        classifier = GemClassifier()

        level = classifier.classify(
            review_count=5000,
            reddit_mentions=10,
            atlas_match=True,
            google_verified=True,
        )

        assert level == GemLevel.ICONIC

    def test_classify_with_no_reviews(self):
        classifier = GemClassifier()

        level = classifier.classify(
            review_count=None,
            reddit_mentions=5,
            atlas_match=True,
        )

        assert level == GemLevel.HIDDEN_GEM

    def test_calculate_social_proof(self):
        classifier = GemClassifier()

        score = classifier._calculate_social_proof(
            reddit_mentions=5,
            atlas_match=True,
            google_verified=True,
        )

        assert score >= 5

    def test_classify_batch(self):
        classifier = GemClassifier()

        locations = [
            {
                "name": "Hidden Cafe",
                "user_ratings_total": 200,
                "reddit_mentions": 3,
                "atlas_url": "https://atlasobscura.com/hidden",
                "place_id": "abc123",
            },
            {
                "name": "Popular Spot",
                "user_ratings_total": 2000,
                "reddit_mentions": 5,
            },
        ]

        classified = classifier.classify_batch(locations)

        assert len(classified) == 2
        assert classified[0]["gem_level"] == GemLevel.HIDDEN_GEM
        assert classified[1]["gem_level"] == GemLevel.ICONIC

    def test_get_distribution(self):
        classifier = GemClassifier()

        locations = [
            {"gem_level": GemLevel.ICONIC},
            {"gem_level": GemLevel.ICONIC},
            {"gem_level": GemLevel.LOCAL_FAVORITE},
            {"gem_level": GemLevel.HIDDEN_GEM},
            {"gem_level": GemLevel.HIDDEN_GEM},
        ]

        distribution = classifier.get_distribution(locations)

        assert distribution[GemLevel.ICONIC] == 2
        assert distribution[GemLevel.LOCAL_FAVORITE] == 1
        assert distribution[GemLevel.HIDDEN_GEM] == 2

    def test_validate_distribution(self):
        classifier = GemClassifier()

        locations = (
            [{"gem_level": GemLevel.ICONIC} for _ in range(8)]
            + [{"gem_level": GemLevel.LOCAL_FAVORITE} for _ in range(17)]
            + [{"gem_level": GemLevel.HIDDEN_GEM} for _ in range(25)]
        )

        status = classifier.validate_distribution(locations, total_target=50)

        assert status["current"][GemLevel.ICONIC] == 8
        assert status["current"][GemLevel.LOCAL_FAVORITE] == 17
        assert status["current"][GemLevel.HIDDEN_GEM] == 25

    def test_adjust_for_distribution(self):
        classifier = GemClassifier()

        locations = [
            {
                "name": f"Place {i}",
                "gem_level": GemLevel.HIDDEN_GEM,
                "social_proof_score": 5,
                "rating": 4.5,
            }
            for i in range(100)
        ]

        adjusted = classifier.adjust_for_distribution(locations, target_total=50)

        assert len(adjusted) <= 50
