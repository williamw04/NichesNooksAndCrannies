"""Output types for data export."""

import csv
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.shared.types.location import Location

OUTPUT_SCHEMA = [
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


def location_to_csv_row(location: "Location") -> dict:
    return {
        "name": location.name,
        "description": location.description,
        "category": location.category.value
        if hasattr(location.category, "value")
        else location.category,
        "latitude": location.latitude or "",
        "longitude": location.longitude or "",
        "city": location.city,
        "country": location.country,
        "address": location.address or "",
        "price_level": location.price_level or "",
        "google_maps_url": location.google_maps_url or "",
        "rating": location.rating or "",
        "image_url": location.image_url or "",
        "tags": "|".join(location.tags),
        "ai_vibe_summary": location.ai_vibe_summary,
        "gem_level": location.gem_level.value
        if hasattr(location.gem_level, "value")
        else location.gem_level,
        "neighborhood": location.neighborhood or "",
    }


def write_locations_csv(locations: list["Location"], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_SCHEMA)
        writer.writeheader()
        for location in locations:
            writer.writerow(location_to_csv_row(location))


def validate_output_schema(csv_path: Path) -> tuple[bool, list[str]]:
    errors = []

    if not csv_path.exists():
        return False, [f"Output file not found: {csv_path}"]

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []

        missing_fields = set(OUTPUT_SCHEMA) - set(fieldnames)
        if missing_fields:
            errors.append(f"Missing fields: {missing_fields}")

        row_count = sum(1 for _ in reader)
        if row_count == 0:
            errors.append("Output file has no data rows")

    return len(errors) == 0, errors
