"""Reddit JSON endpoint scraper - no authentication required.

This module provides an alternative to PRAW that uses Reddit's public .json
endpoints. No API credentials needed - just add .json to Reddit URLs.

Rate Limits: ~100 requests per 10 minutes (600/hour)
Headers to monitor: x-ratelimit-remaining, x-ratelimit-reset
"""

import re
import time
from collections import Counter
from typing import Optional

import requests

from src.approaches.web_scraper.types.scraper_result import RedditScrapeResult
from src.shared.services.logger import get_logger

logger = get_logger(__name__)


class RedditJSONScraper:
    BASE_URL = "https://www.reddit.com"
    USER_AGENT = "hidden-gems-nyc/1.0 (research project)"

    def __init__(self, requests_per_minute: int = 6):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": self.USER_AGENT})
        self.min_interval = 60.0 / requests_per_minute
        self._last_request = 0
        self._rate_limit_remaining = 100
        self._rate_limit_reset = 600

    def _wait(self) -> None:
        now = time.time()
        elapsed = now - self._last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        if self._rate_limit_remaining < 10:
            logger.warning(
                "Rate limit low, waiting",
                remaining=self._rate_limit_remaining,
                reset_in=self._rate_limit_reset,
            )
            time.sleep(self._rate_limit_reset)
        self._last_request = time.time()

    def _update_rate_limits(self, headers: dict) -> None:
        if "x-ratelimit-remaining" in headers:
            self._rate_limit_remaining = float(headers["x-ratelimit-remaining"])
        if "x-ratelimit-reset" in headers:
            self._rate_limit_reset = int(headers["x-ratelimit-reset"])

    def _get(self, url: str, params: Optional[dict] = None) -> Optional[dict]:
        self._wait()
        try:
            resp = self.session.get(url, params=params, timeout=30)
            self._update_rate_limits(dict(resp.headers))
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 429:
                logger.warning("Rate limited, waiting 60s")
                time.sleep(60)
                return self._get(url, params)
            logger.error("Reddit request failed", status=resp.status_code, url=url)
        except Exception as e:
            logger.error("Reddit request error", error=str(e), url=url)
        return None

    def search(
        self,
        subreddit: str,
        query: str,
        sort: str = "relevance",
        time_filter: str = "all",
        limit: int = 25,
    ) -> list[dict]:
        url = f"{self.BASE_URL}/r/{subreddit}/search.json"
        params = {
            "q": query,
            "restrict_sr": 1,
            "sort": sort,
            "t": time_filter,
            "limit": limit,
        }
        data = self._get(url, params)
        if not data or "data" not in data:
            return []
        return [c["data"] for c in data["data"].get("children", []) if c["kind"] == "t3"]

    def get_hot(self, subreddit: str, limit: int = 25) -> list[dict]:
        url = f"{self.BASE_URL}/r/{subreddit}/hot.json"
        params = {"limit": limit}
        data = self._get(url, params)
        if not data or "data" not in data:
            return []
        return [c["data"] for c in data["data"].get("children", []) if c["kind"] == "t3"]

    def get_top(self, subreddit: str, time_filter: str = "all", limit: int = 25) -> list[dict]:
        url = f"{self.BASE_URL}/r/{subreddit}/top.json"
        params = {"t": time_filter, "limit": limit}
        data = self._get(url, params)
        if not data or "data" not in data:
            return []
        return [c["data"] for c in data["data"].get("children", []) if c["kind"] == "t3"]

    def get_comments(self, post_id: str, limit: int = 50) -> list[dict]:
        url = f"{self.BASE_URL}/comments/{post_id}.json"
        params = {"limit": limit}
        data = self._get(url, params)
        if not data or not isinstance(data, list) or len(data) < 2:
            return []
        return [c["data"] for c in data[1]["data"].get("children", []) if c["kind"] == "t1"]

    def paginate_search(
        self,
        subreddit: str,
        query: str,
        sort: str = "relevance",
        limit: int = 100,
        max_pages: int = 5,
    ) -> list[dict]:
        all_posts = []
        after = None
        pages = 0

        while pages < max_pages:
            url = f"{self.BASE_URL}/r/{subreddit}/search.json"
            params = {
                "q": query,
                "restrict_sr": 1,
                "sort": sort,
                "limit": min(100, limit),
            }
            if after:
                params["after"] = after

            data = self._get(url, params)
            if not data or "data" not in data:
                break

            children = data["data"].get("children", [])
            posts = [c["data"] for c in children if c["kind"] == "t3"]
            all_posts.extend(posts)

            after = data["data"].get("after")
            pages += 1

            if not after or len(all_posts) >= limit:
                break

        return all_posts[:limit]

    def _extract_location_mentions(
        self, title: str, selftext: Optional[str]
    ) -> list[tuple[str, str]]:
        mentions = []
        text = f"{title} {selftext or ''}"

        patterns = [
            r"([A-Z][a-zA-Z\s&'\-]+(?:Cafe|Restaurant|Bar|Shop|Store|Market|Park|Museum|Gallery|Bakery|Brewery|Pub))",
            r"(?:try|visit|check out|go to|recommend|love)\s+([A-Z][a-zA-Z\s&'\-]{2,30})",
            r"([A-Z][a-zA-Z\s&'\-]{2,30})\s+(?:is|has|serves|offers)",
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                name = match.strip()
                if len(name) > 3 and not self._is_generic(name):
                    context = self._extract_context(text, name)
                    mentions.append((name, context))

        return mentions

    def _is_generic(self, name: str) -> bool:
        generic_terms = {
            "the best",
            "a great",
            "my favorite",
            "this place",
            "that place",
            "the place",
            "any good",
            "some good",
            "hidden gem",
            "underrated",
            "new york",
            "nyc",
        }
        name_lower = name.lower()
        return any(term in name_lower for term in generic_terms)

    def _extract_context(self, text: str, name: str, context_chars: int = 150) -> str:
        idx = text.lower().find(name.lower())
        if idx == -1:
            return ""
        start = max(0, idx - context_chars // 2)
        end = min(len(text), idx + len(name) + context_chars // 2)
        context = text[start:end].strip()
        if start > 0:
            context = "..." + context
        if end < len(text):
            context = context + "..."
        return context

    def search_to_results(
        self,
        subreddit: str,
        query: str,
        sort: str = "relevance",
        limit: int = 25,
    ) -> list[RedditScrapeResult]:
        posts = self.search(subreddit, query, sort=sort, limit=limit)
        results = []

        for post in posts:
            location_mentions = self._extract_location_mentions(
                post.get("title", ""), post.get("selftext")
            )
            for location_name, context in location_mentions:
                result = RedditScrapeResult(
                    name=location_name,
                    subreddit=subreddit,
                    post_title=post.get("title", ""),
                    post_url=f"https://reddit.com{post.get('permalink', '')}",
                    score=post.get("score", 0),
                    num_comments=post.get("num_comments", 0),
                    context=context,
                    mentions=1,
                )
                results.append(result)

        return results

    def scrape_all(
        self, subreddits: list[str], queries: list[str], limit: int = 50
    ) -> list[RedditScrapeResult]:
        all_results = []
        for subreddit in subreddits:
            for query in queries:
                logger.info("Searching", subreddit=subreddit, query=query)
                results = self.search_to_results(subreddit, query, limit=limit)
                all_results.extend(results)

        return self._aggregate_results(all_results)

    def _aggregate_results(self, results: list[RedditScrapeResult]) -> list[RedditScrapeResult]:
        if not results:
            return []

        name_counts: Counter = Counter()
        result_by_name: dict[str, RedditScrapeResult] = {}

        for result in results:
            normalized_name = result.name.lower().strip()
            name_counts[normalized_name] += 1

            if normalized_name not in result_by_name:
                result_by_name[normalized_name] = result
            else:
                existing = result_by_name[normalized_name]
                existing.mentions += 1
                existing.score = max(existing.score, result.score)

        aggregated = []
        for normalized_name, count in name_counts.most_common():
            result = result_by_name[normalized_name]
            result.mentions = count
            aggregated.append(result)

        return aggregated


if __name__ == "__main__":
    scraper = RedditJSONScraper(requests_per_minute=6)

    print("=== Testing Reddit JSON Endpoint ===\n")

    print("1. Search r/nyc for 'hidden gem':")
    posts = scraper.search("nyc", "hidden gem", sort="top", limit=5)
    for i, post in enumerate(posts, 1):
        print(f"  {i}. [{post['score']}] {post['title'][:60]}...")

    print("\n2. Get hot posts from r/nyc:")
    posts = scraper.get_hot("nyc", limit=3)
    for i, post in enumerate(posts, 1):
        print(f"  {i}. [{post['score']}] {post['title'][:60]}...")

    print("\n3. Get comments from a post:")
    if posts:
        comments = scraper.get_comments(posts[0]["id"], limit=3)
        for i, comment in enumerate(comments, 1):
            body = comment.get("body", "")[:60]
            print(f"  {i}. u/{comment.get('author')}: {body}...")

    print("\n4. Search and extract location mentions:")
    results = scraper.search_to_results("nyc", "hidden gem", sort="top", limit=10)
    for r in results[:5]:
        print(f"  - {r.name} (score: {r.score}, mentions: {r.mentions})")

    print(f"\nRate limit remaining: {scraper._rate_limit_remaining}")
