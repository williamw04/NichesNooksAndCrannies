"""Cross-reference processor for matching locations across sources."""

from collections import defaultdict
from typing import Optional

from src.approaches.web_scraper.types.scraper_result import (
    AtlasObscuraResult,
    GoogleMapsResult,
    RedditScrapeResult,
)
from src.shared.services.logger import get_logger
from src.shared.types.location import Category, LocationCandidate
from src.shared.types.sources import SourceMatch, SourceType
from src.shared.utils.deduplication import calculate_name_similarity

logger = get_logger(__name__)


class CrossReferenceProcessor:
    def __init__(self, similarity_threshold: float = 0.75):
        self.similarity_threshold = similarity_threshold

    def cross_reference(
        self,
        reddit_results: list[RedditScrapeResult],
        atlas_results: list[AtlasObscuraResult],
        google_results: list[GoogleMapsResult],
    ) -> list[SourceMatch]:
        matches: dict[str, SourceMatch] = {}

        for result in reddit_results:
            normalized = self._normalize_name(result.name)
            if normalized not in matches:
                matches[normalized] = SourceMatch(
                    name=result.name,
                    sources=[SourceType.REDDIT],
                    reddit_mentions=result.mentions,
                )
            else:
                matches[normalized].reddit_mentions += result.mentions
                if SourceType.REDDIT not in matches[normalized].sources:
                    matches[normalized].sources.append(SourceType.REDDIT)

        for result in atlas_results:
            normalized = self._normalize_name(result.name)
            matched_key = self._find_match(normalized, matches)

            if matched_key:
                matches[matched_key].atlas_obscura_match = True
                if SourceType.ATLAS_OBSCURA not in matches[matched_key].sources:
                    matches[matched_key].sources.append(SourceType.ATLAS_OBSCURA)
            else:
                matches[normalized] = SourceMatch(
                    name=result.name,
                    sources=[SourceType.ATLAS_OBSCURA],
                    atlas_obscura_match=True,
                )

        for result in google_results:
            normalized = self._normalize_name(result.name)
            matched_key = self._find_match(normalized, matches)

            if matched_key:
                matches[matched_key].google_maps_verified = True
                if SourceType.GOOGLE_MAPS not in matches[matched_key].sources:
                    matches[matched_key].sources.append(SourceType.GOOGLE_MAPS)
            else:
                matches[normalized] = SourceMatch(
                    name=result.name,
                    sources=[SourceType.GOOGLE_MAPS],
                    google_maps_verified=True,
                )

        for match in matches.values():
            match.social_proof_score = self._calculate_social_proof_score(match)

        sorted_matches = sorted(
            matches.values(),
            key=lambda m: (m.social_proof_score, m.reddit_mentions),
            reverse=True,
        )

        logger.info(
            "Cross-reference complete",
            total_matches=len(sorted_matches),
            with_multiple_sources=sum(1 for m in sorted_matches if len(m.sources) > 1),
        )

        return sorted_matches

    def _normalize_name(self, name: str) -> str:
        normalized = name.lower().strip()
        for char in ["'", '"', "-", "&"]:
            normalized = normalized.replace(char, " ")
        normalized = " ".join(normalized.split())
        return normalized

    def _find_match(self, normalized_name: str, matches: dict[str, SourceMatch]) -> Optional[str]:
        if normalized_name in matches:
            return normalized_name

        for existing_name, match in matches.items():
            similarity = calculate_name_similarity(normalized_name, existing_name)
            if similarity >= self.similarity_threshold:
                return existing_name

        return None

    def _calculate_social_proof_score(self, match: SourceMatch) -> int:
        score = 0

        if match.reddit_mentions >= 3:
            score += 3
        elif match.reddit_mentions >= 2:
            score += 2
        elif match.reddit_mentions >= 1:
            score += 1

        if match.atlas_obscura_match:
            score += 2

        if match.google_maps_verified:
            score += 1

        if len(match.sources) >= 3:
            score += 2
        elif len(match.sources) >= 2:
            score += 1

        return score

    def to_candidates(
        self,
        matches: list[SourceMatch],
        reddit_results: list[RedditScrapeResult],
        atlas_results: list[AtlasObscuraResult],
        google_results: list[GoogleMapsResult],
    ) -> list[LocationCandidate]:
        candidates = []

        reddit_by_name = {self._normalize_name(r.name): r for r in reddit_results}
        atlas_by_name = {self._normalize_name(r.name): r for r in atlas_results}
        google_by_name = {self._normalize_name(r.name): r for r in google_results}

        for match in matches:
            candidate = LocationCandidate(
                name=match.name,
                source_urls=[],
                mentions=match.reddit_mentions,
            )

            normalized = self._normalize_name(match.name)

            if normalized in reddit_by_name:
                reddit_result = reddit_by_name[normalized]
                candidate.source_urls.append(reddit_result.post_url)
                candidate.context = reddit_result.context
                candidate.neighborhood = self._extract_neighborhood_from_context(
                    reddit_result.context or ""
                )

            if normalized in atlas_by_name:
                atlas_result = atlas_by_name[normalized]
                candidate.source_urls.append(atlas_result.url)
                candidate.category = atlas_result.category
                candidate.neighborhood = candidate.neighborhood or atlas_result.neighborhood
                if atlas_result.address and not candidate.address:
                    candidate.address = atlas_result.address

            if normalized in google_by_name:
                google_result = google_by_name[normalized]
                candidate.category = candidate.category or google_result.category
                candidate.neighborhood = candidate.neighborhood or google_result.neighborhood
                if google_result.address and not candidate.address:
                    candidate.address = google_result.address

            candidates.append(candidate)

        return candidates

    def _extract_neighborhood_from_context(self, context: str) -> Optional[str]:
        if not context:
            return None

        neighborhoods = [
            "Williamsburg",
            "Bushwick",
            "Greenpoint",
            "DUMBO",
            "Brooklyn Heights",
            "Park Slope",
            "Carroll Gardens",
            "Cobble Hill",
            "Boerum Hill",
            "SoHo",
            "TriBeCa",
            "NoHo",
            "NoLita",
            "DUMBO",
            "East Village",
            "West Village",
            "Greenwich Village",
            "Lower East Side",
            "Upper East Side",
            "Upper West Side",
            "Harlem",
            "Washington Heights",
            "Astoria",
            "Long Island City",
            "Flushing",
            "Forest Hills",
            "Midtown",
            "Financial District",
            "Chinatown",
            "Little Italy",
        ]

        context_lower = context.lower()
        for neighborhood in neighborhoods:
            if neighborhood.lower() in context_lower:
                return neighborhood

        return None
