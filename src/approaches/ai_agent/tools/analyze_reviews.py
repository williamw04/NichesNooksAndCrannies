"""Review analysis tool for extracting insights from reviews."""

import json
from typing import Optional

from pydantic import BaseModel, Field

from src.approaches.ai_agent.config.settings import get_settings
from src.approaches.ai_agent.utils.llm_client import complete, enrich
from src.shared.services.cache import get_cache
from src.shared.services.logger import get_logger

logger = get_logger(__name__)
cache = get_cache()


class ReviewInsights(BaseModel):
    summary: str
    positive_themes: list[str] = Field(default_factory=list)
    negative_themes: list[str] = Field(default_factory=list)
    vibe_keywords: list[str] = Field(default_factory=list)
    price_mention: Optional[str] = None
    crowd_mention: Optional[str] = None


class AnalyzeReviewsOutput(BaseModel):
    insights: ReviewInsights
    error: Optional[str] = None


def analyze_reviews(
    location_name: str,
    neighborhood: Optional[str] = None,
    num_reviews: int = 10,
) -> AnalyzeReviewsOutput:
    """Analyze reviews for a location using LLM.

    Args:
        location_name: Name of the location
        neighborhood: Optional neighborhood context
        num_reviews: Number of reviews to analyze

    Returns:
        AnalyzeReviewsOutput with insights
    """
    settings = get_settings()

    api_key = (
        settings.openrouter_api_key
        if settings.llm_provider == "openrouter"
        else settings.openai_api_key
    )
    if not api_key:
        return AnalyzeReviewsOutput(
            insights=ReviewInsights(summary="API key not configured"),
            error="API key not configured",
        )

    cache_key = f"reviews:{location_name}:{neighborhood}"
    cached = cache.get(cache_key)
    if cached:
        return AnalyzeReviewsOutput(**cached)

    try:
        prompt = f"""Analyze reviews for this NYC location and extract insights.

Location: {location_name}
Neighborhood: {neighborhood or "Unknown"}

Based on typical reviews for this type of place, provide:
1. A 2-3 sentence summary of what people love about it
2. Positive themes (list of 3-5 strings)
3. Negative themes (list of 1-3 strings, if any)
4. Vibe keywords (list of 5-8 atmosphere/atmosphere words like "cozy", "moody", "lively")
5. Price mention (one of: "affordable", "moderate", "pricey", "splurge", or null)
6. Crowd mention (description of typical crowd, or null)

Return as JSON with keys: summary, positive_themes, negative_themes, vibe_keywords, price_mention, crowd_mention

Important: If this is a real NYC location, base your analysis on what you know about it.
If you're not familiar with it, make reasonable inferences based on the name and type.
Be specific and avoid generic descriptions."""

        content = complete(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that analyzes location reviews. Always return valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=500,
            cache_key=cache_key,
        )

        if content:
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            insights_data = json.loads(content)
            insights = ReviewInsights(**insights_data)
        else:
            insights = ReviewInsights(summary="No response from LLM")

        output = AnalyzeReviewsOutput(insights=insights)
        cache.set(cache_key, output.model_dump(), ttl=86400)

        logger.info(f"Analyzed reviews for: {location_name}")
        return output

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response: {e}")
        return AnalyzeReviewsOutput(
            insights=ReviewInsights(summary="Failed to analyze reviews"),
            error=str(e),
        )
    except Exception as e:
        logger.error(f"Review analysis failed: {e}")
        return AnalyzeReviewsOutput(
            insights=ReviewInsights(summary="Analysis failed"),
            error=str(e),
        )


