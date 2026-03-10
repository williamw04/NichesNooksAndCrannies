"""Discovery Agent - Find hidden gem candidates from multiple sources."""

import json
from typing import Optional

from pydantic import BaseModel, Field

from src.approaches.ai_agent.config.constants import (
    CATEGORY_KEYWORDS,
    DISCOVERY_QUERIES,
    REDDIT_SUBREDDITS,
    TARGET_LOCATIONS,
)
from src.approaches.ai_agent.config.prompts import (
    DISCOVERY_AGENT_BACKSTORY,
    DISCOVERY_AGENT_GOAL,
    DISCOVERY_AGENT_ROLE,
    DISCOVERY_PROMPT,
)
from src.approaches.ai_agent.config.settings import get_settings
from src.approaches.ai_agent.tools.search_reddit import search_reddit
from src.approaches.ai_agent.tools.search_web import search_web
from src.shared.services.logger import get_logger
from src.shared.types.location import Category, LocationCandidate

logger = get_logger(__name__)


class DiscoveryOutput(BaseModel):
    candidates: list[LocationCandidate] = Field(default_factory=list)
    error: Optional[str] = None


def _extract_category_from_text(text: str) -> Optional[Category]:
    """Infer category from text context."""
    text_lower = text.lower()

    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            try:
                return Category(category)
            except ValueError:
                continue

    return None


def _parse_location_from_reddit(result: dict) -> Optional[LocationCandidate]:
    """Parse a location candidate from Reddit search result."""
    title = result.get("title", "")
    selftext = result.get("selftext", "")
    context = f"{title} {selftext}".strip()

    if len(context) < 20:
        return None

    category = _extract_category_from_text(context)

    return LocationCandidate(
        name=title.split("-")[0].strip() if "-" in title else title[:100],
        category=category,
        context=context[:500],
        source_urls=[result.get("url", "")],
        mentions=1,
    )


def run_discovery(
    target_count: int = 20,
    focus_gem_level: int = 3,
) -> DiscoveryOutput:
    """Run discovery to find location candidates.

    Args:
        target_count: Number of candidates to find
        focus_gem_level: Focus on this gem level (2 or 3)

    Returns:
        DiscoveryOutput with list of candidates
    """
    settings = get_settings()
    candidates: list[LocationCandidate] = []
    seen_names: set[str] = set()

    logger.info(
        f"Starting discovery for {target_count} candidates, focus on gem_level {focus_gem_level}"
    )

    for query in DISCOVERY_QUERIES[:3]:
        if len(candidates) >= target_count:
            break

        reddit_result = search_reddit(query, limit=15)

        if reddit_result.error:
            logger.warning(f"Reddit search failed: {reddit_result.error}")
            continue

        for result in reddit_result.results:
            if len(candidates) >= target_count:
                break

            candidate = _parse_location_from_reddit(result.model_dump())

            if candidate and candidate.name.lower() not in seen_names:
                seen_names.add(candidate.name.lower())
                candidates.append(candidate)

    if len(candidates) < target_count:
        logger.info("Using LLM to generate additional location suggestions")

        llm_candidates = _discover_with_llm(target_count - len(candidates), focus_gem_level)

        for candidate in llm_candidates:
            if candidate.name.lower() not in seen_names:
                seen_names.add(candidate.name.lower())
                candidates.append(candidate)

    logger.info(f"Discovery complete: found {len(candidates)} candidates")

    return DiscoveryOutput(candidates=candidates[:target_count])


def _discover_with_llm(count: int, focus_gem_level: int) -> list[LocationCandidate]:
    """Use LLM to generate location suggestions."""
    settings = get_settings()

    if not settings.openai_api_key:
        return []

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )

        prompt = f"""Suggest {count} hidden gem locations in NYC.

Focus on gem_level {focus_gem_level} locations:
- gem_level 3: Under 500 reviews, genuine community discovery, off the beaten path
- gem_level 2: Local favorites with moderate presence, loved by residents

Return a JSON array with objects containing:
- name: location name
- neighborhood: neighborhood name
- category: one of (cafe, restaurant, nature, historical, museum, shopping, adventure, relaxation, nightlife, festival, local)
- context: brief description of why it's special

Important:
- Focus on lesser-known spots, NOT tourist attractions
- Include diverse neighborhoods (Brooklyn, Queens, Bronx, Manhattan)
- Mix of categories
- Real places that actually exist

Return ONLY the JSON array, no other text."""

        response = client.chat.completions.create(
            model=settings.openai_model_default,
            messages=[
                {
                    "role": "system",
                    "content": "You are a NYC local expert who knows hidden gems. Always return valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,
            max_tokens=1500,
        )

        content = response.choices[0].message.content

        if content:
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            data = json.loads(content)
            candidates = []

            for item in data:
                try:
                    category = None
                    if item.get("category"):
                        try:
                            category = Category(item["category"].lower())
                        except ValueError:
                            pass

                    candidates.append(
                        LocationCandidate(
                            name=item.get("name", ""),
                            neighborhood=item.get("neighborhood"),
                            category=category,
                            context=item.get("context", ""),
                            source_urls=[],
                            mentions=1,
                        )
                    )
                except Exception as e:
                    logger.warning(f"Failed to parse candidate: {e}")
                    continue

            return candidates

    except Exception as e:
        logger.error(f"LLM discovery failed: {e}")

    return []


class DiscoveryAgent:
    """Agent for discovering location candidates."""

    role: str = DISCOVERY_AGENT_ROLE
    goal: str = DISCOVERY_AGENT_GOAL
    backstory: str = DISCOVERY_AGENT_BACKSTORY

    def run(self, target_count: int = 20, focus_gem_level: int = 3) -> DiscoveryOutput:
        """Run the discovery agent."""
        return run_discovery(target_count, focus_gem_level)
