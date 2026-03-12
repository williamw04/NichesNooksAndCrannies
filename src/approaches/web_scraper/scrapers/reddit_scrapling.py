"""Reddit scraper using Scrapling framework for Cloudflare bypass."""

from scrapling.fetchers import StealthyFetcher

from src.approaches.web_scraper.scrapers.reddit_base import (
    RedditPost,
    RedditScraperBase,
)


class RedditScraplingScraper(RedditScraperBase):
    name = "scrapling"

    def __init__(self, headless: bool = True):
        super().__init__(rate_limit_per_minute=30)
        self.headless = headless

    def _parse_posts(self, page, limit: int) -> list[RedditPost]:
        posts = []
        containers = page.css('[data-testid="post-container"]')[:limit]

        for container in containers:
            try:
                title_el = container.css("h3")
                title = title_el.css("::text").get() or ""

                link_el = container.css('a[data-click-id="body"]')
                post_url = link_el.attrib.get("href", "") if link_el else ""

                if not post_url:
                    link_el = container.css('a[href*="/comments/"]')
                    post_url = link_el.attrib.get("href", "") if link_el else ""

                score_el = container.css('[data-click-id="upvote"]')
                score = 0
                if score_el:
                    score_text = score_el.css("::text").get() or "0"
                    score = self._parse_score(score_text)

                author_el = container.css('a[href*="/user/"]')
                author = ""
                if author_el:
                    author = author_el.css("::text").get() or ""
                    author = author.lstrip("u/")

                comments_el = container.css('a[data-click-id="comments"]')
                num_comments = 0
                if comments_el:
                    comments_text = comments_el.css("::text").get() or "0"
                    num_comments = self._parse_score(comments_text)

                subreddit_el = container.css('a[href*="/r/"]')
                subreddit = ""
                if subreddit_el:
                    href = subreddit_el.attrib.get("href", "")
                    if "/r/" in href:
                        parts = href.split("/r/")
                        if len(parts) > 1:
                            subreddit = parts[1].split("/")[0].split("?")[0]

                if post_url and not post_url.startswith("http"):
                    post_url = f"https://www.reddit.com{post_url}"

                post_id = ""
                if "/comments/" in post_url:
                    parts = post_url.split("/comments/")
                    if len(parts) > 1:
                        post_id = parts[1].split("/")[0]

                posts.append(
                    RedditPost(
                        title=title.strip(),
                        url=post_url,
                        score=score,
                        subreddit=subreddit,
                        author=author,
                        num_comments=num_comments,
                        selftext="",
                        created_utc=0.0,
                        post_id=post_id,
                    )
                )
            except Exception as e:
                self.logger.warning(f"Failed to parse post: {e}")
                continue

        return posts

    def _parse_score(self, text: str) -> int:
        text = text.strip().lower().replace(",", "")
        if "k" in text:
            num = float(text.replace("k", ""))
            return int(num * 1000)
        try:
            return int(float(text))
        except ValueError:
            return 0

    def search(
        self, subreddit: str, query: str, limit: int = 25, sort: str = "relevance"
    ) -> list[RedditPost]:
        self._wait_for_rate_limit()

        encoded_query = query.replace(" ", "+")
        url = f"https://www.reddit.com/r/{subreddit}/search/?q={encoded_query}&restrict_sr=1&sort={sort}"

        self.logger.info(f"Fetching search: {url}")

        try:
            page = StealthyFetcher.fetch(url, headless=self.headless)
            posts = self._parse_posts(page, limit)
            self.logger.info(f"Found {len(posts)} posts", subreddit=subreddit, query=query)
            return posts
        except Exception as e:
            self.logger.error(f"Search failed: {e}", subreddit=subreddit, query=query)
            return []

    def get_hot(self, subreddit: str, limit: int = 25) -> list[RedditPost]:
        self._wait_for_rate_limit()

        url = f"https://www.reddit.com/r/{subreddit}/hot/"

        self.logger.info(f"Fetching hot posts: {url}")

        try:
            page = StealthyFetcher.fetch(url, headless=self.headless)
            posts = self._parse_posts(page, limit)
            self.logger.info(f"Found {len(posts)} hot posts", subreddit=subreddit)
            return posts
        except Exception as e:
            self.logger.error(f"Get hot failed: {e}", subreddit=subreddit)
            return []


if __name__ == "__main__":
    scraper = RedditScraplingScraper(headless=True)

    print("=== Testing Reddit Scrapling Scraper ===\n")

    print("1. Search r/nyc for 'hidden gem':")
    posts = scraper.search("nyc", "hidden gem", limit=5)
    for i, post in enumerate(posts, 1):
        print(f"  {i}. [{post.score}] {post.title[:60]}...")

    print("\n2. Get hot posts from r/nyc:")
    posts = scraper.get_hot("nyc", limit=5)
    for i, post in enumerate(posts, 1):
        print(f"  {i}. [{post.score}] {post.title[:60]}...")