def generate_description(
    location_name: str,
    category: str,
    neighborhood: Optional[str],
    context: str,
    reviews_summary: str,
) -> str:
    """Generate a compelling description for a location.

    Args:
        location_name: Name of the location
        category: Category of the location
        neighborhood: Neighborhood name
        context: Context from discovery sources
        reviews_summary: Summary of reviews

    Returns:
        Generated description string
    """
    settings = get_settings()

    api_key = (
        settings.openrouter_api_key
        if settings.llm_provider == "openrouter"
        else settings.openai_api_key
    )
    if not api_key:
        return f"A {category} in {neighborhood or 'NYC'} worth visiting."

    try:
        prompt = f"""Write a compelling 2-3 sentence description for this NYC location.

Location: {location_name}
Category: {category}
Neighborhood: {neighborhood or "NYC"}
Context from sources: {context}
Reviews summary: {reviews_summary}

Rules:
- Lead with what makes it special (NOT "Located in...")
- Use conversational tone, like a cool local friend recommending it
- Include specific details that paint a picture
- Avoid: "This place offers", "We are", "Come visit"
- Be genuine, not promotional
- 50-150 words

Write the description:"""

        content = enrich(
            messages=[
                {
                    "role": "system",
                    "content": "You are a creative writer who captures the essence of places. Write compelling, personality-filled descriptions.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,
            max_tokens=200,
            enable_reasoning=True,
        )

        return (
            content.strip()
            if content
            else f"A {category} in {neighborhood or 'NYC'} worth visiting."
        )

    except Exception as e:
        logger.error(f"Description generation failed: {e}")
        return f"A {category} in {neighborhood or 'NYC'} worth visiting."


def generate_vibe_summary(
    location_name: str,
    description: str,
    reviews_summary: str,
) -> str:
    """Generate a short vibe summary for a location.

    Args:
        location_name: Location name
        description: Location description
        reviews_summary: Summary of reviews

    Returns:
        Vibe summary string (max 20 words)
    """
    settings = get_settings()

    api_key = (
        settings.openrouter_api_key
        if settings.llm_provider == "openrouter"
        else settings.openai_api_key
    )
    if not api_key:
        return "A unique spot with character."

    try:
        prompt = f"""Write a short vibe summary for this location (max 20 words).

Location: {location_name}
Description: {description}
Reviews: {reviews_summary}

Rules:
- Capture the FEELING, not facts
- Be evocative and specific
- Use vivid language
- Max 20 words

Examples: "Moody candlelit cavern with old-school cocktails" or "Sun-drenched plant haven with excellent espresso"

Write the vibe summary:"""

        content = enrich(
            messages=[
                {
                    "role": "system",
                    "content": "You are a creative writer. Write short, evocative vibe summaries.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,
            max_tokens=50,
            enable_reasoning=True,
        )

        return content.strip() if content else "A unique spot with character."

    except Exception as e:
        logger.error(f"Vibe summary generation failed: {e}")
        return "A unique spot with character."


def generate_tags(
    location_name: str,
    category: str,
    description: str,
    reviews_summary: str,
) -> list[str]:
    """Generate vibe-focused tags for a location.

    Args:
        location_name: Location name
        category: Category
        description: Description
        reviews_summary: Reviews summary

    Returns:
        List of 6-12 tags
    """
    settings = get_settings()

    api_key = (
        settings.openrouter_api_key
        if settings.llm_provider == "openrouter"
        else settings.openai_api_key
    )
    if not api_key:
        return [category, "nyc", "local-favorite"]

    try:
        prompt = f"""Generate 6-12 vibe-focused tags for this location.

Location: {location_name}
Category: {category}
Description: {description}
Reviews: {reviews_summary}

Rules:
- Focus on atmosphere and feeling, not just category
- Include aesthetic tags (moody, cozy, minimalist, etc.)
- Include practical tags (rooftop, outdoor, date-night, etc.)
- Be specific, avoid generic tags
- Format: lowercase, hyphenated
- Return ONLY a JSON array of strings

Example tags: cozy, moody-lighting, date-night, hidden-gem, craft-cocktails, vintage-vibes

Return tags as a JSON array:"""

        content = complete(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant. Always return valid JSON arrays.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=200,
        )

        if content:
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            tags = json.loads(content)
            if isinstance(tags, list):
                return tags[:12]

        return [category, "nyc", "local-favorite"]

    except Exception as e:
        logger.error(f"Tag generation failed: {e}")
        return [category, "nyc", "local-favorite"]


class AnalyzeReviewsTool:
    """Tool class for CrewAI integration."""

    name: str = "analyze_reviews"
    description: str = """Analyze reviews for a location and extract insights.
    
    Input: JSON with 'location_name', optional 'neighborhood'
    Output: JSON with review insights
    """

    def _run(
        self,
        location_name: str,
        neighborhood: Optional[str] = None,
    ) -> str:
        result = analyze_reviews(location_name, neighborhood)
        return json.dumps(result.model_dump(), indent=2)
