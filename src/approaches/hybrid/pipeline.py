"""Hybrid approach pipeline orchestration."""

import json
from pathlib import Path

from src.approaches.ai_agent.agents.enrichment import EnrichmentAgent
from src.approaches.ai_agent.agents.social_proof import SocialProofAgent
from src.approaches.ai_agent.agents.validation import ValidationAgent
from src.approaches.web_scraper.scrapers.atlas_obscura import AtlasObscuraScraper
from src.approaches.web_scraper.scrapers.google_maps import GoogleMapsClient
from src.approaches.web_scraper.scrapers.reddit import RedditScraper
from src.shared.services.logger import get_logger
from src.shared.types.location import Location
from src.shared.types.output import write_locations_csv
from src.shared.utils.deduplication import deduplicate_locations
from src.shared.utils.validation import determine_gem_level, is_chain

logger = get_logger("hybrid.pipeline")


class HybridPipeline:
    def __init__(self, max_locations: int = 50):
        self.max_locations = max_locations

        self.reddit_scraper = RedditScraper()
        self.atlas_scraper = AtlasObscuraScraper()
        self.gmaps_client = GoogleMapsClient()

        self.validation_agent = ValidationAgent()
        self.social_proof_agent = SocialProofAgent()
        self.enrichment_agent = EnrichmentAgent()

    def run(self, output_path: Path) -> list[Location]:
        logger.info("Starting hybrid pipeline", max_locations=self.max_locations)

        logger.info("Phase 1: Web Scraping")
        reddit_results = self._scrape_reddit()
        atlas_results = self._scrape_atlas_obscura()

        all_candidates = reddit_results + atlas_results
        logger.info("Scraping complete", total_candidates=len(all_candidates))

        all_candidates = deduplicate_locations(all_candidates, key="name")
        logger.info("After deduplication", unique_candidates=len(all_candidates))

        logger.info("Phase 2: AI Validation & Enrichment")
        validated = self._validate_and_enrich(all_candidates)

        logger.info("Phase 3: Balance Gem Distribution")
        balanced = self._balance_gem_distribution(validated)

        logger.info("Phase 4: Write Output")
        write_locations_csv(balanced[: self.max_locations], output_path)

        logger.info(
            "Pipeline complete",
            total_locations=len(balanced[: self.max_locations]),
            output=str(output_path),
        )

        return balanced[: self.max_locations]

    def _scrape_reddit(self) -> list[dict]:
        logger.info("Scraping Reddit for hidden gems")
        results = self.reddit_scraper.search_hidden_gems(limit=100)
        logger.info("Reddit scrape complete", results=len(results))
        return results

    def _scrape_atlas_obscura(self) -> list[dict]:
        logger.info("Scraping Atlas Obscura")
        results = self.atlas_scraper.scrape_nyc()
        logger.info("Atlas Obscura scrape complete", results=len(results))
        return results

    def _validate_and_enrich(self, candidates: list[dict]) -> list[Location]:
        validated = []

        for i, candidate in enumerate(candidates):
            if len(validated) >= self.max_locations * 2:
                break

            name = candidate.get("name", "")
            logger.info(f"Processing {i + 1}/{len(candidates)}: {name}")

            if is_chain(name):
                logger.info(f"Skipping chain: {name}")
                continue

            gmaps_data = self.gmaps_client.search_place(name)
            if not gmaps_data:
                logger.warning(f"Not found on Google Maps: {name}")
                continue

            social_proof = self.social_proof_agent.calculate_social_proof(name)

            enriched_data = self.enrichment_agent.enrich(
                {
                    "name": name,
                    "category": candidate.get("category"),
                    "neighborhood": candidate.get("neighborhood"),
                    "address": gmaps_data.get("address"),
                    "latitude": gmaps_data.get("latitude"),
                    "longitude": gmaps_data.get("longitude"),
                    "rating": gmaps_data.get("rating"),
                    "user_ratings_total": gmaps_data.get("user_ratings_total"),
                    "price_level": gmaps_data.get("price_level"),
                    "google_maps_url": gmaps_data.get("url"),
                }
            )

            if enriched_data:
                gem_level = determine_gem_level(
                    gmaps_data.get("user_ratings_total"),
                    social_proof.score,
                )

                location = Location(
                    name=name,
                    description=enriched_data.get("description", ""),
                    category=enriched_data.get("category", "local"),
                    latitude=gmaps_data.get("latitude"),
                    longitude=gmaps_data.get("longitude"),
                    address=gmaps_data.get("address"),
                    price_level=gmaps_data.get("price_level"),
                    google_maps_url=gmaps_data.get("url"),
                    rating=gmaps_data.get("rating"),
                    tags=enriched_data.get("tags", []),
                    ai_vibe_summary=enriched_data.get("ai_vibe_summary", ""),
                    gem_level=gem_level,
                    neighborhood=candidate.get("neighborhood"),
                    source_urls=candidate.get("source_urls", [candidate.get("source_url", "")]),
                )
                validated.append(location)
                logger.info(f"Validated: {name}", gem_level=gem_level)

        return validated

    def _balance_gem_distribution(self, locations: list[Location]) -> list[Location]:
        gem_1 = [loc for loc in locations if loc.gem_level == 1]
        gem_2 = [loc for loc in locations if loc.gem_level == 2]
        gem_3 = [loc for loc in locations if loc.gem_level == 3]

        target_gem_1 = int(self.max_locations * 0.15)
        target_gem_2 = int(self.max_locations * 0.35)
        target_gem_3 = int(self.max_locations * 0.50)

        balanced = []
        balanced.extend(gem_1[:target_gem_1])
        balanced.extend(gem_2[:target_gem_2])
        balanced.extend(gem_3[:target_gem_3])

        logger.info(
            "Gem distribution",
            gem_1=min(len(gem_1), target_gem_1),
            gem_2=min(len(gem_2), target_gem_2),
            gem_3=min(len(gem_3), target_gem_3),
        )

        return balanced


def run_hybrid_pipeline(max_locations: int = 50, output_path: Path = None) -> list[Location]:
    if output_path is None:
        output_path = Path("data/output/locations.csv")

    pipeline = HybridPipeline(max_locations=max_locations)
    return pipeline.run(output_path)
