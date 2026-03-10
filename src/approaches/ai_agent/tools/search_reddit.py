"""Reddit search tool for discovering location mentions."""

import json
from typing import Optional

from pydantic import BaseModel, Field

from src.approaches.ai_agent.config.constants import REDDIT_SUBREDDITS, DISCOVERY_QUERIES
from src.approaches.ai_agent.config.settings import get_settings
from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import get_rate_limiter

logger = get_logger(__name__)
rate_limiter = get_rate_limiter("reddit")


class RedditSearchResult(BaseModel):
    subreddit: str
    title: str
    url: str
    score: int
    num_comments: int
    selftext: str
    post_id: str


class RedditSearchOutput(BaseModel):
    results: list[RedditSearchResult] = Field(default_factory=list)
    error: Optional[str] = None


def search_reddit(
    query: str,
    subreddit: Optional[str] = None,
    limit: int = 25,
) -> RedditSearchOutput:
    """Search Reddit for location mentions.

    Args:
        query: Search query string
        subreddit: Specific subreddit to search (optional)
        limit: Maximum number of results

    Returns:
        RedditSearchOutput with results or error
    """
    settings = get_settings()

    if not settings.reddit_client_id or not settings.reddit_client_secret:
        return RedditSearchOutput(error="Reddit API credentials not configured")

    try:
        import praw
    except ImportError:
        return RedditSearchOutput(error="praw not installed. Install with: pip install praw")

    rate_limiter.wait("reddit")

    try:
        reddit = praw.Reddit(
            client_id=settings.reddit_client_id,
            client_secret=settings.reddit_client_secret,
            user_agent=settings.reddit_user_agent,
        )

        results = []
        subreddits_to_search = [subreddit] if subreddit else REDDIT_SUBREDDITS[:3]

        for sub_name in subreddits_to_search:
            try:
                rate_limiter.wait("reddit")
                subreddit_obj = reddit.subreddit(sub_name)

                for post in subreddit_obj.search(query, sort="relevance", limit=limit):
                    results.append(
                        RedditSearchResult(
                            subreddit=sub_name,
                            title=post.title,
                            url=f"https://reddit.com{post.permalink}",
                            score=post.score,
                            num_comments=post.num_comments,
                            selftext=post.selftext[:500] if post.selftext else "",
                            post_id=post.id,
                        )
                    )

                    if len(results) >= limit:
                        break

            except Exception as e:
                logger.warning(f"Error searching r/{sub_name}: {e}")
                continue

        logger.info(f"Reddit search found {len(results)} results for query: {query}")
        return RedditSearchOutput(results=results)

    except Exception as e:
        logger.error(f"Reddit search failed: {e}")
        return RedditSearchOutput(error=str(e))


def get_reddit_mentions(location_name: str) -> int:
    """Count Reddit mentions for a location.

    Args:
        location_name: Name of the location to search for

    Returns:
        Number of mentions found
    """
    output = search_reddit(f'"{location_name}"', limit=50)
    if output.error:
        return 0
    return len(output.results)


class RedditSearchTool:
    """Tool class for CrewAI integration."""

    name: str = "search_reddit"
    description: str = """Search Reddit for location mentions.
    
    Input: JSON with 'query', optional 'subreddit', optional 'limit' (default 25)
    Output: JSON with results containing post details
    """

    def _run(self, query: str, subreddit: Optional[str] = None, limit: int = 25) -> str:
        result = search_reddit(query, subreddit, limit)
        if result.error:
            return json.dumps({"error": result.error})
        return json.dumps([r.model_dump() for r in result.results], indent=2)
