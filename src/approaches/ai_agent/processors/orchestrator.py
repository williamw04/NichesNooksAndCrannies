"""Orchestrator - Coordinates the AI agent pipeline."""

import time
from collections import Counter
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

from src.approaches.ai_agent.agents.discovery import DiscoveryAgent, DiscoveryOutput
from src.approaches.ai_agent.agents.enrichment import (
    EnrichmentAgent,
    EnrichmentInput,
    EnrichmentOutput,
)
from src.approaches.ai_agent.agents.social_proof import SocialProofAgent, SocialProofOutput
from src.approaches.ai_agent.agents.validation import ValidationAgent, ValidationOutput
from src.approaches.ai_agent.config.constants import GEM_DISTRIBUTION, TARGET_LOCATIONS
from src.approaches.ai_agent.config.settings import get_settings
from src.shared.services.logger import get_logger
from src.shared.types.location import GemLevel, Location
from src.shared.types.output import write_locations_csv

logger = get_logger(__name__)


class PipelineResult(BaseModel):
    locations: list[Location] = []
    total_discovered: int = 0
    total_validated: int = 0
    total_enriched: int = 0
    gem_distribution: dict[int, int] = {}
    errors: list[str] = []
    duration_seconds: float = 0


class Orchestrator:
    """Orchestrates the AI agent pipeline."""

    def __init__(
        self,
        target_locations: int = TARGET_LOCATIONS,
        output_path: Optional[Path] = None,
    ):
        self.target_locations = target_locations
        self.settings = get_settings()
        self.output_path = output_path or Path(self.settings.output_dir) / "locations.csv"

        self.discovery_agent = DiscoveryAgent()
        self.validation_agent = ValidationAgent()
        self.social_proof_agent = SocialProofAgent()
        self.enrichment_agent = EnrichmentAgent()

        self.gem_targets = {
            1: int(target_locations * GEM_DISTRIBUTION[1]["target_percent"]),
            2: int(target_locations * GEM_DISTRIBUTION[2]["target_percent"]),
            3: int(target_locations * GEM_DISTRIBUTION[3]["target_percent"]),
        }

    def run(self) -> PipelineResult:
        """Run the complete pipeline."""
        start_time = time.time()

        logger.info(f"Starting pipeline for {self.target_locations} locations")

        all_locations: list[Location] = []
        gem_counts: dict[int, int] = {1: 0, 2: 0, 3: 0}
        errors: list[str] = []

        total_discovered = 0
        total_validated = 0

        for gem_level_focus in [3, 2, 1]:
            if len(all_locations) >= self.target_locations:
                break

            remaining = self.target_locations - len(all_locations)
            target_for_level = min(
                remaining,
                self.gem_targets.get(gem_level_focus, 10) - gem_counts.get(gem_level_focus, 0),
            )

            if target_for_level <= 0:
                continue

            logger.info(
                f"Processing gem_level {gem_level_focus}, targeting {target_for_level} locations"
            )

            try:
                discovery_result = self.discovery_agent.run(
                    target_count=target_for_level * 2,
                    focus_gem_level=gem_level_focus,
                )

                if discovery_result.error:
                    errors.append(f"Discovery error: {discovery_result.error}")
                    continue

                total_discovered += len(discovery_result.candidates)

                if not discovery_result.candidates:
                    errors.append(f"No candidates found for gem_level {gem_level_focus}")
                    continue

                validation_result = self.validation_agent.run(
                    candidates=discovery_result.candidates,
                    skip_chains=True,
                    require_coordinates=True,
                )

                total_validated += len(validation_result.validated)

                if not validation_result.validated:
                    errors.append(f"No valid locations for gem_level {gem_level_focus}")
                    continue

                social_proof_inputs = [
                    {
                        "name": v.candidate.name,
                        "neighborhood": v.candidate.neighborhood,
                    }
                    for v in validation_result.validated
                ]

                social_proof_result = self.social_proof_agent.run(social_proof_inputs)

                social_proof_map = {r.location_name: r for r in social_proof_result.results}

                enrichment_inputs: list[EnrichmentInput] = []

                for validated in validation_result.validated:
                    social_proof = social_proof_map.get(validated.candidate.name)
                    social_score = social_proof.score if social_proof else 0

                    if gem_level_focus == 3 and social_score < 2:
                        continue
                    if gem_level_focus == 2 and social_score < 1:
                        continue

                    enrichment_inputs.append(
                        EnrichmentInput(
                            name=validated.validation.name,
                            category=validated.candidate.category,
                            neighborhood=validated.candidate.neighborhood,
                            latitude=validated.validation.latitude,
                            longitude=validated.validation.longitude,
                            address=validated.validation.address,
                            rating=validated.validation.rating,
                            review_count=validated.validation.review_count,
                            price_level=validated.validation.price_level,
                            google_maps_url=validated.validation.google_maps_url,
                            context=validated.candidate.context,
                            source_urls=validated.candidate.source_urls,
                            social_proof_score=social_score,
                        )
                    )

                if not enrichment_inputs:
                    errors.append(
                        f"No locations passed social proof for gem_level {gem_level_focus}"
                    )
                    continue

                enrichment_result = self.enrichment_agent.run(enrichment_inputs)

                for location in enrichment_result.locations:
                    gem_level_int = (
                        location.gem_level.value
                        if hasattr(location.gem_level, "value")
                        else location.gem_level
                    )

                    if gem_counts.get(gem_level_int, 0) < self.gem_targets.get(gem_level_int, 0):
                        all_locations.append(location)
                        gem_counts[gem_level_int] = gem_counts.get(gem_level_int, 0) + 1

                    if len(all_locations) >= self.target_locations:
                        break

            except Exception as e:
                logger.error(f"Pipeline error for gem_level {gem_level_focus}: {e}")
                errors.append(f"Error processing gem_level {gem_level_focus}: {str(e)}")

        duration = time.time() - start_time

        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        write_locations_csv(all_locations, self.output_path)

        logger.info(
            f"Pipeline complete: {len(all_locations)} locations in {duration:.1f}s",
            gem_distribution=dict(gem_counts),
        )

        return PipelineResult(
            locations=all_locations,
            total_discovered=total_discovered,
            total_validated=total_validated,
            total_enriched=len(all_locations),
            gem_distribution=dict(gem_counts),
            errors=errors,
            duration_seconds=duration,
        )


def run_pipeline(
    target_locations: int = TARGET_LOCATIONS,
    output_path: Optional[Path] = None,
) -> PipelineResult:
    """Run the complete AI agent pipeline.

    Args:
        target_locations: Number of locations to generate
        output_path: Path to save output CSV

    Returns:
        PipelineResult with all locations
    """
    orchestrator = Orchestrator(
        target_locations=target_locations,
        output_path=output_path,
    )
    return orchestrator.run()
