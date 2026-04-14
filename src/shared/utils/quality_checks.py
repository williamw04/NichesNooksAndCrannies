"""Quality validation utilities for location data."""

import re
from dataclasses import dataclass, field
from typing import Optional

from src.shared.types.location import Location
from src.shared.utils.validation import (
    is_chain,
    is_non_destination,
    validate_coordinates,
)


@dataclass
class QualityReport:
    location_name: str
    passed: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


TEMPLATE_PHRASES = [
    "tucked away in",
    "if you're looking for",
    "if you are looking for",
    "offers something special",
    "that you won't find elsewhere",
    "word of mouth has made this",
    "a neighborhood favorite",
    "is a beloved local spot",
    "that locals rave about",
    "keeps people coming back",
    "authentic charm and unique character",
    "delivers. this local has earned",
    "authentic nyc experience",
]

NON_NYC_PATTERNS = [
    r"toronto",
    r"ontario",
    r"canada",
    r"troy,?\s*ny",
    r"troy,?\s*new york",
    r"albany,?\s*ny",
    r"jersey city",
    r"new jersey",
    r"hoboken",
    r"yonkers(?! ave)",  # Yonkers Ave is in NYC, but Yonkers city is not
    r"westchester",
    r"long island(?! city)",  # Long Island City is NYC, Long Island is not
    r"staten island",  # Staten Island IS NYC, but keeping for review
]

NYC_NEIGHBORHOODS = [
    "manhattan",
    "brooklyn",
    "queens",
    "bronx",
    "staten island",
    "greenpoint",
    "williamsburg",
    "dumbo",
    "brooklyn heights",
    "park slope",
    "fort greene",
    "cobble hill",
    "carroll gardens",
    "boerum hill",
    "bedford-stuyvesant",
    "bushwick",
    "ridgewood",
    "astoria",
    "long island city",
    "flushing",
    "jackson heights",
    "forest hills",
    "sunnyside",
    "harlem",
    "upper east side",
    "upper west side",
    "midtown",
    "downtown",
    "soho",
    "nolita",
    "little italy",
    "chinatown",
    "lower east side",
    "east village",
    "west village",
    "greenwich village",
    "chelsea",
    "meatpacking",
    "gramercy",
    "murray hill",
    "kips bay",
    "turtle bay",
    "hell's kitchen",
    "clinton",
    "lincoln square",
    "upper manhattan",
    "inwood",
    "washington heights",
    "hamilton heights",
    "morningside heights",
    "south bronx",
    "mott haven",
    "concourse",
    "highbridge",
    "riverdale",
    "woodlawn",
    "fordham",
    "belmont",
    "pelham",
    "throggs neck",
    "st. george",
    "tompkinsville",
    "stapleton",
    "new brighton",
]


def has_template_phrase(description: str) -> tuple[bool, str]:
    """Check if description uses template phrases."""
    lower_desc = description.lower()
    for phrase in TEMPLATE_PHRASES:
        if phrase in lower_desc:
            return True, phrase
    return False, ""


def is_nyc_address(address: Optional[str]) -> tuple[bool, str]:
    """Check if address is within NYC."""
    if not address:
        return False, "No address provided"

    lower_address = address.lower()

    for pattern in NON_NYC_PATTERNS:
        if re.search(pattern, lower_address):
            return False, f"Non-NYC location detected: {pattern}"

    has_nyc_indicator = any(
        [
            "new york, ny" in lower_address,
            "brooklyn, ny" in lower_address,
            "queens, ny" in lower_address,
            "bronx, ny" in lower_address,
            "staten island, ny" in lower_address,
            "manhattan, ny" in lower_address,
            ", ny 1" in lower_address,
            ", ny 0" in lower_address,
            "new york, usa" in lower_address,
        ]
    )

    if not has_nyc_indicator:
        return False, "Address does not clearly indicate NYC"

    return True, "NYC address"


def validate_location_quality(location: Location) -> QualityReport:
    """Comprehensive quality validation for a location."""
    report = QualityReport(location_name=location.name, passed=True)

    if is_chain(location.name):
        report.errors.append("Chain/franchise detected")
        report.passed = False

    if is_non_destination(location.name):
        report.errors.append("Non-destination detected")
        report.passed = False

    if not location.latitude or not location.longitude:
        report.errors.append("Missing coordinates")
        report.passed = False
    elif not validate_coordinates(location.latitude, location.longitude):
        report.errors.append("Coordinates outside NYC bounds")
        report.passed = False

    is_nyc, nyc_msg = is_nyc_address(location.address)
    if not is_nyc:
        report.errors.append(f"Address validation failed: {nyc_msg}")
        report.passed = False

    if location.city and location.city.lower() != "new york":
        report.warnings.append(f"City is '{location.city}', expected 'New York'")

    if location.country and location.country.upper() != "USA":
        report.errors.append(f"Country is '{location.country}', expected 'USA'")
        report.passed = False

    has_template, phrase = has_template_phrase(location.description)
    if has_template:
        report.warnings.append(f"Description uses template phrase: '{phrase}'")

    if len(location.description) < 50:
        report.errors.append("Description too short")
        report.passed = False

    if len(location.tags) < 6:
        report.warnings.append(f"Only {len(location.tags)} tags (minimum 6)")

    if not location.neighborhood:
        report.warnings.append("Missing neighborhood")

    if not location.rating:
        report.warnings.append("Missing rating")

    return report


def filter_valid_locations(locations: list[Location]) -> tuple[list[Location], list[QualityReport]]:
    """Filter locations and return valid ones with reports for all."""
    valid = []
    reports = []

    for loc in locations:
        report = validate_location_quality(loc)
        reports.append(report)
        if report.passed:
            valid.append(loc)

    return valid, reports


def get_quality_summary(reports: list[QualityReport]) -> dict:
    """Get summary statistics from quality reports."""
    total = len(reports)
    passed = sum(1 for r in reports if r.passed)

    error_counts: dict[str, int] = {}
    warning_counts: dict[str, int] = {}

    for report in reports:
        for error in report.errors:
            key = error.split(":")[0] if ":" in error else error
            error_counts[key] = error_counts.get(key, 0) + 1
        for warning in report.warnings:
            key = warning.split(":")[0] if ":" in warning else warning
            warning_counts[key] = warning_counts.get(key, 0) + 1

    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": round(passed / total * 100, 1) if total > 0 else 0,
        "errors": error_counts,
        "warnings": warning_counts,
    }
