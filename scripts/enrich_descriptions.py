"""Enrich descriptions using OpenRouter LLM."""

import csv
import time
from pathlib import Path

from src.approaches.ai_agent.utils.llm_client import complete
from src.shared.services.logger import get_logger

logger = get_logger("enrich_descriptions")


SYSTEM_PROMPT = """You write short descriptions of NYC places. Be specific and creative.
Write exactly 2-3 sentences about what makes the place special.
Mention unique features, atmosphere, or what visitors will find.
Do NOT use these phrases: "hidden gem", "tucked away", "authentic", "locals love".
Respond with ONLY the description, nothing else."""


def generate_description(
    name: str, category: str, neighborhood: str = None, rating: float = None
) -> str:
    """Generate a unique description for a location."""
    context = f"Place: {name}"
    if category:
        context += f"\nCategory: {category}"
    if neighborhood:
        context += f"\nNeighborhood: {neighborhood}"
    if rating:
        context += f"\nRating: {rating}/5"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Write a unique description for this NYC spot:\n\n{context}"},
    ]

    try:
        result = complete(messages, temperature=0.8, max_tokens=200, enable_reasoning=False)
        result = result.strip()
        # Extract only the actual description, not reasoning
        if "Final answer:" in result:
            result = result.split("Final answer:")[-1].strip()
        return result[:500]
    except Exception as e:
        logger.error("Failed to generate description", name=name, error=str(e))
        return f"A unique {category} spot in NYC worth discovering."


def generate_vibe(name: str, category: str) -> str:
    """Generate a vibe summary."""
    messages = [
        {
            "role": "system",
            "content": "Write a 10-20 word vibe summary for a place. Be creative and specific. No generic phrases.",
        },
        {"role": "user", "content": f"Write a vibe summary for: {name} ({category} in NYC)"},
    ]

    try:
        result = complete(messages, temperature=0.9, max_tokens=100, enable_reasoning=False)
        result = result.strip()
        if "Final answer:" in result:
            result = result.split("Final answer:")[-1].strip()
        return result[:100]
    except Exception as e:
        return f"Authentic {category} spot with local charm."


def enrich_csv(input_file: Path, output_file: Path, limit: int = None):
    """Enrich a CSV file with better descriptions."""
    with open(input_file) as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if limit:
        rows = rows[:limit]

    enriched = []
    for i, row in enumerate(rows):
        name = row["name"]
        category = row["category"]

        print(f"[{i + 1}/{len(rows)}] Enriching: {name[:40]}...")

        # Generate new description
        if "unique" in row["description"].lower() and "locals love" in row["description"].lower():
            row["description"] = generate_description(
                name=name,
                category=category,
                neighborhood=row.get("neighborhood"),
                rating=float(row["rating"]) if row.get("rating") else None,
            )

        # Generate new vibe summary
        if (
            "authentic" in row["ai_vibe_summary"].lower()
            and "local" in row["ai_vibe_summary"].lower()
        ):
            row["ai_vibe_summary"] = generate_vibe(name, category)

        enriched.append(row)
        time.sleep(0.5)

    # Write output
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
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
            ],
        )
        writer.writeheader()
        writer.writerows(enriched)

    print(f"\nEnriched {len(enriched)} locations -> {output_file}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Enrich descriptions with LLM")
    parser.add_argument("-i", "--input", default="data/output/v2/locations_2026-03-17.csv")
    parser.add_argument("-o", "--output", default="data/output/v2/locations_enriched.csv")
    parser.add_argument("-n", "--limit", type=int, default=None)

    args = parser.parse_args()

    enrich_csv(
        Path(args.input),
        Path(args.output),
        limit=args.limit,
    )
