"""Formatting utilities for text normalization."""

import re
import unicodedata
from typing import Optional


def normalize_name(name: str) -> str:
    name = name.strip()
    name = " ".join(name.split())
    name = unicodedata.normalize("NFKC", name)
    return name


def normalize_neighborhood(neighborhood: str) -> str:
    normalized = neighborhood.strip().title()

    replacements = {
        "Nyc": "NYC",
        "N.y.": "NY",
        "Ny": "NY",
        "Soho": "SoHo",
        "Tribeca": "TriBeCa",
        "Dumbo": "DUMBO",
        "Nolita": "NoLita",
        "Noho": "NoHo",
        "Lower East Side": "Lower East Side",
    }

    for old, new in replacements.items():
        if normalized == old:
            normalized = new
            break

    return normalized


def extract_neighborhood_from_address(address: str) -> Optional[str]:
    neighborhoods = [
        "Manhattan",
        "Brooklyn",
        "Queens",
        "Bronx",
        "Staten Island",
        "Upper East Side",
        "Upper West Side",
        "Midtown",
        "Downtown",
        "SoHo",
        "TriBeCa",
        "DUMBO",
        "Williamsburg",
        "Bushwick",
        "Greenpoint",
        "Park Slope",
        "Brooklyn Heights",
        "Gowanus",
        "Red Hook",
        "Carroll Gardens",
        "Cobble Hill",
        "Boerum Hill",
        "Fort Greene",
        "Clinton Hill",
        "Prospect Heights",
        "Crown Heights",
        "Bedford-Stuyvesant",
        "Bed-Stuy",
        "East Village",
        "West Village",
        "Greenwich Village",
        "NoHo",
        "NoLita",
        "Little Italy",
        "Chinatown",
        "Lower East Side",
        "Financial District",
        "FiDi",
        "Harlem",
        "East Harlem",
        "Morningside Heights",
        "Hamilton Heights",
        "Washington Heights",
        "Inwood",
        "Astoria",
        "Long Island City",
        "Flushing",
        "Jackson Heights",
        "Ridgewood",
        "Forest Hills",
    ]

    for neighborhood in neighborhoods:
        if neighborhood.lower() in address.lower():
            return neighborhood

    return None


def clean_description(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    text = re.sub(r"^(Located|This place|This is|We are)\s+", "", text, flags=re.IGNORECASE)
    return text


def generate_tags_from_text(text: str) -> list[str]:
    vibe_keywords = {
        "cozy": ["cozy", "intimate", "warm", "welcoming"],
        "trendy": ["trendy", "hip", "cool", "stylish", "aesthetic"],
        "romantic": ["romantic", "date night", "candlelit", "intimate"],
        "lively": ["lively", "bustling", "energetic", "vibrant"],
        "quiet": ["quiet", "peaceful", "serene", "calm"],
        "rooftop": ["rooftop", "outdoor", "terrace", "patio"],
        "historic": ["historic", "vintage", "classic", "old-world"],
        "modern": ["modern", "contemporary", "sleek", "minimalist"],
        "moody": ["moody", "dim lighting", "atmospheric", "ambient"],
        "family-friendly": ["family-friendly", "kid-friendly", "all ages"],
    }

    text_lower = text.lower()
    tags = []

    for tag, keywords in vibe_keywords.items():
        if any(kw in text_lower for kw in keywords):
            tags.append(tag)

    return tags[:6]
