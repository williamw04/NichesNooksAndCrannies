"""Web search tool using SerpAPI."""

import json
from typing import Optional

import requests
from pydantic import BaseModel, Field

from src.approaches.ai_agent.config.settings import get_settings
from src.shared.services.cache import get_cache
from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import get_rate_limiter

logger = get_logger(__name__)
cache = get_cache()
rate_limiter = get_rate_limiter("serpapi")


class WebSearchResult(BaseModel):
    title: str
    link: str
    snippet: str
    position: int


class WebSearchOutput(BaseModel):
    results: list[WebSearchResult] = Field(default_factory=list)
    error: Optional[str] = None


def search_web(query: str, num_results: int = 10) -> WebSearchOutput:
    """Search the web using SerpAPI.

    Args:
        query: Search query string
        num_results: Number of results to return

    Returns:
        WebSearchOutput with results or error
    """
    settings = get_settings()

    if not settings.serpapi_key:
        return WebSearchOutput(error="SerpAPI key not configured")

    cache_key = f"web_search:{query}:{num_results}"
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f"Cache hit for web search: {query}")
        return WebSearchOutput(**cached)

    rate_limiter.wait("serpapi")

    try:
        params = {
            "q": query,
            "api_key": settings.serpapi_key,
            "num": num_results,
        }

        response = requests.get(
            "https://serpapi.com/search",
            params=params,
            timeout=30,
        )
        response.raise_for_status()

        data = response.json()
        organic_results = data.get("organic_results", [])

        results = []
        for i, result in enumerate(organic_results[:num_results]):
            results.append(
                WebSearchResult(
                    title=result.get("title", ""),
                    link=result.get("link", ""),
                    snippet=result.get("snippet", ""),
                    position=i + 1,
                )
            )

        output = WebSearchOutput(results=results)
        cache.set(cache_key, output.model_dump(), ttl=3600)

        logger.info(f"Web search found {len(results)} results for: {query}")
        return output

    except requests.RequestException as e:
        logger.error(f"Web search failed: {e}")
        return WebSearchOutput(error=str(e))


def search_social_signals(location_name: str, neighborhood: Optional[str] = None) -> dict:
    """Search for social media signals for a location.

    Args:
        location_name: Name of the location
        neighborhood: Optional neighborhood context

    Returns:
        Dict with social signal counts
    """
    query = f'"{location_name}" NYC'
    if neighborhood:
        query = f'"{location_name}" {neighborhood} NYC'

    tiktok_query = f"{query} site:tiktok.com"
    instagram_query = f"{query} site:instagram.com"

    tiktok_results = search_web(tiktok_query, num_results=5)
    instagram_results = search_web(instagram_query, num_results=5)

    return {
        "tiktok_videos": len(tiktok_results.results) if not tiktok_results.error else 0,
        "instagram_posts": len(instagram_results.results) if not instagram_results.error else 0,
    }


def check_hidden_gem_content(location_name: str) -> bool:
    """Check if location appears in hidden gem content.

    Args:
        location_name: Name of the location

    Returns:
        True if found in hidden gem articles
    """
    query = f'"{location_name}" "hidden gem" OR "underrated" OR "locals favorite" NYC'
    results = search_web(query, num_results=10)

    if results.error:
        return False

    for result in results.results:
        title_lower = result.title.lower()
        snippet_lower = result.snippet.lower()
        if "hidden gem" in title_lower or "hidden gem" in snippet_lower:
            return True
        if "underrated" in title_lower or "underrated" in snippet_lower:
            return True

    return False


class WebSearchTool:
    """Tool class for CrewAI integration."""

    name: str = "search_web"
    description: str = """Search the web using SerpAPI.
    
    Input: JSON with 'query' and optional 'num_results' (default 10)
    Output: JSON with search results
    """

    def _run(self, query: str, num_results: int = 10) -> str:
        result = search_web(query, num_results)
        if result.error:
            return json.dumps({"error": result.error})
        return json.dumps([r.model_dump() for r in result.results], indent=2)
