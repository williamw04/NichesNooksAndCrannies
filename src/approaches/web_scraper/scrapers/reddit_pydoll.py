"""Reddit scraper using Pydoll browser automation."""

import asyncio
import re
from typing import List

from pydoll.browser.chromium import Chrome
from pydoll.browser.options import ChromiumOptions

from src.approaches.web_scraper.scrapers.reddit_base import (
    RedditPost,
    RedditScraperBase,
)


class RedditPydollScraper(RedditScraperBase):
    name = "pydoll"

    def __init__(self, headless: bool = True):
        super().__init__(rate_limit_per_minute=30)
        self.headless = headless

    def search(
        self, subreddit: str, query: str, limit: int = 25, sort: str = "relevance"
    ) -> List[RedditPost]:
        return asyncio.run(self._search_async(subreddit, query, limit, sort))

    async def _search_async(
        self, subreddit: str, query: str, limit: int, sort: str
    ) -> List[RedditPost]:
        options = self._build_options()

        async with Chrome(options=options) as browser:
            tab = await browser.start()

            url = (
                f"https://www.reddit.com/r/{subreddit}/search/?q={query}&restrict_sr=1&sort={sort}"
            )
            await tab.go_to(url)
            await asyncio.sleep(2)

            await self._close_popup(tab)
            await self._scroll_page(tab, scrolls=3)

            posts = await self._extract_posts(tab, subreddit, limit)
            return posts

    def get_hot(self, subreddit: str, limit: int = 25) -> List[RedditPost]:
        return asyncio.run(self._get_hot_async(subreddit, limit))

    async def _get_hot_async(self, subreddit: str, limit: int) -> List[RedditPost]:
        options = self._build_options()

        async with Chrome(options=options) as browser:
            tab = await browser.start()

            url = f"https://www.reddit.com/r/{subreddit}/hot/"
            await tab.go_to(url)
            await asyncio.sleep(2)

            await self._close_popup(tab)
            await self._scroll_page(tab, scrolls=3)

            posts = await self._extract_posts(tab, subreddit, limit)
            return posts

    def _build_options(self) -> ChromiumOptions:
        options = ChromiumOptions()
        if self.headless:
            options.add_argument("--headless=new")

        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--disable-infobars")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")

        return options

    async def _close_popup(self, tab) -> None:
        try:
            close_btn = await tab.query('button[aria-label="Close"]')
            if close_btn:
                await close_btn.click()
                await asyncio.sleep(0.5)
        except Exception:
            pass

    async def _scroll_page(self, tab, scrolls: int = 3) -> None:
        for _ in range(scrolls):
            await tab.evaluate("window.scrollBy(0, 1000)")
            await asyncio.sleep(1)

    async def _extract_posts(self, tab, subreddit: str, limit: int) -> List[RedditPost]:
        posts = []

        post_elements = await tab.query_all("shreddit-post")

        for post_el in post_elements[:limit]:
            try:
                post = await self._extract_single_post(post_el, subreddit)
                if post:
                    posts.append(post)
            except Exception as e:
                self.logger.warning(f"Failed to extract post: {e}")
                continue

        return posts

    async def _extract_single_post(self, post_element, subreddit: str) -> RedditPost | None:
        title_el = await post_element.query('a[slot="title"]')
        if not title_el:
            return None

        title = await title_el.text
        title = title.strip() if title else ""

        link_el = await post_element.query('a[slot="title"]')
        post_path = ""
        if link_el:
            post_path = await link_el.get_attribute("href")
        post_url = (
            f"https://reddit.com{post_path}"
            if post_path and post_path.startswith("/")
            else post_path or ""
        )

        score_el = await post_element.query("shreddit-post-action-button[upvote]")
        score_text = ""
        if score_el:
            score_text = await score_el.text
        score = self._parse_score(score_text or "0")

        author_el = await post_element.query('a[href*="/user/"]')
        author = ""
        if author_el:
            author = await author_el.text
            author = author.strip() if author else ""

        comments_el = await post_element.query('a[href*="/comments/"] span')
        num_comments = 0
        if comments_el:
            comments_text = await comments_el.text
            if comments_text:
                num_comments = self._parse_count(comments_text)

        body_el = await post_element.query("div[slot='text-body']")
        selftext = ""
        if body_el:
            selftext = await body_el.text
            selftext = selftext.strip()[:500] if selftext else ""

        post_id = ""
        if post_path:
            match = re.search(r"/comments/([a-z0-9]+)", post_path)
            if match:
                post_id = match.group(1)

        return RedditPost(
            title=title,
            url=post_url,
            score=score,
            subreddit=subreddit,
            author=author,
            num_comments=num_comments,
            selftext=selftext,
            created_utc=0.0,
            post_id=post_id,
        )

    def _parse_score(self, score_text: str) -> int:
        score_text = score_text.strip().lower()

        if not score_text:
            return 0

        try:
            if "k" in score_text:
                return int(float(score_text.replace("k", "")) * 1000)
            elif "m" in score_text:
                return int(float(score_text.replace("m", "")) * 1000000)
            else:
                return int(score_text.replace(",", ""))
        except Exception:
            return 0

    def _parse_count(self, count_text: str) -> int:
        count_text = count_text.strip().lower()

        if not count_text:
            return 0

        try:
            if "k" in count_text:
                return int(float(count_text.replace("k", "")) * 1000)
            elif "m" in count_text:
                return int(float(count_text.replace("m", "")) * 1000000)
            else:
                return int(count_text.replace(",", ""))
        except Exception:
            return 0
