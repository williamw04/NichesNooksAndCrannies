"""Reddit scraper using JSON endpoint (replaces PRAW-based scraper)."""

import re
import time
from collections import Counter
from typing import List, Optional

from src.approaches.web_scraper.config import REDDIT_CONFIG, settings
from src.approaches.web_scraper.scrapers.reddit_base import RedditPost
from src.approaches.web_scraper.scrapers.reddit_json import RedditJsonScraper
from src.approaches.web_scraper.types.scraper_result import RedditScrapeResult
from src.shared.services.logger import get_logger
from src.shared.utils.validation import is_valid_location_name

logger = get_logger(__name__)


class RedditScraper:
    def __init__(self):
        self._scraper = RedditJsonScraper()
        self._initialized = True
        self._filtered_count = 0

    def search_subreddit(
        self,
        subreddit: str,
        query: str,
        sort: str = "relevance",
        time_filter: str = "month",
        limit: int = 25,
    ) -> List[RedditScrapeResult]:
        results = []
        try:
            posts = self._scraper.search(subreddit, query, limit=limit, sort=sort)

            for post in posts:
                location_mentions = self._extract_location_mentions(post.title, post.selftext)

                for location_name, context in location_mentions:
                    is_valid, reason = is_valid_location_name(location_name)
                    if not is_valid:
                        self._filtered_count += 1
                        logger.debug(f"Filtered out: {location_name} ({reason})")
                        continue

                    result = RedditScrapeResult(
                        name=location_name,
                        subreddit=subreddit,
                        post_title=post.title,
                        post_url=post.url,
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
    ) -> List[tuple[str, str]]:
        mentions = []
        text = f"{title} {selftext or ''}"

        patterns = [
            r"([A-Z][a-zA-Z\s&'\-]+(?:Cafe|Restaurant|Bar|Shop|Store|Market|Park|Museum|Gallery|Bakery|Brewery|Pub|Bistro|Diner|Tavern|Grill|Kitchen))",
            r"([A-Z][a-zA-Z\s&'\-]{3,25}(?:Cafe|Restaurant|Bar|Shop|Store|Market|Park|Museum|Gallery|Bakery|Brewery|Pub))",
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                name = match.strip()
                if len(name) > 5 and len(name) < 100:
                    context = self._extract_context(text, name)
                    mentions.append((name, context))

        return mentions

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

    def scrape_all(self) -> List[RedditScrapeResult]:
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
            filtered=self._filtered_count,
        )

        return aggregated

    def _aggregate_results(self, results: List[RedditScrapeResult]) -> List[RedditScrapeResult]:
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

    def get_hot_posts(self, subreddit: str, limit: int = 25) -> List[RedditScrapeResult]:
        results = []
        try:
            posts = self._scraper.get_hot(subreddit, limit=limit)

            for post in posts:
                location_mentions = self._extract_location_mentions(post.title, post.selftext)

                for location_name, context in location_mentions:
                    is_valid, reason = is_valid_location_name(location_name)
                    if not is_valid:
                        self._filtered_count += 1
                        continue

                    result = RedditScrapeResult(
                        name=location_name,
                        subreddit=subreddit,
                        post_title=post.title,
                        post_url=post.url,
                        score=post.score,
                        num_comments=post.num_comments,
                        context=context,
                        mentions=1,
                    )
                    results.append(result)

        except Exception as e:
            logger.error("Failed to get hot posts", subreddit=subreddit, error=str(e))

        return results
