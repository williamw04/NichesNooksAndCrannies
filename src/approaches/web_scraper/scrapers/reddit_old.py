"""Reddit scraper using old.reddit.com HTML parsing."""

import re
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup

from src.approaches.web_scraper.scrapers.reddit_base import (
    RedditPost,
    RedditScraperBase,
)


class RedditOldScraper(RedditScraperBase):
    name = "old"
    BASE_URL = "https://old.reddit.com"

    def __init__(self, user_agent: str = "NYC-Hidden-Gems/1.0"):
        super().__init__(rate_limit_per_minute=30)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": user_agent,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )

    def _make_request(self, url: str, params: Optional[dict] = None) -> Optional[BeautifulSoup]:
        self._wait_for_rate_limit()
        try:
            response = self.session.get(url, params=params, timeout=30)
            if response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", 60))
                self.logger.warning("Rate limited, waiting", retry_after=retry_after)
                time.sleep(retry_after)
                return self._make_request(url, params)
            if response.status_code != 200:
                self.logger.error("Request failed", status=response.status_code, url=url)
                return None
            return BeautifulSoup(response.text, "lxml")
        except Exception as e:
            self.logger.error("Request error", error=str(e), url=url)
            return None

    def search(
        self, subreddit: str, query: str, limit: int = 25, sort: str = "relevance"
    ) -> list[RedditPost]:
        params = {
            "q": query,
            "restrict_sr": "on",
            "sort": sort,
            "t": "all",
        }
        url = f"{self.BASE_URL}/r/{subreddit}/search"
        soup = self._make_request(url, params)
        if not soup:
            return []
        return self._parse_listing(soup, limit, subreddit)

    def get_hot(self, subreddit: str, limit: int = 25) -> list[RedditPost]:
        url = f"{self.BASE_URL}/r/{subreddit}/hot/"
        soup = self._make_request(url)
        if not soup:
            return []
        return self._parse_listing(soup, limit, subreddit)

    def _parse_listing(
        self, soup: BeautifulSoup, limit: int, default_subreddit: str = ""
    ) -> list[RedditPost]:
        posts = []
        post_elements = soup.select("div.thing.link")[:limit]

        for post_el in post_elements:
            try:
                post = self._extract_post(post_el, default_subreddit)
                if post:
                    posts.append(post)
            except Exception as e:
                self.logger.warning("Failed to parse post", error=str(e))
                continue

        return posts

    def _extract_post(
        self, post_el: BeautifulSoup, default_subreddit: str = ""
    ) -> Optional[RedditPost]:
        post_id = post_el.get("data-fullname", "").replace("t3_", "")
        if not post_id:
            return None

        title_el = post_el.select_one("a.title")
        if not title_el:
            return None
        title = title_el.text.strip()
        post_url = title_el.get("href", "")

        score_el = post_el.select_one("div.score.unvoted")
        score_text = score_el.text if score_el else "0"
        score = self._parse_score(score_text)

        author_el = post_el.select_one("a.author")
        author = author_el.text if author_el else "[deleted]"

        subreddit_el = post_el.select_one("a.subreddit")
        if subreddit_el:
            subreddit = subreddit_el.text.replace("r/", "")
        else:
            subreddit = default_subreddit

        comments_el = post_el.select_one("a.comments")
        comments_text = comments_el.text if comments_el else "0"
        num_comments = self._parse_comments_count(comments_text)

        selftext = ""
        selftext_el = post_el.select_one("div.usertext-body")
        if selftext_el:
            selftext = selftext_el.text.strip()

        full_url = f"https://reddit.com{post_url}" if post_url.startswith("/") else post_url

        return RedditPost(
            title=title,
            url=full_url,
            score=score,
            subreddit=subreddit,
            author=author,
            num_comments=num_comments,
            selftext=selftext,
            post_id=post_id,
        )

    def _parse_score(self, score_text: str) -> int:
        text = score_text.strip().lower().replace("points", "").strip()
        if not text or text == "•":
            return 0
        try:
            if "k" in text:
                return int(float(text.replace("k", "")) * 1000)
            elif "m" in text:
                return int(float(text.replace("m", "")) * 1000000)
            else:
                return int(text.replace(",", ""))
        except ValueError:
            return 0

    def _parse_comments_count(self, text: str) -> int:
        match = re.search(r"(\d+)", text.replace(",", ""))
        return int(match.group(1)) if match else 0
