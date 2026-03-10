"""Tests for Reddit scraper."""

import pytest
from unittest.mock import MagicMock, patch

from src.approaches.web_scraper.scrapers.reddit import RedditScraper
from src.approaches.web_scraper.types.scraper_result import RedditScrapeResult


class TestRedditScraper:
    def test_init_without_credentials(self):
        with patch.object(RedditScraper, "_init_reddit", return_value=False):
            scraper = RedditScraper()
            assert scraper.reddit is None

    def test_extract_location_mentions(self):
        scraper = RedditScraper()

        title = "Hidden gem: Joe's Pizza in Williamsburg"
        selftext = "Best slice in Brooklyn, locals only go here"

        mentions = scraper._extract_location_mentions(title, selftext)

        assert len(mentions) > 0

    def test_is_generic(self):
        scraper = RedditScraper()

        assert scraper._is_generic("the best") is True
        assert scraper._is_generic("hidden gem") is True
        assert scraper._is_generic("Joe's Pizza") is False
        assert scraper._is_generic("Central Park Cafe") is False

    def test_extract_context(self):
        scraper = RedditScraper()

        text = "I found this amazing hidden gem called Little Branch. It's a speakeasy in the West Village."
        context = scraper._extract_context(text, "Little Branch")

        assert "Little Branch" in context

    def test_aggregate_results(self):
        scraper = RedditScraper()

        results = [
            RedditScrapeResult(
                name="Joe's Pizza",
                subreddit="nyc",
                post_title="Best pizza",
                post_url="https://reddit.com/r/nyc/1",
                score=100,
                num_comments=20,
                mentions=1,
            ),
            RedditScrapeResult(
                name="Joe's Pizza",
                subreddit="FoodNYC",
                post_title="Great slice",
                post_url="https://reddit.com/r/FoodNYC/2",
                score=50,
                num_comments=10,
                mentions=1,
            ),
            RedditScrapeResult(
                name="Lucali's",
                subreddit="nyc",
                post_title="Best pizza",
                post_url="https://reddit.com/r/nyc/3",
                score=200,
                num_comments=30,
                mentions=1,
            ),
        ]

        aggregated = scraper._aggregate_results(results)

        assert len(aggregated) == 2
        joes = next((r for r in aggregated if "joe" in r.name.lower()), None)
        assert joes is not None
        assert joes.mentions == 2

    @patch("src.approaches.web_scraper.scrapers.reddit.praw")
    def test_search_subreddit_with_mock(self, mock_praw):
        mock_reddit = MagicMock()
        mock_subreddit = MagicMock()
        mock_post = MagicMock()
        mock_post.title = "Hidden gem: Secret Bar NYC"
        mock_post.selftext = "Amazing speakeasy in East Village"
        mock_post.score = 150
        mock_post.num_comments = 25
        mock_post.permalink = "/r/nyc/comments/abc123"

        mock_subreddit.search.return_value = [mock_post]
        mock_reddit.subreddit.return_value = mock_subreddit

        scraper = RedditScraper()
        scraper.reddit = mock_reddit
        scraper._initialized = True

        results = scraper.search_subreddit("nyc", "hidden gem", limit=10)

        assert isinstance(results, list)
