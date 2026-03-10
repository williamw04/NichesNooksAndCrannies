"""AI Agent configuration module."""

from src.approaches.ai_agent.config.constants import (
    DISCOVERY_QUERIES,
    REDDIT_SUBREDDITS,
    TARGET_LOCATIONS,
    GEM_DISTRIBUTION,
)
from src.approaches.ai_agent.config.prompts import (
    DISCOVERY_PROMPT,
    VALIDATION_PROMPT,
    SOCIAL_PROOF_PROMPT,
    ENRICHMENT_PROMPT,
    VIBE_SUMMARY_PROMPT,
)
from src.approaches.ai_agent.config.settings import get_settings, Settings

__all__ = [
    "DISCOVERY_QUERIES",
    "REDDIT_SUBREDDITS",
    "TARGET_LOCATIONS",
    "GEM_DISTRIBUTION",
    "DISCOVERY_PROMPT",
    "VALIDATION_PROMPT",
    "SOCIAL_PROOF_PROMPT",
    "ENRICHMENT_PROMPT",
    "VIBE_SUMMARY_PROMPT",
    "get_settings",
    "Settings",
]
