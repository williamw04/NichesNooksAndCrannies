"""Reddit scraper using Apify service."""

import os
from typing import List

from apify_client import ApifyClient

from src.approaches.web_scraper.scrapers.reddit_base import (
    RedditPost,
    RedditScraperBase,
)


class RedditApifyScraper(RedditScraperBase):
    name = "apify"

    def __init__(self, api_token: str = None):
        super().__init__(rate_limit_per_minute=100)
        token = api_token or os.environ.get("APIFY_API_TOKEN")
        if not token:
            raise ValueError("APIFY_API_TOKEN not provided and not found in environment")
        self.client = ApifyClient(token)

    def search(
        self, subreddit: str, query: str, limit: int = 25, sort: str = "relevance"
    ) -> List[RedditPost]:
        self._wait_for_rate_limit()

        run_input = {
            "searches": [f"{query} subreddit:{subreddit}"],
            "searchPosts": True,
            "maxItems": limit,
            "sort": sort,
        }

        run = self.client.actor("macrocosmos/reddit-scraper").call(run_input=run_input)

        posts = []
        for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
            post = RedditPost(
                title=item.get("title", ""),
                url=item.get("url", ""),
                score=item.get("ups", 0),
                subreddit=item.get("subreddit", subreddit),
                author=item.get("author", ""),
                num_comments=item.get("num_comments", 0),
                selftext=item.get("selftext", ""),
                created_utc=item.get("created_utc", 0.0),
                post_id=item.get("id", ""),
            )
            posts.append(post)

        self.logger.info(
            "Apify search completed",
            subreddit=subreddit,
            query=query,
            results=len(posts),
        )

        return posts

    def get_hot(self, subreddit: str, limit: int = 25) -> List[RedditPost]:
        self._wait_for_rate_limit()

        run_input = {
            "startUrls": [f"https://www.reddit.com/r/{subreddit}/hot"],
            "maxItems": limit,
            "sort": "hot",
        }

        run = self.client.actor("macrocosmos/reddit-scraper").call(run_input=run_input)

        posts = []
        for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
            post = RedditPost(
                title=item.get("title", ""),
                url=item.get("url", ""),
                score=item.get("ups", 0),
                subreddit=item.get("subreddit", subreddit),
                author=item.get("author", ""),
                num_comments=item.get("num_comments", 0),
                selftext=item.get("selftext", ""),
                created_utc=item.get("created_utc", 0.0),
                post_id=item.get("id", ""),
            )
            posts.append(post)

        self.logger.info(
            "Apify get_hot completed",
            subreddit=subreddit,
            results=len(posts),
        )

        return posts
