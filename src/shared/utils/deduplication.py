"""Deduplication utilities for location matching."""

import re
from difflib import SequenceMatcher
from typing import Optional


def normalize_for_comparison(name: str) -> str:
    normalized = name.lower().strip()
    normalized = re.sub(r"[^\w\s]", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized)

    suffixes_to_remove = [
        "nyc",
        "new york",
        "brooklyn",
        "manhattan",
        "queens",
        "bronx",
        "restaurant",
        "cafe",
        "coffee",
        "bar",
        "shop",
        "store",
    ]

    for suffix in suffixes_to_remove:
        normalized = re.sub(rf"\b{suffix}\b", "", normalized)

    return normalized.strip()


def calculate_name_similarity(name1: str, name2: str) -> float:
    norm1 = normalize_for_comparison(name1)
    norm2 = normalize_for_comparison(name2)

    if norm1 == norm2:
        return 1.0

    return SequenceMatcher(None, norm1, norm2).ratio()


def locations_match(
    name1: str,
    name2: str,
    address1: Optional[str] = None,
    address2: Optional[str] = None,
    similarity_threshold: float = 0.85,
) -> bool:
    similarity = calculate_name_similarity(name1, name2)

    if similarity >= similarity_threshold:
        return True

    if address1 and address2:
        addr_sim = SequenceMatcher(None, address1.lower(), address2.lower()).ratio()
        if addr_sim > 0.7 and similarity > 0.6:
            return True

    return False


def deduplicate_locations(locations: list[dict], key: str = "name") -> list[dict]:
    if not locations:
        return []

    unique = [locations[0]]

    for location in locations[1:]:
        is_duplicate = False
        for existing in unique:
            if locations_match(
                location.get(key, ""),
                existing.get(key, ""),
                location.get("address"),
                existing.get("address"),
            ):
                is_duplicate = True
                if location.get("source_url") and location.get("source_url") not in existing.get(
                    "source_urls", []
                ):
                    if "source_urls" not in existing:
                        existing["source_urls"] = []
                    existing["source_urls"].append(location.get("source_url"))
                break

        if not is_duplicate:
            unique.append(location)

    return unique


def merge_location_data(primary: dict, secondary: dict) -> dict:
    merged = primary.copy()

    for key, value in secondary.items():
        if key not in merged or merged[key] is None:
            merged[key] = value
        elif key == "source_urls":
            if "source_urls" not in merged:
                merged["source_urls"] = []
            merged["source_urls"].extend(value if isinstance(value, list) else [value])
            merged["source_urls"] = list(set(merged["source_urls"]))

    return merged
