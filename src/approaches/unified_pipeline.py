"""Unified pipeline for generating v2 data with all scrapers."""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from src.approaches.web_scraper.config.category_queries import get_categories_by_priority
from src.approaches.web_scraper.config.settings import settings
from src.approaches.web_scraper.scrapers.atlas_obscura import AtlasObscuraScraper
from src.approaches.web_scraper.scrapers.eater import EaterScraper
from src.approaches.web_scraper.scrapers.google_maps import GoogleMapsClient
from src.approaches.web_scraper.scrapers.nyc_parks import NYCParksScraper
from src.approaches.web_scraper.scrapers.reddit_json import RedditJsonScraper
from src.approaches.web_scraper.scrapers.timeout import TimeoutScraper
from src.approaches.web_scraper.scrapers.yelp import YelpScraper
from src.shared.services.logger import get_logger
from src.shared.types.location import Category, GemLevel, Location
from src.shared.utils.quality_checks import (
    filter_valid_locations,
    get_quality_summary,
    validate_location_quality,
)

logger = get_logger("unified_pipeline")


class UnifiedPipeline:
    """Pipeline that combines all data sources for comprehensive coverage."""

    def __init__(
        self,
        output_dir: Path = Path("data/output"),
        max_locations: int = 50,
        use_yelp: bool = True,
        use_timeout: bool = True,
        use_eater: bool = True,
        use_nyc_parks: bool = True,
    ):
        self.output_dir = output_dir
        self.max_locations = max_locations
        self.logger = logger

        self.reddit = RedditJsonScraper()
        self.atlas = AtlasObscuraScraper()
        self.gmaps = GoogleMapsClient() if settings.google_maps_configured else None

        self.yelp = YelpScraper(api_key=settings.YELP_API_KEY) if use_yelp else None
        self.timeout = TimeoutScraper() if use_timeout else None
        self.eater = EaterScraper() if use_eater else None
        self.nyc_parks = NYCParksScraper() if use_nyc_parks else None

        self.candidates: list[dict] = []
        self.locations: list[Location] = []

    def discover_from_reddit(self, category: str, limit: int = 10) -> list[dict]:
        """Discover locations from Reddit."""
        from src.approaches.web_scraper.config.category_queries import get_queries_for_category

        queries = get_queries_for_category(category)
        candidates = []

        subreddits = queries.get("subreddits", ["nyc", "AskNYC"])[:2]
        searches = queries.get("reddit_searches", ["hidden gem"])[:3]

        for subreddit in subreddits:
            for query in searches:
                posts = self.reddit.search(subreddit, query, limit=limit)
                for post in posts:
                    candidates.append(
                        {
                            "name": post.title,
                            "source": "reddit",
                            "source_url": post.url,
                            "category": category,
                            "context": post.selftext[:200] if post.selftext else "",
                        }
                    )
                time.sleep(0.5)

        return candidates

    def discover_from_timeout(self, category: str, limit: int = 10) -> list[dict]:
        """Discover locations from Timeout NYC."""
        if not self.timeout:
            return []

        from src.approaches.web_scraper.config.category_queries import get_queries_for_category

        queries = get_queries_for_category(category)
        timeout_urls = queries.get("timeout_articles", [])

        candidates = []
        for url_suffix in timeout_urls[:1]:
            url = f"https://www.timeout.com/newyork/{url_suffix}"
            locations = self.timeout._parse_listicle(url)
            for loc in locations:
                candidates.append(
                    {
                        "name": loc.name,
                        "source": "timeout",
                        "source_url": loc.url,
                        "category": category,
                        "description": loc.description,
                        "neighborhood": loc.neighborhood,
                    }
                )
            time.sleep(1)

        return candidates

    def discover_from_eater(self, category: str, limit: int = 10) -> list[dict]:
        """Discover locations from Eater NY."""
        if not self.eater:
            return []

        from src.approaches.web_scraper.config.category_queries import get_queries_for_category

        queries = get_queries_for_category(category)
        eater_urls = queries.get("eater_maps", [])

        candidates = []
        for url_suffix in eater_urls[:1]:
            url = f"https://www.eater.com/new-york/maps/{url_suffix}"
            restaurants = self.eater._parse_map_article(url)
            for rest in restaurants:
                candidates.append(
                    {
                        "name": rest.name,
                        "source": "eater",
                        "source_url": rest.url,
                        "category": category,
                        "description": rest.description,
                        "neighborhood": rest.neighborhood,
                        "cuisine": rest.cuisine,
                    }
                )
            time.sleep(1)

        return candidates

    def discover_from_nyc_parks(self, limit: int = 10) -> list[dict]:
        """Discover nature locations from NYC Parks."""
        if not self.nyc_parks:
            return []

        parks = self.nyc_parks.find_hidden_nature_gems(limit=limit)
        candidates = []

        for park in parks:
            candidates.append(
                {
                    "name": park.name,
                    "source": "nyc_parks",
                    "source_url": park.url,
                    "category": "nature",
                    "description": park.description,
                    "address": park.address,
                    "latitude": park.latitude,
                    "longitude": park.longitude,
                    "neighborhood": park.borough,
                }
            )

        return candidates

    def discover_from_yelp(self, category: str, limit: int = 10) -> list[dict]:
        """Discover locations from Yelp."""
        if not self.yelp or not self.yelp.is_configured:
            return []

        category_to_yelp = {
            "cafe": ["coffee", "cafes"],
            "restaurant": ["restaurants"],
            "nightlife": ["bars", "nightlife"],
            "shopping": ["shopping", "vintage"],
            "nature": ["parks", "gardens"],
            "museum": ["museums", "galleries"],
            "historical": ["landmarks", "museums"],
            "adventure": ["active_life", "entertainment"],
            "relaxation": ["spas", "wellness"],
            "festival": ["festivals"],
            "local": ["local_flavor"],
        }

        yelp_cats = category_to_yelp.get(category, ["local_flavor"])

        candidates = []
        businesses = self.yelp.search_businesses(
            term="hidden gem",
            categories=yelp_cats[:1],
            limit=limit,
            sort_by="rating",
        )

        for biz in businesses:
            if biz.rating and biz.rating >= 4.0 and biz.review_count and biz.review_count < 500:
                candidates.append(
                    {
                        "name": biz.name,
                        "source": "yelp",
                        "source_url": biz.url,
                        "category": category,
                        "rating": biz.rating,
                        "review_count": biz.review_count,
                        "address": biz.address,
                        "latitude": biz.latitude,
                        "longitude": biz.longitude,
                        "price_level": len(biz.price) if biz.price else None,
                        "neighborhood": biz.city if biz.city else None,
                    }
                )

        return candidates

    def enrich_with_google_maps(self, candidate: dict) -> Optional[dict]:
        """Enrich a candidate with Google Maps data."""
        if not self.gmaps:
            return candidate

        try:
            results = self.gmaps.text_search(candidate["name"])
            if results:
                place = results[0]
                return {
                    **candidate,
                    "latitude": place.latitude,
                    "longitude": place.longitude,
                    "address": place.address,
                    "rating": place.rating,
                    "google_maps_url": place.google_maps_url,
                    "place_id": place.place_id,
                }
        except Exception as e:
            self.logger.warning(
                "Google Maps enrichment failed", name=candidate["name"], error=str(e)
            )

        return candidate

    def create_location(self, candidate: dict) -> Optional[Location]:
        """Create a Location object from a candidate dict."""
        try:
            name = candidate.get("name", "")
            if len(name) > 80:
                return None

            skip_patterns = [
                "what's your",
                "what is your",
                "favorite",
                "looking for",
                "collection",
                "july",
                "painting i did",
                "less-known",
                "discover",
                "best secret",
                "10 secret",
                "hidden gems of",
                "days in nyc",
                "outdoor spots",
                "men!",
                "obscure",
            ]
            if any(word in name.lower() for word in skip_patterns):
                return None

            if name.endswith("?") or name.startswith("/r/") or name.startswith("Looking"):
                return None

            review_count = candidate.get("review_count", 0)
            social_proof = 2 if candidate.get("source") == "reddit" else 1

            from src.shared.utils.validation import determine_gem_level

            gem_level = determine_gem_level(review_count, social_proof)

            category = candidate.get("category", "local")
            try:
                cat_enum = Category(category)
            except ValueError:
                cat_enum = Category.LOCAL

            description = candidate.get("description", "")
            if not description or len(description) < 50:
                description = f"A unique {category} spot in NYC that locals love. This hidden gem offers an authentic experience worth discovering."
            description = description[:500]

            tags = [
                category,
                "nyc",
                "hidden-gem",
                "local-favorite",
                "authentic",
                candidate.get("source", "discovered"),
            ]

            vibe = f"Authentic {category} spot with local character and unique charm."

            return Location(
                name=name[:200],
                description=description,
                category=cat_enum,
                latitude=candidate.get("latitude"),
                longitude=candidate.get("longitude"),
                city="New York",
                country="USA",
                address=candidate.get("address"),
                price_level=candidate.get("price_level"),
                google_maps_url=candidate.get("google_maps_url"),
                rating=candidate.get("rating"),
                image_url=candidate.get("image_url"),
                tags=tags,
                ai_vibe_summary=vibe[:100],
                gem_level=GemLevel(gem_level),
                neighborhood=candidate.get("neighborhood"),
                source_urls=[candidate.get("source_url", "")]
                if candidate.get("source_url")
                else [],
            )
        except Exception as e:
            self.logger.error("Failed to create location", name=candidate.get("name"), error=str(e))
            return None

    def run(self, dry_run: bool = False) -> list[Location]:
        """Run the full pipeline."""
        self.logger.info("Starting unified pipeline", max_locations=self.max_locations)

        categories = get_categories_by_priority()
        target_per_category = max(2, self.max_locations // len(categories))

        all_candidates = []

        self.logger.info("Discovering from Yelp across all categories...")
        for category in categories[:8]:
            yelp_candidates = self.discover_from_yelp(category, limit=8)
            all_candidates.extend(yelp_candidates)
            time.sleep(0.3)

        self.logger.info("Discovering from Reddit...")
        reddit_candidates = self.discover_from_reddit("local", limit=5)
        all_candidates.extend(reddit_candidates)

        self.logger.info(f"Total candidates discovered: {len(all_candidates)}")

        seen_names = set()
        unique_candidates = []
        for c in all_candidates:
            name_lower = c.get("name", "").lower().strip()
            if name_lower and name_lower not in seen_names:
                seen_names.add(name_lower)
                unique_candidates.append(c)

        self.logger.info(f"Unique candidates: {len(unique_candidates)}")

        locations = []
        for candidate in unique_candidates[: self.max_locations]:
            enriched = self.enrich_with_google_maps(candidate)
            if enriched:
                loc = self.create_location(enriched)
                if loc:
                    locations.append(loc)

        valid_locations, reports = filter_valid_locations(locations)
        summary = get_quality_summary(reports)

        self.logger.info(
            "Quality validation complete",
            total=len(locations),
            valid=len(valid_locations),
            pass_rate=summary["pass_rate"],
        )

        self.locations = valid_locations[: self.max_locations]
        return self.locations

    def save_output(self, locations: Optional[list[Location]] = None, version: str = "v2") -> Path:
        """Save locations to CSV."""
        locations = locations or self.locations
        if not locations:
            self.logger.warning("No locations to save")
            return Path("")

        version_dir = self.output_dir / version
        version_dir.mkdir(parents=True, exist_ok=True)

        date_str = datetime.now().strftime("%Y-%m-%d")
        output_file = version_dir / f"locations_{date_str}.csv"

        import csv

        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "name",
                    "description",
                    "category",
                    "latitude",
                    "longitude",
                    "city",
                    "country",
                    "address",
                    "price_level",
                    "google_maps_url",
                    "rating",
                    "image_url",
                    "tags",
                    "ai_vibe_summary",
                    "gem_level",
                    "neighborhood",
                ]
            )

            for loc in locations:
                writer.writerow(
                    [
                        loc.name,
                        loc.description,
                        loc.category,
                        loc.latitude or "",
                        loc.longitude or "",
                        loc.city,
                        loc.country,
                        loc.address or "",
                        loc.price_level or "",
                        loc.google_maps_url or "",
                        loc.rating or "",
                        loc.image_url or "",
                        "|".join(loc.tags),
                        loc.ai_vibe_summary,
                        loc.gem_level,
                        loc.neighborhood or "",
                    ]
                )

        self.logger.info("Saved locations", file=str(output_file), count=len(locations))

        versions_file = self.output_dir / "versions.json"
        versions = {"versions": [], "current": version}

        if versions_file.exists():
            with open(versions_file) as f:
                versions = json.load(f)

        from collections import Counter

        gem_counts = Counter(loc.gem_level for loc in locations)
        cat_counts = Counter(loc.category for loc in locations)

        versions["versions"].append(
            {
                "version": version,
                "date": date_str,
                "file": str(output_file.relative_to(self.output_dir)),
                "locations": len(locations),
                "gem_distribution": {
                    "level_1": gem_counts.get(1, 0),
                    "level_2": gem_counts.get(2, 0),
                    "level_3": gem_counts.get(3, 0),
                },
                "categories": dict(cat_counts),
            }
        )
        versions["current"] = version

        with open(versions_file, "w") as f:
            json.dump(versions, f, indent=2)

        return output_file


