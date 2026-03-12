"""Reddit scraper using .json endpoint."""

import time
from typing import List

import requests

from src.approaches.web_scraper.scrapers.reddit_base import (
    RedditPost,
    RedditScraperBase,
)


class RedditJsonScraper(RedditScraperBase):
    name = "json"
    BASE_URL = "https://www.reddit.com"

    def __init__(self, user_agent: str = "NYC-Hidden-Gems/1.0"):
        super().__init__(rate_limit_per_minute=60)
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": user_agent})
        self._rate_limit_remaining = 100
        self._rate_limit_reset = 600

    def _update_rate_limits(self, headers: dict) -> None:
        if "x-ratelimit-remaining" in headers:
            try:
                self._rate_limit_remaining = int(float(headers["x-ratelimit-remaining"]))
            except (ValueError, TypeError):
                pass
        if "x-ratelimit-reset" in headers:
            try:
                self._rate_limit_reset = int(headers["x-ratelimit-reset"])
            except (ValueError, TypeError):
                pass

    def _handle_rate_limit(self, response: requests.Response) -> None:
        if response.status_code == 429:
            wait_time = self._rate_limit_reset
            self.logger.warning(
                "Rate limited, waiting",
                wait_seconds=wait_time,
                remaining=self._rate_limit_remaining,
            )
            time.sleep(wait_time)
        elif self._rate_limit_remaining < 10:
            self.logger.warning(
                "Rate limit low, pausing",
                remaining=self._rate_limit_remaining,
                reset_in=self._rate_limit_reset,
            )
            time.sleep(self._rate_limit_reset)

    def _parse_posts(self, data: dict) -> List[RedditPost]:
        posts = []
        children = data.get("data", {}).get("children", [])
        for child in children:
            if child.get("kind") != "t3":
                continue
            post_data = child.get("data", {})
            post = RedditPost(
                title=post_data.get("title", ""),
                url=f"https://reddit.com{post_data.get('permalink', '')}",
                score=post_data.get("score", 0),
                subreddit=post_data.get("subreddit", ""),
                author=post_data.get("author", "[deleted]"),
                num_comments=post_data.get("num_comments", 0),
                selftext=post_data.get("selftext", ""),
                created_utc=post_data.get("created_utc", 0.0),
                post_id=post_data.get("id", ""),
            )
            posts.append(post)
        return posts

    def search(
        self, subreddit: str, query: str, limit: int = 25, sort: str = "relevance"
    ) -> List[RedditPost]:
        self._wait_for_rate_limit()
        url = f"{self.BASE_URL}/r/{subreddit}/search.json"
        params = {
            "q": query,
            "restrict_sr": 1,
            "limit": limit,
            "sort": sort,
        }

        try:
            response = self.session.get(url, params=params, timeout=30)
            self._update_rate_limits(dict(response.headers))

            if response.status_code == 429:
                self._handle_rate_limit(response)
                return self.search(subreddit, query, limit, sort)

            if response.status_code != 200:
                self.logger.error(
                    "Search request failed",
                    status=response.status_code,
                    subreddit=subreddit,
                    query=query,
                )
                return []

            data = response.json()
            posts = self._parse_posts(data)
            self.logger.info(
                "Search completed",
                subreddit=subreddit,
                query=query,
                posts_found=len(posts),
            )
            return posts

        except Exception as e:
            self.logger.error(
                "Search error",
                error=str(e),
                subreddit=subreddit,
                query=query,
            )
            return []

    def get_hot(self, subreddit: str, limit: int = 25) -> List[RedditPost]:
        self._wait_for_rate_limit()
        url = f"{self.BASE_URL}/r/{subreddit}/hot.json"
        params = {"limit": limit}

        try:
            response = self.session.get(url, params=params, timeout=30)
            self._update_rate_limits(dict(response.headers))

            if response.status_code == 429:
                self._handle_rate_limit(response)
                return self.get_hot(subreddit, limit)

            if response.status_code != 200:
                self.logger.error(
                    "Hot posts request failed",
                    status=response.status_code,
                    subreddit=subreddit,
                )
                return []

            data = response.json()
            posts = self._parse_posts(data)
            self.logger.info(
                "Hot posts retrieved",
                subreddit=subreddit,
                posts_found=len(posts),
            )
            return posts

        except Exception as e:
            self.logger.error(
                "Hot posts error",
                error=str(e),
                subreddit=subreddit,
            )
            return []


if __name__ == "__main__":
    scraper = RedditJsonScraper()

    print("=== Testing Reddit JSON Scraper ===\n")

    print("1. Get hot posts from r/nyc:")
    hot_posts = scraper.get_hot("nyc", limit=5)
    for i, post in enumerate(hot_posts, 1):
        print(f"  {i}. [{post.score}] {post.title[:60]}...")

    print("\n2. Search r/nyc for 'hidden gem':")
    search_posts = scraper.search("nyc", "hidden gem", limit=5)
    for i, post in enumerate(search_posts, 1):
        print(f"  {i}. [{post.score}] {post.title[:60]}...")

    print(f"\nRate limit remaining: {scraper._rate_limit_remaining}")
