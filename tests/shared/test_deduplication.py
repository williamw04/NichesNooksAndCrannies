"""Tests for deduplication utilities."""

import pytest

from src.shared.utils.deduplication import (
    calculate_name_similarity,
    deduplicate_locations,
    locations_match,
    merge_location_data,
    normalize_for_comparison,
)


class TestNormalizeForComparison:
    def test_lowercase(self):
        assert normalize_for_comparison("JOE'S PIZZA") == "joes pizza"

    def test_remove_punctuation(self):
        assert normalize_for_comparison("Joe's Pizza!") == "joes pizza"

    def test_remove_suffixes(self):
        assert normalize_for_comparison("Joe's Pizza NYC") == "joes"
        assert normalize_for_comparison("Brooklyn Coffee Shop") == "brooklyn"


class TestCalculateNameSimilarity:
    def test_identical_names(self):
        assert calculate_name_similarity("Joe's Pizza", "Joe's Pizza") == 1.0

    def test_similar_names(self):
        sim = calculate_name_similarity("Joe's Pizza", "Joes Pizza")
        assert sim > 0.9

    def test_different_names(self):
        sim = calculate_name_similarity("Joe's Pizza", "Mike's Burgers")
        assert sim < 0.5


class TestLocationsMatch:
    def test_exact_match(self):
        assert locations_match("Joe's Pizza", "Joe's Pizza") is True

    def test_similar_names(self):
        assert locations_match("Joe's Pizza", "Joes Pizza") is True

    def test_different_names(self):
        assert locations_match("Joe's Pizza", "Mike's Burgers") is False

    def test_match_with_address(self):
        assert (
            locations_match("Joe's Pizza", "Joes Pizza", "123 Main St", "123 Main Street") is True
        )


class TestDeduplicateLocations:
    def test_removes_duplicates(self):
        locations = [
            {"name": "Joe's Pizza", "address": "123 Main St", "source_url": "url1"},
            {"name": "Joes Pizza", "address": "123 Main St", "source_url": "url2"},
        ]
        result = deduplicate_locations(locations)
        assert len(result) == 1
        assert "url2" in result[0].get("source_urls", [])

    def test_keeps_unique(self):
        locations = [
            {"name": "Joe's Pizza", "address": "123 Main St"},
            {"name": "Mike's Burgers", "address": "456 Oak Ave"},
        ]
        result = deduplicate_locations(locations)
        assert len(result) == 2

    def test_empty_list(self):
        assert deduplicate_locations([]) == []


class TestMergeLocationData:
    def test_merges_missing_fields(self):
        primary = {"name": "Joe's Pizza", "address": None}
        secondary = {"name": "Joe's Pizza", "address": "123 Main St", "rating": 4.5}
        merged = merge_location_data(primary, secondary)
        assert merged["address"] == "123 Main St"
        assert merged["rating"] == 4.5

    def test_keeps_primary_values(self):
        primary = {"name": "Joe's Pizza", "rating": 4.0}
        secondary = {"name": "Joe's Pizza", "rating": 4.5}
        merged = merge_location_data(primary, secondary)
        assert merged["rating"] == 4.0

    def test_merges_source_urls(self):
        primary = {"name": "Joe's Pizza", "source_urls": ["url1"]}
        secondary = {"name": "Joe's Pizza", "source_urls": ["url2"]}
        merged = merge_location_data(primary, secondary)
        assert set(merged["source_urls"]) == {"url1", "url2"}
