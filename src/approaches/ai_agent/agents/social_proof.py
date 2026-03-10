"""Social Proof Agent - Calculate social validation scores."""

from typing import Optional

from pydantic import BaseModel, Field

from src.approaches.ai_agent.config.prompts import (
    SOCIAL_PROOF_AGENT_BACKSTORY,
    SOCIAL_PROOF_AGENT_GOAL,
    SOCIAL_PROOF_AGENT_ROLE,
)
from src.approaches.ai_agent.tools.search_reddit import get_reddit_mentions
from src.approaches.ai_agent.tools.search_web import (
    check_hidden_gem_content,
    search_social_signals,
)
from src.shared.services.logger import get_logger
from src.shared.types.sources import SocialProofResult

logger = get_logger(__name__)


class SocialProofOutput(BaseModel):
    results: list[SocialProofResult] = Field(default_factory=list)
    error: Optional[str] = None


def calculate_social_proof(
    location_name: str,
    neighborhood: Optional[str] = None,
) -> SocialProofResult:
    """Calculate social proof score for a location.

    Args:
        location_name: Name of the location
        neighborhood: Optional neighborhood context

    Returns:
        SocialProofResult with score
    """
    logger.info(f"Calculating social proof for: {location_name}")

    social_signals = search_social_signals(location_name, neighborhood)

    reddit_mentions = get_reddit_mentions(location_name)

    hidden_gem_content = check_hidden_gem_content(location_name)

    result = SocialProofResult(
        location_name=location_name,
        tiktok_videos=social_signals.get("tiktok_videos", 0),
        instagram_posts=social_signals.get("instagram_posts", 0),
        reddit_mentions=reddit_mentions,
        hidden_gem_content=hidden_gem_content,
        tourism_site=False,
    )

    result.calculate_score()

    logger.info(
        f"Social proof for {location_name}: score={result.score}",
        reddit_mentions=reddit_mentions,
        tiktok=social_signals.get("tiktok_videos", 0),
        hidden_gem=hidden_gem_content,
    )

    return result


def run_social_proof(
    locations: list[dict],
    min_score_gem_2: int = 1,
    min_score_gem_3: int = 2,
) -> SocialProofOutput:
    """Run social proof analysis for multiple locations.

    Args:
        locations: List of dicts with 'name' and optional 'neighborhood'
        min_score_gem_2: Minimum score required for gem_level 2
        min_score_gem_3: Minimum score required for gem_level 3

    Returns:
        SocialProofOutput with results
    """
    results: list[SocialProofResult] = []

    logger.info(f"Calculating social proof for {len(locations)} locations")

    for location in locations:
        name = location.get("name", "")
        neighborhood = location.get("neighborhood")

        if not name:
            continue

        result = calculate_social_proof(name, neighborhood)
        results.append(result)

    logger.info(f"Social proof complete: {len(results)} locations analyzed")

    return SocialProofOutput(results=results)


class SocialProofAgent:
    """Agent for calculating social validation scores."""

    role: str = SOCIAL_PROOF_AGENT_ROLE
    goal: str = SOCIAL_PROOF_AGENT_GOAL
    backstory: str = SOCIAL_PROOF_AGENT_BACKSTORY

    def run(
        self,
        locations: list[dict],
        min_score_gem_2: int = 1,
        min_score_gem_3: int = 2,
    ) -> SocialProofOutput:
        """Run the social proof agent."""
        return run_social_proof(locations, min_score_gem_2, min_score_gem_3)
