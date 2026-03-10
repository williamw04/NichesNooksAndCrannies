"""Enrichment Agent - Generate descriptions and vibe summaries."""

from typing import Optional

from pydantic import BaseModel, Field

from src.approaches.ai_agent.config.prompts import (
    ENRICHMENT_AGENT_BACKSTORY,
    ENRICHMENT_AGENT_GOAL,
    ENRICHMENT_AGENT_ROLE,
)
from src.approaches.ai_agent.tools.analyze_reviews import (
    analyze_reviews,
    generate_description,
    generate_tags,
    generate_vibe_summary,
)
from src.shared.services.logger import get_logger
from src.shared.types.location import Category, GemLevel, Location
from src.shared.utils.validation import determine_gem_level

logger = get_logger(__name__)


class EnrichmentInput(BaseModel):
    name: str
    category: Optional[Category] = None
    neighborhood: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    price_level: Optional[int] = None
    google_maps_url: Optional[str] = None
    context: Optional[str] = None
    source_urls: list[str] = Field(default_factory=list)
    social_proof_score: int = 0


class EnrichmentOutput(BaseModel):
    locations: list[Location] = Field(default_factory=list)
    error: Optional[str] = None


def enrich_location(input_data: EnrichmentInput) -> Optional[Location]:
    """Enrich a location with generated content.

    Args:
        input_data: EnrichmentInput with location data

    Returns:
        Location with enriched content, or None if enrichment failed
    """
    logger.info(f"Enriching location: {input_data.name}")

    review_analysis = analyze_reviews(
        input_data.name,
        input_data.neighborhood,
    )

    reviews_summary = review_analysis.insights.summary

    category_str = input_data.category.value if input_data.category else "local"

    description = generate_description(
        location_name=input_data.name,
        category=category_str,
        neighborhood=input_data.neighborhood,
        context=input_data.context or "",
        reviews_summary=reviews_summary,
    )

    vibe_summary = generate_vibe_summary(
        location_name=input_data.name,
        description=description,
        reviews_summary=reviews_summary,
    )

    tags = generate_tags(
        location_name=input_data.name,
        category=category_str,
        description=description,
        reviews_summary=reviews_summary,
    )

    gem_level_int = determine_gem_level(
        input_data.review_count,
        input_data.social_proof_score,
    )
    gem_level = GemLevel(gem_level_int)

    if not input_data.category:
        category_str = (
            review_analysis.insights.vibe_keywords[0]
            if review_analysis.insights.vibe_keywords
            else "local"
        )
        try:
            category = Category(category_str.lower())
        except ValueError:
            category = Category.LOCAL
    else:
        category = input_data.category

    try:
        location = Location(
            name=input_data.name,
            description=description,
            category=category,
            latitude=input_data.latitude,
            longitude=input_data.longitude,
            city="New York",
            country="USA",
            address=input_data.address,
            price_level=input_data.price_level,
            google_maps_url=input_data.google_maps_url,
            rating=input_data.rating,
            tags=tags,
            ai_vibe_summary=vibe_summary,
            gem_level=gem_level,
            neighborhood=input_data.neighborhood,
            source_urls=input_data.source_urls,
        )

        logger.info(
            f"Enriched: {location.name}",
            gem_level=gem_level.value,
            tags_count=len(tags),
        )

        return location

    except Exception as e:
        logger.error(f"Failed to create Location for {input_data.name}: {e}")
        return None


def run_enrichment(
    inputs: list[EnrichmentInput],
) -> EnrichmentOutput:
    """Run enrichment for multiple locations.

    Args:
        inputs: List of EnrichmentInput objects

    Returns:
        EnrichmentOutput with enriched locations
    """
    locations: list[Location] = []

    logger.info(f"Enriching {len(inputs)} locations")

    for input_data in inputs:
        location = enrich_location(input_data)
        if location:
            locations.append(location)

    logger.info(f"Enrichment complete: {len(locations)} locations enriched")

    return EnrichmentOutput(locations=locations)


class EnrichmentAgent:
    """Agent for generating descriptions and vibe summaries."""

    role: str = ENRICHMENT_AGENT_ROLE
    goal: str = ENRICHMENT_AGENT_GOAL
    backstory: str = ENRICHMENT_AGENT_BACKSTORY

    def run(self, inputs: list[EnrichmentInput]) -> EnrichmentOutput:
        """Run the enrichment agent."""
        return run_enrichment(inputs)
