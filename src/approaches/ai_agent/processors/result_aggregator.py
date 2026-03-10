"""Result Aggregator - Combine and deduplicate agent outputs."""

from collections import Counter
from typing import Optional

from pydantic import BaseModel

from src.shared.services.logger import get_logger
from src.shared.types.location import Location
from src.shared.utils.deduplication import locations_match
from src.shared.utils.validation import validate_coordinates

logger = get_logger(__name__)


class AggregationResult(BaseModel):
    locations: list[Location] = []
    duplicates_removed: int = 0
    invalid_removed: int = 0
    gem_distribution: dict[int, int] = {}


def _deduplicate_locations(locations: list[Location]) -> tuple[list[Location], int]:
    """Deduplicate a list of Location objects.

    Args:
        locations: List of locations to deduplicate

    Returns:
        Tuple of (unique locations, count of duplicates removed)
    """
    if not locations:
        return [], 0

    unique: list[Location] = [locations[0]]
    duplicates = 0

    for location in locations[1:]:
        is_duplicate = False
        for existing in unique:
            if locations_match(
                location.name,
                existing.name,
                location.address,
                existing.address,
            ):
                is_duplicate = True
                duplicates += 1
                break

        if not is_duplicate:
            unique.append(location)

    return unique, duplicates


def aggregate_results(
    locations: list[Location],
    target_count: int = 50,
    target_distribution: Optional[dict[int, float]] = None,
) -> AggregationResult:
    """Aggregate and deduplicate location results.

    Args:
        locations: List of locations to aggregate
        target_count: Target number of locations
        target_distribution: Target distribution for gem levels {1: 0.15, 2: 0.35, 3: 0.50}

    Returns:
        AggregationResult with processed locations
    """
    if target_distribution is None:
        target_distribution = {1: 0.15, 2: 0.35, 3: 0.50}

    logger.info(f"Aggregating {len(locations)} locations")

    unique_locations, duplicates = _deduplicate_locations(locations)

    valid_locations = []
    invalid_count = 0

    for location in unique_locations:
        if validate_coordinates(location.latitude, location.longitude):
            valid_locations.append(location)
        else:
            invalid_count += 1
            logger.warning(f"Invalid coordinates for: {location.name}")

    logger.info(
        f"After deduplication and validation: {len(valid_locations)} valid",
        duplicates=duplicates,
        invalid=invalid_count,
    )

    gem_counts = Counter(
        loc.gem_level.value if hasattr(loc.gem_level, "value") else loc.gem_level
        for loc in valid_locations
    )

    if len(valid_locations) > target_count:
        balanced_locations = _balance_gem_distribution(
            valid_locations,
            target_count,
            target_distribution,
        )
    else:
        balanced_locations = valid_locations

    final_distribution = Counter(
        loc.gem_level.value if hasattr(loc.gem_level, "value") else loc.gem_level
        for loc in balanced_locations
    )

    logger.info(
        f"Aggregation complete: {len(balanced_locations)} locations",
        distribution=dict(final_distribution),
    )

    return AggregationResult(
        locations=balanced_locations,
        duplicates_removed=duplicates,
        invalid_removed=invalid_count,
        gem_distribution=dict(final_distribution),
    )


def _balance_gem_distribution(
    locations: list[Location],
    target_count: int,
    target_distribution: dict[int, float],
) -> list[Location]:
    """Balance locations to match target gem distribution.

    Args:
        locations: List of locations
        target_count: Target number of locations
        target_distribution: Target distribution percentages

    Returns:
        Balanced list of locations
    """
    by_gem_level: dict[int, list[Location]] = {1: [], 2: [], 3: []}

    for loc in locations:
        gem_level = loc.gem_level.value if hasattr(loc.gem_level, "value") else loc.gem_level
        if gem_level in by_gem_level:
            by_gem_level[gem_level].append(loc)

    target_counts = {level: int(target_count * pct) for level, pct in target_distribution.items()}

    total_target = sum(target_counts.values())
    if total_target < target_count:
        target_counts[3] += target_count - total_target

    result: list[Location] = []

    for level in [3, 2, 1]:
        level_locations = by_gem_level[level]
        take_count = min(target_counts[level], len(level_locations))
        result.extend(level_locations[:take_count])

    if len(result) < target_count:
        remaining = target_count - len(result)
        for level in [3, 2, 1]:
            level_locations = by_gem_level[level]
            already_taken = min(target_counts[level], len(level_locations))
            available = level_locations[already_taken:]

            take = min(remaining, len(available))
            result.extend(available[:take])
            remaining -= take

            if remaining <= 0:
                break

    return result[:target_count]


class ResultAggregator:
    """Aggregates results from multiple agent runs."""

    def __init__(
        self,
        target_count: int = 50,
        target_distribution: Optional[dict[int, float]] = None,
    ):
        self.target_count = target_count
        self.target_distribution = target_distribution or {1: 0.15, 2: 0.35, 3: 0.50}

    def aggregate(self, locations: list[Location]) -> AggregationResult:
        """Aggregate and process locations."""
        return aggregate_results(
            locations,
            self.target_count,
            self.target_distribution,
        )
