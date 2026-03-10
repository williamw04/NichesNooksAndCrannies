"""Reddit scraper using PRAW."""

import re
import time
from collections import Counter
from typing import Optional

from src.approaches.web_scraper.config import REDDIT_CONFIG, REDDIT_SEARCH_PATTERNS, settings
from src.approaches.web_scraper.types.scraper_result import RedditScrapeResult
from src.shared.services.logger import get_logger
from src.shared.services.rate_limiter import get_rate_limiter

logger = get_logger(__name__)


class RedditScraper:
    def __init__(self):
        self.reddit = None
        self.rate_limiter = get_rate_limiter("reddit")
        self._initialized = False

    def _init_reddit(self) -> bool:
        if self._initialized:
            return self.reddit is not None

        self._initialized = True

        if not settings.reddit_configured:
            logger.warning("Reddit credentials not configured")
            return False

        try:
            import praw

            self.reddit = praw.Reddit(
                client_id=settings.REDDIT_CLIENT_ID,
                client_secret=settings.REDDIT_CLIENT_SECRET,
                user_agent=settings.REDDIT_USER_AGENT,
            )
            logger.info("Reddit client initialized")
            return True
        except Exception as e:
            logger.error("Failed to initialize Reddit client", error=str(e))
            return False

    def search_subreddit(
        self,
        subreddit: str,
        query: str,
        sort: str = "relevance",
        time_filter: str = "month",
        limit: int = 25,
    ) -> list[RedditScrapeResult]:
        if not self._init_reddit():
            return []

        results = []
        try:
            self.rate_limiter.wait("reddit")
            subreddit_obj = self.reddit.subreddit(subreddit)
            posts = subreddit_obj.search(query, sort=sort, time_filter=time_filter, limit=limit)

            for post in posts:
                location_mentions = self._extract_location_mentions(post.title, post.selftext)

                for location_name, context in location_mentions:
                    result = RedditScrapeResult(
                        name=location_name,
                        subreddit=subreddit,
                        post_title=post.title,
                        post_url=f"https://reddit.com{post.permalink}",
                        score=post.score,
                        num_comments=post.num_comments,
                        context=context,
                        mentions=1,
                    )
                    results.append(result)

        except Exception as e:
            logger.error("Reddit search failed", subreddit=subreddit, query=query, error=str(e))

        return results

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

    def scrape_all(self) -> list[RedditScrapeResult]:
        if not self._init_reddit():
            logger.warning("Reddit not configured, skipping scrape")
            return []

        all_results = []
        subreddits = REDDIT_CONFIG["subreddits"]
        queries = REDDIT_CONFIG["search_queries"]
        limit = REDDIT_CONFIG["max_posts_per_query"]

        logger.info("Starting Reddit scrape", subreddits=len(subreddits), queries=len(queries))

        for subreddit in subreddits:
            for query in queries:
                logger.debug("Searching", subreddit=subreddit, query=query)
                results = self.search_subreddit(subreddit, query, limit=limit)
                all_results.extend(results)
                time.sleep(0.5)

        aggregated = self._aggregate_results(all_results)

        logger.info(
            "Reddit scrape complete",
            total_results=len(all_results),
            unique_locations=len(aggregated),
        )

        return aggregated

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

    def get_hot_posts(self, subreddit: str, limit: int = 25) -> list[RedditScrapeResult]:
        if not self._init_reddit():
            return []

        results = []
        try:
            self.rate_limiter.wait("reddit")
            subreddit_obj = self.reddit.subreddit(subreddit)

            for post in subreddit_obj.hot(limit=limit):
                location_mentions = self._extract_location_mentions(post.title, post.selftext)

                for location_name, context in location_mentions:
                    result = RedditScrapeResult(
                        name=location_name,
                        subreddit=subreddit,
                        post_title=post.title,
                        post_url=f"https://reddit.com{post.permalink}",
                        score=post.score,
                        num_comments=post.num_comments,
                        context=context,
                        mentions=1,
                    )
                    results.append(result)

        except Exception as e:
            logger.error("Failed to get hot posts", subreddit=subreddit, error=str(e))

        return results
