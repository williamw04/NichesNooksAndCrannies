"""Deduplication processor."""

from typing import Optional

from src.approaches.web_scraper.types.scraper_result import (
    AtlasObscuraResult,
    GoogleMapsResult,
    RedditScrapeResult,
)
from src.shared.services.logger import get_logger
from src.shared.types.location import Category, Location, LocationCandidate
from src.shared.utils.deduplication import (
    deduplicate_locations,
    locations_match,
    merge_location_data,
)

logger = get_logger(__name__)


class DeduplicationProcessor:
    def __init__(self, similarity_threshold: float = 0.85):
        self.similarity_threshold = similarity_threshold

    def deduplicate_candidates(
        self, candidates: list[LocationCandidate]
    ) -> list[LocationCandidate]:
        if not candidates:
            return []

        unique = [candidates[0]]

        for candidate in candidates[1:]:
            is_duplicate = False
            for existing in unique:
                if locations_match(
                    candidate.name,
                    existing.name,
                    candidate.address,
                    existing.address,
                    self.similarity_threshold,
                ):
                    is_duplicate = True

                    existing.mentions += candidate.mentions
                    existing.source_urls.extend(candidate.source_urls)
                    existing.source_urls = list(set(existing.source_urls))

                    if not existing.neighborhood and candidate.neighborhood:
                        existing.neighborhood = candidate.neighborhood
                    if not existing.category and candidate.category:
                        existing.category = candidate.category
                    if not existing.address and candidate.address:
                        existing.address = candidate.address
                    if not existing.context and candidate.context:
                        existing.context = candidate.context

                    break

            if not is_duplicate:
                unique.append(candidate)

        logger.info("Deduplication complete", input_count=len(candidates), output_count=len(unique))

        return unique

    def deduplicate_reddit_results(
        self, results: list[RedditScrapeResult]
    ) -> list[RedditScrapeResult]:
        if not results:
            return []

        seen_names: set[str] = set()
        unique = []

        for result in results:
            normalized = result.name.lower().strip()
            if normalized not in seen_names:
                seen_names.add(normalized)
                unique.append(result)
            else:
                for existing in unique:
                    if existing.name.lower().strip() == normalized:
                        existing.mentions += result.mentions
                        existing.score = max(existing.score, result.score)
                        break

        return unique

    def deduplicate_atlas_results(
        self, results: list[AtlasObscuraResult]
    ) -> list[AtlasObscuraResult]:
        if not results:
            return []

        seen_names: set[str] = set()
        unique = []

        for result in results:
            normalized = result.name.lower().strip()
            if normalized not in seen_names:
                seen_names.add(normalized)
                unique.append(result)

        return unique

    def deduplicate_google_results(self, results: list[GoogleMapsResult]) -> list[GoogleMapsResult]:
        if not results:
            return []

        seen_place_ids: set[str] = set()
        seen_names: set[str] = set()
        unique = []

        for result in results:
            if result.place_id in seen_place_ids:
                continue

            normalized = result.name.lower().strip()
            if normalized in seen_names:
                continue

            seen_place_ids.add(result.place_id)
            seen_names.add(normalized)
            unique.append(result)

        return unique

    def deduplicate_locations(self, locations: list[Location]) -> list[Location]:
        if not locations:
            return []

        unique = [locations[0]]

        for location in locations[1:]:
            is_duplicate = False
            for existing in unique:
                if locations_match(
                    location.name,
                    existing.name,
                    location.address,
                    existing.address,
                    self.similarity_threshold,
                ):
                    is_duplicate = True
                    break

            if not is_duplicate:
                unique.append(location)

        logger.info(
            "Location deduplication complete", input_count=len(locations), output_count=len(unique)
        )

        return unique

    def merge_candidates(
        self,
        candidates: list[LocationCandidate],
        reddit_results: list[RedditScrapeResult],
        atlas_results: list[AtlasObscuraResult],
        google_results: list[GoogleMapsResult],
    ) -> list[dict]:
        merged = []

        reddit_map = {r.name.lower().strip(): r for r in reddit_results}
        atlas_map = {r.name.lower().strip(): r for r in atlas_results}
        google_map = {r.name.lower().strip(): r for r in google_results}

        for candidate in candidates:
            normalized = candidate.name.lower().strip()

            data = {
                "name": candidate.name,
                "category": candidate.category,
                "neighborhood": candidate.neighborhood,
                "address": candidate.address,
                "source_urls": candidate.source_urls,
                "reddit_mentions": candidate.mentions,
                "context": candidate.context,
            }

            if normalized in reddit_map:
                reddit_data = reddit_map[normalized]
                data["reddit_url"] = reddit_data.post_url
                data["reddit_score"] = reddit_data.score
                data["reddit_subreddit"] = reddit_data.subreddit

            if normalized in atlas_map:
                atlas_data = atlas_map[normalized]
                if not data.get("category"):
                    data["category"] = atlas_data.category
                if not data.get("neighborhood"):
                    data["neighborhood"] = atlas_data.neighborhood
                if not data.get("address"):
                    data["address"] = atlas_data.address
                data["atlas_url"] = atlas_data.url
                data["atlas_description"] = atlas_data.description
                data["latitude"] = atlas_data.latitude
                data["longitude"] = atlas_data.longitude

            if normalized in google_map:
                google_data = google_map[normalized]
                data["place_id"] = google_data.place_id
                if not data.get("category"):
                    data["category"] = google_data.category
                if not data.get("neighborhood"):
                    data["neighborhood"] = google_data.neighborhood
                if not data.get("address"):
                    data["address"] = google_data.address
                data["latitude"] = data.get("latitude") or google_data.latitude
                data["longitude"] = data.get("longitude") or google_data.longitude
                data["rating"] = google_data.rating
                data["user_ratings_total"] = google_data.user_ratings_total
                data["price_level"] = google_data.price_level
                data["google_maps_url"] = google_data.google_maps_url
                data["website"] = google_data.website
                data["photo_url"] = google_data.photo_url

            merged.append(data)

        return merged
