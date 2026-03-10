"""Gem level classification processor."""

from typing import Optional

from src.shared.services.logger import get_logger
from src.shared.types.location import GemLevel
from src.shared.utils.validation import determine_gem_level

logger = get_logger(__name__)


class GemClassifier:
    def __init__(
        self,
        max_reviews_hidden_gem: int = 500,
        max_reviews_local_favorite: int = 1000,
        min_rating: float = 4.0,
    ):
        self.max_reviews_hidden_gem = max_reviews_hidden_gem
        self.max_reviews_local_favorite = max_reviews_local_favorite
        self.min_rating = min_rating

    def classify(
        self,
        review_count: Optional[int],
        reddit_mentions: int,
        atlas_match: bool = False,
        google_verified: bool = False,
        rating: Optional[float] = None,
    ) -> GemLevel:
        social_proof_score = self._calculate_social_proof(
            reddit_mentions, atlas_match, google_verified
        )

        level_value = determine_gem_level(review_count, social_proof_score)

        return GemLevel(level_value)

    def _calculate_social_proof(
        self,
        reddit_mentions: int,
        atlas_match: bool,
        google_verified: bool,
    ) -> int:
        score = 0

        if reddit_mentions >= 5:
            score += 3
        elif reddit_mentions >= 3:
            score += 2
        elif reddit_mentions >= 1:
            score += 1

        if atlas_match:
            score += 2

        if google_verified:
            score += 1

        return score

    def classify_batch(self, locations: list[dict]) -> list[dict]:
        classified = []

        for location in locations:
            location_copy = location.copy()

            review_count = location.get("user_ratings_total")
            reddit_mentions = location.get("reddit_mentions", 0)
            atlas_match = bool(location.get("atlas_url"))
            google_verified = bool(location.get("place_id"))
            rating = location.get("rating")

            gem_level = self.classify(
                review_count=review_count,
                reddit_mentions=reddit_mentions,
                atlas_match=atlas_match,
                google_verified=google_verified,
                rating=rating,
            )

            location_copy["gem_level"] = gem_level
            location_copy["social_proof_score"] = self._calculate_social_proof(
                reddit_mentions, atlas_match, google_verified
            )

            classified.append(location_copy)

        logger.info("Gem classification complete", total=len(classified))

        return classified

    def get_distribution(self, locations: list[dict]) -> dict[GemLevel, int]:
        distribution = {GemLevel.ICONIC: 0, GemLevel.LOCAL_FAVORITE: 0, GemLevel.HIDDEN_GEM: 0}

        for location in locations:
            gem_level = location.get("gem_level")
            if isinstance(gem_level, GemLevel):
                distribution[gem_level] += 1
            elif isinstance(gem_level, int):
                distribution[GemLevel(gem_level)] += 1

        return distribution

    def validate_distribution(self, locations: list[dict], total_target: int = 50) -> dict:
        distribution = self.get_distribution(locations)

        target_distribution = {
            GemLevel.ICONIC: int(total_target * 0.15),
            GemLevel.LOCAL_FAVORITE: int(total_target * 0.35),
            GemLevel.HIDDEN_GEM: int(total_target * 0.50),
        }

        status = {
            "current": distribution,
            "target": target_distribution,
            "needs_more": {},
            "needs_less": {},
        }

        for level in GemLevel:
            current = distribution[level]
            target = target_distribution[level]

            if current < target:
                status["needs_more"][level] = target - current
            elif current > target:
                status["needs_less"][level] = current - target

        return status

    def adjust_for_distribution(
        self,
        locations: list[dict],
        target_total: int = 50,
    ) -> list[dict]:
        current_total = len(locations)

        if current_total <= target_total:
            return locations

        status = self.validate_distribution(locations, target_total)

        sorted_locations = sorted(
            locations,
            key=lambda x: (
                -x.get("social_proof_score", 0),
                -x.get("rating", 0) or 0,
                -(x.get("user_ratings_total") or 0),
            ),
        )

        adjusted = []
        gem_counts = {GemLevel.ICONIC: 0, GemLevel.LOCAL_FAVORITE: 0, GemLevel.HIDDEN_GEM: 0}
        targets = {
            GemLevel.ICONIC: int(target_total * 0.15),
            GemLevel.LOCAL_FAVORITE: int(target_total * 0.35),
            GemLevel.HIDDEN_GEM: int(target_total * 0.50),
        }

        for location in sorted_locations:
            gem_level = location.get("gem_level")
            if isinstance(gem_level, int):
                gem_level = GemLevel(gem_level)

            if gem_counts[gem_level] < targets[gem_level]:
                adjusted.append(location)
                gem_counts[gem_level] += 1

        remaining_slots = target_total - len(adjusted)
        if remaining_slots > 0:
            for location in sorted_locations:
                if location not in adjusted and remaining_slots > 0:
                    adjusted.append(location)
                    remaining_slots -= 1

        logger.info(
            "Distribution adjustment complete",
            input_count=len(locations),
            output_count=len(adjusted),
            distribution=self.get_distribution(adjusted),
        )

        return adjusted[:target_total]
