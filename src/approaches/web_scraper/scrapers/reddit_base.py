"""Base class for Reddit scrapers."""

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import RateLimiter, get_rate_limiter


@dataclass
class RedditPost:
    title: str
    url: str
    score: int
    subreddit: str
    author: str
    num_comments: int
    selftext: str = ""
    created_utc: float = 0.0
    post_id: str = ""

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "url": self.url,
            "score": self.score,
            "subreddit": self.subreddit,
            "author": self.author,
            "num_comments": self.num_comments,
            "selftext": self.selftext,
            "created_utc": self.created_utc,
            "post_id": self.post_id,
        }


class RedditScraperBase(ABC):
    name: str = "base"

    def __init__(self, rate_limit_per_minute: int = 30):
        self.logger = get_logger(f"reddit.{self.name}")
        self.rate_limiter = RateLimiter(requests_per_minute=rate_limit_per_minute)
        self._last_request_time = 0

    def _wait_for_rate_limit(self) -> None:
        self.rate_limiter.wait(self.name)

    @abstractmethod
    def search(
        self, subreddit: str, query: str, limit: int = 25, sort: str = "relevance"
    ) -> list[RedditPost]:
        """Search for posts in a subreddit."""
        pass

    @abstractmethod
    def get_hot(self, subreddit: str, limit: int = 25) -> list[RedditPost]:
        """Get hot posts from a subreddit."""
        pass

    def search_multiple(
        self, subreddits: list[str], queries: list[str], limit_per_search: int = 10
    ) -> list[RedditPost]:
        """Search multiple subreddits with multiple queries."""
        all_posts = []

        for subreddit in subreddits:
            for query in queries:
                try:
                    posts = self.search(subreddit, query, limit_per_search)
                    all_posts.extend(posts)
                    self.logger.info(f"Found {len(posts)} posts", subreddit=subreddit, query=query)
                except Exception as e:
                    self.logger.error(f"Search failed: {e}", subreddit=subreddit, query=query)

        return all_posts

    def deduplicate(self, posts: list[RedditPost]) -> list[RedditPost]:
        """Remove duplicate posts by URL."""
        seen = set()
        unique = []

        for post in posts:
            if post.url not in seen:
                seen.add(post.url)
                unique.append(post)

        return unique


DEFAULT_SUBREDDITS = [
    "nyc",
    "AskNYC",
    "FoodNYC",
    "nycbars",
]

DEFAULT_QUERIES = [
    "hidden gem",
    "underrated",
    "locals only",
    "secret spot",
]
