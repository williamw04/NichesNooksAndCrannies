"""Web Scraper Approach - Main Entry Point

This module orchestrates the web scraper pipeline:
1. Reddit scraper for raw candidates
2. Atlas Obscura scraper for structured data
3. Google Maps API for validation and enrichment
4. Cross-reference and deduplication
5. Gem level classification
6. Output to CSV
"""

import random
import time
from pathlib import Path
from typing import Optional

from src.approaches.web_scraper.config import settings
from src.approaches.web_scraper.processors import (
    CrossReferenceProcessor,
    DeduplicationProcessor,
    GemClassifier,
)
from src.approaches.web_scraper.scrapers import (
    AtlasObscuraScraper,
    GoogleMapsClient,
    RedditScraper,
)
from src.shared.services.logger import get_logger, setup_file_logging
from src.shared.types.location import Category, GemLevel, Location
from src.shared.types.output import write_locations_csv
from src.shared.utils.validation import is_chain, validate_coordinates

logger = get_logger(__name__)


class WebScraperPipeline:
    def __init__(self, max_locations: int = 50, output_path: Optional[Path] = None):
        self.max_locations = max_locations
        self.output_path = output_path or settings.OUTPUT_DIR / "locations.csv"

        self.reddit_scraper = RedditScraper()
        self.atlas_scraper = AtlasObscuraScraper()
        self.google_maps = GoogleMapsClient()

        self.cross_reference = CrossReferenceProcessor()
        self.deduplicator = DeduplicationProcessor()
        self.gem_classifier = GemClassifier()

        self.stats = {
            "reddit_results": 0,
            "atlas_results": 0,
            "google_results": 0,
            "candidates": 0,
            "final_locations": 0,
        }

    def run(self) -> list[Location]:
        logger.info("Starting web scraper pipeline", max_locations=self.max_locations)
        start_time = time.time()

        reddit_results = self._scrape_reddit()
        atlas_results = self._scrape_atlas_obscura()

        google_results = self._validate_with_google_maps(reddit_results, atlas_results)

        matches = self.cross_reference.cross_reference(
            reddit_results, atlas_results, google_results
        )

        merged_data = self.deduplicator.merge_candidates(
            self.cross_reference.to_candidates(
                matches, reddit_results, atlas_results, google_results
            ),
            reddit_results,
            atlas_results,
            google_results,
        )

        classified = self.gem_classifier.classify_batch(merged_data)

        adjusted = self.gem_classifier.adjust_for_distribution(classified, self.max_locations)

        locations = self._build_locations(adjusted)

        self._write_output(locations)

        duration = time.time() - start_time
        logger.info(
            "Pipeline complete",
            duration_seconds=round(duration, 2),
            locations=len(locations),
            distribution=self.gem_classifier.get_distribution(
                [{"gem_level": loc.gem_level} for loc in locations]
            ),
        )

        return locations

    def _scrape_reddit(self):
        logger.info("Scraping Reddit...")
        results = self.reddit_scraper.scrape_all()
        results = self.deduplicator.deduplicate_reddit_results(results)
        self.stats["reddit_results"] = len(results)
        logger.info("Reddit scrape complete", results=len(results))
        return results

    def _scrape_atlas_obscura(self):
        logger.info("Scraping Atlas Obscura...")
        results = self.atlas_scraper.scrape_all()
        results = self.deduplicator.deduplicate_atlas_results(results)
        self.stats["atlas_results"] = len(results)
        logger.info("Atlas Obscura scrape complete", results=len(results))
        return results

    def _validate_with_google_maps(self, reddit_results, atlas_results):
        logger.info("Validating with Google Maps...")

        google_results = []

        google_results.extend(self.google_maps.search_hidden_gems(max_results=30))

        unique_names = set()
        for result in reddit_results[:30]:
            normalized = result.name.lower().strip()
            if normalized not in unique_names and not is_chain(result.name):
                unique_names.add(normalized)
                validated = self.google_maps.validate_and_enrich(result.name, result.context)
                if validated:
                    google_results.append(validated)

        for result in atlas_results[:20]:
            normalized = result.name.lower().strip()
            if normalized not in unique_names and not is_chain(result.name):
                unique_names.add(normalized)
                validated = self.google_maps.validate_and_enrich(result.name, result.address)
                if validated:
                    google_results.append(validated)

        google_results = self.deduplicator.deduplicate_google_results(google_results)
        self.stats["google_results"] = len(google_results)
        logger.info("Google Maps validation complete", results=len(google_results))
        return google_results

    def _build_locations(self, data: list[dict]) -> list[Location]:
        locations = []

        for item in data:
            try:
                category = item.get("category") or self._infer_category(item)
                if isinstance(category, str):
                    try:
                        category = Category(category)
                    except ValueError:
                        category = Category.LOCAL

                gem_level = item.get("gem_level")
                if isinstance(gem_level, int):
                    gem_level = GemLevel(gem_level)

                description = self._generate_description(item)
                vibe_summary = self._generate_vibe_summary(item)
                tags = self._generate_tags(item)

                lat = item.get("latitude")
                lng = item.get("longitude")

                if lat and lng and not validate_coordinates(lat, lng):
                    lat, lng = None, None

                location = Location(
                    name=item["name"],
                    description=description,
                    category=category,
                    latitude=lat,
                    longitude=lng,
                    city="New York",
                    country="USA",
                    address=item.get("address"),
                    price_level=item.get("price_level"),
                    google_maps_url=item.get("google_maps_url"),
                    rating=item.get("rating"),
                    image_url=item.get("photo_url"),
                    tags=tags,
                    ai_vibe_summary=vibe_summary,
                    gem_level=gem_level,
                    neighborhood=item.get("neighborhood"),
                    source_urls=item.get("source_urls", []),
                )

                locations.append(location)

            except Exception as e:
                logger.warning(
                    "Failed to build location",
                    name=item.get("name", "unknown"),
                    error=str(e),
                )
                continue

        self.stats["final_locations"] = len(locations)
        return locations

    def _infer_category(self, item: dict) -> Category:
        name = item.get("name", "").lower()
        context = (item.get("context") or "").lower()
        combined = f"{name} {context}"

        category_keywords = {
            Category.CAFE: ["cafe", "coffee", "espresso", "bakery", "latte"],
            Category.RESTAURANT: ["restaurant", "diner", "eatery", "kitchen", "food"],
            Category.NIGHTLIFE: ["bar", "pub", "brewery", "cocktail", "nightclub", "speakeasy"],
            Category.MUSEUM: ["museum", "gallery", "exhibit", "art"],
            Category.NATURE: ["park", "garden", "nature", "trail", "outdoor"],
            Category.HISTORICAL: ["historic", "landmark", "monument", "memorial", "old"],
            Category.SHOPPING: ["shop", "store", "market", "boutique"],
            Category.RELAXATION: ["spa", "wellness", "yoga", "massage"],
            Category.ADVENTURE: ["adventure", "escape", "climb", "activity"],
            Category.FESTIVAL: ["festival", "event", "market"],
        }

        for category, keywords in category_keywords.items():
            if any(kw in combined for kw in keywords):
                return category

        return Category.LOCAL

    def _generate_description(self, item: dict) -> str:
        name = item.get("name", "This place")
        neighborhood = item.get("neighborhood", "NYC")
        category = item.get("category", Category.LOCAL)
        context = item.get("context", "")

        atlas_desc = item.get("atlas_description", "")
        if atlas_desc and len(atlas_desc) >= 50:
            return atlas_desc[:500]

        templates = [
            f"{name} is a beloved {category.value} spot in {neighborhood} that locals rave about. "
            f"It's known for its authentic charm and unique character that keeps people coming back.",
            f"Tucked away in {neighborhood}, {name} offers something special that you won't find elsewhere. "
            f"Word of mouth has made this a neighborhood favorite.",
            f"If you're looking for an authentic NYC experience, {name} in {neighborhood} delivers. "
            f"This {category.value} has earned a loyal following for good reason.",
        ]

        return random.choice(templates)

    def _generate_vibe_summary(self, item: dict) -> str:
        vibes = [
            "cozy",
            "authentic",
            "charming",
            "hidden",
            "local",
            "unique",
            "vibrant",
            "intimate",
        ]

        name = item.get("name", "")
        category = item.get("category", Category.LOCAL)

        vibe = random.choice(vibes)

        summaries = [
            f"A {vibe} {category.value} with authentic neighborhood energy.",
            f"{vibe.capitalize()} atmosphere with local charm and character.",
            f"True NYC hidden gem with {vibe}, unpretentious vibes.",
            f"{vibe.capitalize()}, intimate spot beloved by those in the know.",
        ]

        return random.choice(summaries)

    def _generate_tags(self, item: dict) -> list[str]:
        tags = []

        category = item.get("category")
        if category:
            if isinstance(category, Category):
                tags.append(category.value)
            else:
                tags.append(str(category))

        neighborhood = item.get("neighborhood")
        if neighborhood:
            tags.append(neighborhood.lower().replace(" ", "-"))

        vibe_tags = ["local-favorite", "authentic", "neighborhood-gem", "hidden-treasure"]
        tags.extend(random.sample(vibe_tags, min(3, len(vibe_tags))))

        price_level = item.get("price_level")
        if price_level:
            if price_level <= 2:
                tags.append("affordable")
            elif price_level >= 3:
                tags.append("upscale")

        rating = item.get("rating")
        if rating and rating >= 4.5:
            tags.append("highly-rated")

        while len(tags) < 6:
            filler_tags = ["nyc", "must-visit", "worth-the-trip", "insider-pick"]
            for tag in filler_tags:
                if tag not in tags:
                    tags.append(tag)
                    if len(tags) >= 6:
                        break

        return tags[:12]

    def _write_output(self, locations: list[Location]) -> None:
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        write_locations_csv(locations, self.output_path)
        logger.info("Output written", path=str(self.output_path), count=len(locations))


def main():
    log_dir = Path("logs")
    setup_file_logging(log_dir)

    pipeline = WebScraperPipeline(
        max_locations=settings.MAX_LOCATIONS,
        output_path=settings.OUTPUT_DIR / "locations.csv",
    )

    locations = pipeline.run()

    print(f"\n{'=' * 60}")
    print(f"Web Scraper Pipeline Complete")
    print(f"{'=' * 60}")
    print(f"Total locations: {len(locations)}")
    print(f"Output saved to: {pipeline.output_path}")
    print(f"\nDistribution:")

    distribution = pipeline.gem_classifier.get_distribution(
        [{"gem_level": loc.gem_level} for loc in locations]
    )
    for level, count in distribution.items():
        level_name = level.name.replace("_", " ").title()
        print(f"  {level_name}: {count}")

    print(f"\nStats:")
    print(f"  Reddit results: {pipeline.stats['reddit_results']}")
    print(f"  Atlas Obscura results: {pipeline.stats['atlas_results']}")
    print(f"  Google Maps results: {pipeline.stats['google_results']}")
    print(f"  Final locations: {pipeline.stats['final_locations']}")


if __name__ == "__main__":
    main()
