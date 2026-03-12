"""Reddit scraper using Crawlee framework."""

import asyncio
import re
from datetime import timedelta
from typing import List, Optional

from crawlee.crawlers import PlaywrightCrawler, PlaywrightCrawlingContext
from crawlee.proxy_configuration import ProxyConfiguration

from src.approaches.web_scraper.scrapers.reddit_base import (
    RedditPost,
    RedditScraperBase,
)


class RedditCrawleeScraper(RedditScraperBase):
    name = "crawlee"

    def __init__(self, headless: bool = True, proxy_urls: Optional[List[str]] = None):
        super().__init__(rate_limit_per_minute=30)
        self.headless = headless
        self.proxy_urls = proxy_urls

    def search(
        self, subreddit: str, query: str, limit: int = 25, sort: str = "relevance"
    ) -> List[RedditPost]:
        return asyncio.run(self._search_async(subreddit, query, limit, sort))

    async def _search_async(
        self, subreddit: str, query: str, limit: int, sort: str
    ) -> List[RedditPost]:
        results: List[RedditPost] = []

        proxy_config = None
        if self.proxy_urls:
            proxy_config = ProxyConfiguration(proxy_urls=self.proxy_urls)

        crawler = PlaywrightCrawler(
            max_requests_per_crawl=1,
            headless=self.headless,
            proxy_configuration=proxy_config,
            use_session_pool=True,
            request_handler_timeout=timedelta(seconds=60),
            navigation_timeout=timedelta(seconds=30),
        )

        @crawler.router.default_handler
        async def handler(context: PlaywrightCrawlingContext):
            page = context.page

            try:
                if await page.query_selector('iframe[src*="challenge"]'):
                    self.logger.warning("Cloudflare challenge detected")
                    return

                await page.wait_for_selector("shreddit-post", timeout=15000)

                for _ in range(3):
                    await page.evaluate("window.scrollBy(0, 1000)")
                    await asyncio.sleep(0.5)

                posts = await page.query_selector_all("shreddit-post")

                for post_element in posts[:limit]:
                    try:
                        post = await self._extract_post(post_element, subreddit)
                        if post:
                            results.append(post)
                    except Exception as e:
                        self.logger.debug(f"Error extracting post: {e}")

            except Exception as e:
                self.logger.error(f"Handler error: {e}")

        search_url = (
            f"https://www.reddit.com/r/{subreddit}/search/?q={query}&restrict_sr=1&sort={sort}"
        )
        await crawler.run([search_url])

        return results[:limit]

    async def _get_hot_async(self, subreddit: str, limit: int) -> List[RedditPost]:
        results: List[RedditPost] = []

        proxy_config = None
        if self.proxy_urls:
            proxy_config = ProxyConfiguration(proxy_urls=self.proxy_urls)

        crawler = PlaywrightCrawler(
            max_requests_per_crawl=1,
            headless=self.headless,
            proxy_configuration=proxy_config,
            use_session_pool=True,
            request_handler_timeout=timedelta(seconds=60),
            navigation_timeout=timedelta(seconds=30),
        )

        @crawler.router.default_handler
        async def handler(context: PlaywrightCrawlingContext):
            page = context.page

            try:
                if await page.query_selector('iframe[src*="challenge"]'):
                    self.logger.warning("Cloudflare challenge detected")
                    return

                await page.wait_for_selector("shreddit-post", timeout=15000)

                for _ in range(3):
                    await page.evaluate("window.scrollBy(0, 1000)")
                    await asyncio.sleep(0.5)

                posts = await page.query_selector_all("shreddit-post")

                for post_element in posts[:limit]:
                    try:
                        post = await self._extract_post(post_element, subreddit)
                        if post:
                            results.append(post)
                    except Exception as e:
                        self.logger.debug(f"Error extracting post: {e}")

            except Exception as e:
                self.logger.error(f"Handler error: {e}")

        hot_url = f"https://www.reddit.com/r/{subreddit}/hot/"
        await crawler.run([hot_url])

        return results[:limit]

    def get_hot(self, subreddit: str, limit: int = 25) -> List[RedditPost]:
        return asyncio.run(self._get_hot_async(subreddit, limit))

    async def _extract_post(self, post_element, subreddit: str) -> Optional[RedditPost]:
        title_el = await post_element.query('[slot="title"]')
        title = ""
        if title_el:
            title = await title_el.inner_text()
            title = title.strip()

        if not title:
            link_el = await post_element.query('a[slot="title"]')
            if link_el:
                title = await link_el.inner_text()
                title = title.strip()

        score = 0
        score_el = await post_element.query("shreddit-post-action-button[upvote] ~ span")
        if score_el:
            score_text = await score_el.inner_text()
            score = self._parse_score(score_text)
        else:
            score_attr = await post_element.get_attribute("score")
            if score_attr:
                score = int(score_attr) if score_attr.isdigit() else 0

        url = ""
        link_el = await post_element.query('a[slot="title"]')
        if link_el:
            href = await link_el.get_attribute("href")
            if href:
                url = f"https://www.reddit.com{href}" if href.startswith("/") else href

        author = "[deleted]"
        author_el = await post_element.query('a[href*="/user/"]')
        if author_el:
            author = await author_el.inner_text()
            author = author.strip().lstrip("u/")

        num_comments = 0
        comments_el = await post_element.query('a[href*="/comments/"]')
        if comments_el:
            comments_text = await comments_el.inner_text()
            num_match = re.search(r"(\d+)", comments_text)
            if num_match:
                num_comments = int(num_match.group(1))

        comments_attr = await post_element.get_attribute("comment-count")
        if comments_attr and comments_attr.isdigit():
            num_comments = int(comments_attr)

        post_id = ""
        id_attr = await post_element.get_attribute("id")
        if id_attr:
            if id_attr.startswith("t3_"):
                post_id = id_attr[3:]
            else:
                post_id = id_attr
        elif url:
            id_match = re.search(r"/comments/([a-z0-9]+)/", url)
            if id_match:
                post_id = id_match.group(1)

        selftext = ""
        body_el = await post_element.query('div[slot="text-body"]')
        if body_el:
            selftext = await body_el.inner_text()
            selftext = selftext.strip()

        created_utc = 0.0
        time_el = await post_element.query("time")
        if time_el:
            timestamp_attr = await time_el.get_attribute("datetime")
            if timestamp_attr:
                try:
                    from datetime import datetime

                    dt = datetime.fromisoformat(timestamp_attr.replace("Z", "+00:00"))
                    created_utc = dt.timestamp()
                except Exception:
                    pass

        return RedditPost(
            title=title,
            url=url,
            score=score,
            subreddit=subreddit,
            author=author,
            num_comments=num_comments,
            selftext=selftext,
            created_utc=created_utc,
            post_id=post_id,
        )

    def _parse_score(self, score_text: str) -> int:
        score_text = score_text.strip().lower().replace(",", "")
        if not score_text:
            return 0

        try:
            if "k" in score_text:
                num = float(score_text.replace("k", ""))
                return int(num * 1000)
            elif "m" in score_text:
                num = float(score_text.replace("m", ""))
                return int(num * 1000000)
            else:
                return int(float(score_text))
        except ValueError:
            return 0
