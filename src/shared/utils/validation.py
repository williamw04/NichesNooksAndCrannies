"""Validation utilities for location data."""

import re
from typing import Optional

from src.shared.types.location import CHAIN_BLACKLIST, FRAGMENT_BLACKLIST, NON_DESTINATION_BLACKLIST


def validate_coordinates(latitude: Optional[float], longitude: Optional[float]) -> bool:
    if latitude is None or longitude is None:
        return False

    if not (-90 <= latitude <= 90):
        return False

    if not (-180 <= longitude <= 180):
        return False

    nyc_bounds = {
        "lat_min": 40.4774,
        "lat_max": 40.9176,
        "lon_min": -74.2591,
        "lon_max": -73.7004,
    }

    return (
        nyc_bounds["lat_min"] <= latitude <= nyc_bounds["lat_max"]
        and nyc_bounds["lon_min"] <= longitude <= nyc_bounds["lon_max"]
    )


def is_chain(name: str) -> bool:
    normalized = name.lower().strip()
    normalized = re.sub(r"[^\w\s]", "", normalized)

    for chain in CHAIN_BLACKLIST:
        if chain in normalized or normalized in chain:
            return True
        words = normalized.split()
        if any(chain == word for word in words):
            return True

    return False


def is_non_destination(name: str) -> bool:
    normalized = name.lower().strip()

    for term in NON_DESTINATION_BLACKLIST:
        if term in normalized:
            return True

    return False


def is_sentence_fragment(name: str) -> bool:
    normalized = name.lower().strip()

    for fragment in FRAGMENT_BLACKLIST:
        if fragment in normalized:
            return True

    starts_with_lower = name[0].islower() if name else False
    if starts_with_lower:
        return True

    generic_start_words = {
        "the",
        "a",
        "an",
        "this",
        "that",
        "these",
        "those",
        "my",
        "our",
        "their",
        "when",
        "if",
        "what",
        "where",
        "how",
        "why",
        "because",
        "just",
        "only",
        "even",
        "still",
        "also",
        "but",
        "and",
        "or",
        "for",
        "to",
        "in",
        "on",
        "at",
        "by",
        "with",
        "from",
        "some",
        "any",
        "all",
        "each",
        "every",
        "both",
        "few",
        "more",
        "most",
        "other",
        "such",
        "no",
        "not",
        "own",
        "same",
        "so",
        "than",
        "too",
        "very",
    }
    words = normalized.split()
    if words and words[0] in generic_start_words and len(words) < 4:
        return True

    return False


def is_valid_location_name(name: str) -> tuple[bool, str]:
    if not name or len(name) < 3:
        return False, "Name too short"

    if len(name) > 100:
        return False, "Name too long (likely a sentence)"

    if is_chain(name):
        return False, "Chain/franchise"

    if is_non_destination(name):
        return False, "Non-destination (police, hospital, etc.)"

    if is_sentence_fragment(name):
        return False, "Sentence fragment, not a place name"

    if not any(c.isalpha() for c in name):
        return False, "No letters in name"

    return True, "Valid"


def determine_gem_level(review_count: Optional[int], social_proof_score: int) -> int:
    """
    Determine gem level based on review count and social proof.

    Returns:
        1 = ICONIC (widely known, many reviews/mentions)
        2 = LOCAL_FAVORITE (neighborhood known, moderate visibility)
        3 = HIDDEN_GEM (not widely known, low visibility)
    """
    if review_count is None:
        if social_proof_score >= 5:
            return 1
        elif social_proof_score >= 2:
            return 2
        return 3

    if review_count >= 1000:
        return 1
    elif review_count >= 500:
        if social_proof_score >= 4:
            return 1
        return 2
    elif review_count >= 200:
        if social_proof_score >= 4:
            return 2
        return 3
    else:
        if social_proof_score >= 5:
            return 2
        return 3


def validate_description(description: str) -> tuple[bool, str]:
    if len(description) < 50:
        return False, "Description too short (min 50 chars)"

    if len(description) > 500:
        return False, "Description too long (max 500 chars)"

    generic_starts = [
        "located in",
        "this place offers",
        "this is a",
        "we are",
        "come visit",
    ]

    lower_desc = description.lower()
    for generic in generic_starts:
        if lower_desc.startswith(generic):
            return False, f"Description starts with generic phrase: '{generic}'"

    return True, "Valid"


def validate_tags(tags: list[str]) -> tuple[bool, str]:
    if len(tags) < 6:
        return False, f"Not enough tags (min 6, got {len(tags)})"

    if len(tags) > 12:
        return False, f"Too many tags (max 12, got {len(tags)})"

    unique_tags = set(tag.lower().strip() for tag in tags)
    if len(unique_tags) != len(tags):
        return False, "Duplicate tags found"

    return True, "Valid"


def validate_vibe_summary(summary: str) -> tuple[bool, str]:
    if len(summary) < 10:
        return False, "Vibe summary too short (min 10 chars)"

    if len(summary) > 100:
        return False, "Vibe summary too long (max 100 chars)"

    return True, "Valid"
