"""AI Agent Approach - Main Entry Point

This module orchestrates the AI agent pipeline:
1. Discovery Agent - Find candidates from multiple sources
2. Validation Agent - Verify locations on Google Maps
3. Social Proof Agent - Calculate social validation scores
4. Enrichment Agent - Generate descriptions and vibe summaries
5. Output to CSV

Usage:
    python -m src.approaches.ai_agent.main

Or:
    from src.approaches.ai_agent.main import main
    main()
"""

import argparse
from pathlib import Path

from dotenv import load_dotenv

from src.approaches.ai_agent.config.constants import TARGET_LOCATIONS
from src.approaches.ai_agent.config.settings import get_settings
from src.approaches.ai_agent.processors.orchestrator import Orchestrator, run_pipeline
from src.shared.services.logger import get_logger, setup_file_logging

logger = get_logger(__name__)


def main(
    target_locations: int = TARGET_LOCATIONS,
    output_path: Path | None = None,
    dry_run: bool = False,
) -> None:
    """Run the AI agent pipeline.

    Args:
        target_locations: Number of locations to generate
        output_path: Path to save output CSV
        dry_run: If True, don't make API calls (for testing)
    """
    load_dotenv()

    settings = get_settings()

    if output_path is None:
        output_path = Path(settings.output_dir) / "locations.csv"

    log_dir = Path(settings.output_dir).parent / "logs"
    setup_file_logging(log_dir)

    logger.info(f"Starting AI Agent pipeline for {target_locations} locations")
    logger.info(f"Output will be saved to: {output_path}")

    if dry_run:
        logger.info("DRY RUN MODE: Skipping API calls")
        print(f"DRY RUN: Would generate {target_locations} locations")
        print(f"Output path: {output_path}")
        return

    if not settings.openai_api_key:
        logger.error("OPENAI_API_KEY not set")
        print("Error: OPENAI_API_KEY environment variable not set")
        print("Please set it in .env file or export it")
        return

    result = run_pipeline(
        target_locations=target_locations,
        output_path=output_path,
    )

    print("\n" + "=" * 60)
    print("AI Agent Pipeline Complete")
    print("=" * 60)
    print(f"Total locations generated: {len(result.locations)}")
    print(f"  - Discovered: {result.total_discovered}")
    print(f"  - Validated: {result.total_validated}")
    print(f"  - Enriched: {result.total_enriched}")
    print(f"\nGem Distribution:")
    for level, count in sorted(result.gem_distribution.items()):
        pct = (count / len(result.locations) * 100) if result.locations else 0
        print(f"  Level {level}: {count} ({pct:.1f}%)")
    print(f"\nOutput saved to: {output_path}")
    print(f"Duration: {result.duration_seconds:.1f} seconds")

    if result.errors:
        print(f"\nErrors encountered ({len(result.errors)}):")
        for error in result.errors[:5]:
            print(f"  - {error}")
        if len(result.errors) > 5:
            print(f"  ... and {len(result.errors) - 5} more")


def cli() -> None:
    """Command-line interface for the AI agent pipeline."""
    parser = argparse.ArgumentParser(description="AI Agent-based NYC Hidden Gems Discovery")
    parser.add_argument(
        "-n",
        "--num-locations",
        type=int,
        default=TARGET_LOCATIONS,
        help=f"Number of locations to generate (default: {TARGET_LOCATIONS})",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default=None,
        help="Output CSV path (default: data/output/locations.csv)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without making API calls (for testing)",
    )

    args = parser.parse_args()

    output_path = Path(args.output) if args.output else None

    main(
        target_locations=args.num_locations,
        output_path=output_path,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    cli()