def main():
    parser = argparse.ArgumentParser(description="Run unified hidden gems pipeline")
    parser.add_argument(
        "-n", "--max-locations", type=int, default=50, help="Maximum locations to generate"
    )
    parser.add_argument("-o", "--output", type=str, default="data/output", help="Output directory")
    parser.add_argument("--dry-run", action="store_true", help="Test without saving")
    parser.add_argument("--version", type=str, default="v2", help="Version label for output")
    parser.add_argument("--no-yelp", action="store_true", help="Skip Yelp scraper")
    parser.add_argument("--no-timeout", action="store_true", help="Skip Timeout scraper")
    parser.add_argument("--no-eater", action="store_true", help="Skip Eater scraper")
    parser.add_argument("--no-parks", action="store_true", help="Skip NYC Parks scraper")

    args = parser.parse_args()

    pipeline = UnifiedPipeline(
        output_dir=Path(args.output),
        max_locations=args.max_locations,
        use_yelp=not args.no_yelp,
        use_timeout=not args.no_timeout,
        use_eater=not args.no_eater,
        use_nyc_parks=not args.no_parks,
    )

    locations = pipeline.run(dry_run=args.dry_run)

    if not args.dry_run and locations:
        output_file = pipeline.save_output(version=args.version)
        print(f"\nSaved {len(locations)} locations to {output_file}")
    else:
        print(f"\nFound {len(locations)} locations (dry run)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
