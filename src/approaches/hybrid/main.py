"""Hybrid Approach - Combines Web Scraper + AI Agent for optimal results.

Phase 1: Web Scraping (fast, cheap bulk collection)
Phase 2: AI Enrichment (quality content generation)
Phase 3: Output
"""

import argparse
from pathlib import Path

from src.approaches.ai_agent.agents.enrichment import EnrichmentAgent
from src.approaches.ai_agent.processors.orchestrator import AIOrchestrator
from src.approaches.web_scraper.main import run_pipeline as run_scraper_pipeline
from src.shared.services.logger import get_logger
from src.shared.types.location import Location
from src.shared.types.output import write_locations_csv

logger = get_logger("hybrid")


def run_hybrid_pipeline(
    output_path: Path,
    max_locations: int = 50,
    skip_scraping: bool = False,
    scraped_data_path: Path | None = None,
) -> list[Location]:
    logger.info(
        "Starting hybrid pipeline",
        max_locations=max_locations,
        output_path=str(output_path),
    )

    phase1_path = Path("data/processed/scraped_candidates.json")

    if not skip_scraping:
        logger.info("Phase 1: Running web scrapers for bulk collection")
        raw_locations = run_scraper_pipeline(
            output_path=phase1_path,
            max_candidates=max_locations * 3,
        )
        logger.info("Scraping complete", locations_found=len(raw_locations))
    else:
        logger.info("Skipping scraping, using existing data")
        import json

        with open(scraped_data_path or phase1_path) as f:
            raw_locations = json.load(f)

    logger.info("Phase 2: AI enrichment for quality content")
    enricher = EnrichmentAgent()

    enriched_locations = []
    for i, loc in enumerate(raw_locations[:max_locations]):
        logger.info(f"Enriching location {i + 1}/{min(len(raw_locations), max_locations)}")
        try:
            enriched = enricher.enrich(loc)
            if enriched:
                enriched_locations.append(enriched)
        except Exception as e:
            logger.error(f"Enrichment failed for {loc.get('name')}: {e}")
            continue

    logger.info("Phase 3: Writing output")
    write_locations_csv(enriched_locations, output_path)
    logger.info(
        "Hybrid pipeline complete",
        total_locations=len(enriched_locations),
        output=str(output_path),
    )

    return enriched_locations


def main():
    parser = argparse.ArgumentParser(description="Hybrid NYC Hidden Gems Discovery")
    parser.add_argument(
        "-n", "--max-locations", type=int, default=50, help="Max locations to generate"
    )
    parser.add_argument("--skip-scraping", action="store_true", help="Use existing scraped data")
    parser.add_argument("--scraped-data", type=Path, help="Path to scraped data JSON")
    parser.add_argument("-o", "--output", type=Path, default=Path("data/output/locations.csv"))

    args = parser.parse_args()

    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    run_hybrid_pipeline(
        output_path=output_path,
        max_locations=args.max_locations,
        skip_scraping=args.skip_scraping,
        scraped_data_path=args.scraped_data,
    )


if __name__ == "__main__":
    main()
