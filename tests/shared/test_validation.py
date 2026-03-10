"""Tests for validation utilities."""

import pytest

from src.shared.utils.validation import (
    determine_gem_level,
    is_chain,
    validate_coordinates,
    validate_description,
    validate_tags,
    validate_vibe_summary,
)


class TestValidateCoordinates:
    def test_valid_nyc_coordinates(self):
        assert validate_coordinates(40.7128, -74.0060) is True

    def test_invalid_latitude(self):
        assert validate_coordinates(91.0, -74.0060) is False

    def test_invalid_longitude(self):
        assert validate_coordinates(40.7128, -181.0) is False

    def test_none_coordinates(self):
        assert validate_coordinates(None, -74.0060) is False
        assert validate_coordinates(40.7128, None) is False

    def test_outside_nyc_bounds(self):
        assert validate_coordinates(35.0, -74.0060) is False
        assert validate_coordinates(40.7128, -80.0) is False


class TestIsChain:
    def test_detects_starbucks(self):
        assert is_chain("Starbucks") is True
        assert is_chain("Starbucks Coffee") is True

    def test_detects_mcdonalds(self):
        assert is_chain("McDonald's") is True
        assert is_chain("McDonalds") is True

    def test_detects_subway(self):
        assert is_chain("Subway") is True

    def test_doesnt_detect_local(self):
        assert is_chain("Joe's Pizza") is False
        assert is_chain("Brooklyn Roasting Company") is False

    def test_handles_case_insensitive(self):
        assert is_chain("STARBUCKS") is True
        assert is_chain("mcdonald's") is True


class TestDetermineGemLevel:
    def test_high_review_count_is_iconic(self):
        assert determine_gem_level(2000, 0) == 1

    def test_low_review_count_high_social_is_hidden_gem(self):
        assert determine_gem_level(100, 5) == 3

    def test_medium_review_count_is_local_favorite(self):
        assert determine_gem_level(300, 2) == 2

    def test_none_review_count_uses_social_proof(self):
        assert determine_gem_level(None, 5) == 3
        assert determine_gem_level(None, 2) == 2
        assert determine_gem_level(None, 0) == 1


class TestValidateDescription:
    def test_valid_description(self):
        valid, msg = validate_description(
            "A cozy little spot with amazing coffee and a neighborhood feel."
        )
        assert valid is True

    def test_too_short(self):
        valid, msg = validate_description("Too short")
        assert valid is False
        assert "too short" in msg.lower()

    def test_too_long(self):
        valid, msg = validate_description("x" * 600)
        assert valid is False
        assert "too long" in msg.lower()

    def test_generic_start(self):
        valid, msg = validate_description("Located in Brooklyn, this place offers great food.")
        assert valid is False
        assert "generic" in msg.lower()


class TestValidateTags:
    def test_valid_tags(self):
        valid, msg = validate_tags(["cozy", "coffee", "brunch", "local", "friendly", "wifi"])
        assert valid is True

    def test_too_few_tags(self):
        valid, msg = validate_tags(["cozy", "coffee"])
        assert valid is False
        assert "not enough" in msg.lower()

    def test_too_many_tags(self):
        tags = [f"tag{i}" for i in range(15)]
        valid, msg = validate_tags(tags)
        assert valid is False
        assert "too many" in msg.lower()

    def test_duplicate_tags(self):
        valid, msg = validate_tags(["cozy", "cozy", "coffee", "brunch", "local", "wifi"])
        assert valid is False
        assert "duplicate" in msg.lower()


class TestValidateVibeSummary:
    def test_valid_summary(self):
        valid, msg = validate_vibe_summary("Cozy neighborhood cafe with great light")
        assert valid is True

    def test_too_short(self):
        valid, msg = validate_vibe_summary("Short")
        assert valid is False

    def test_too_long(self):
        valid, msg = validate_vibe_summary("x" * 150)
        assert valid is False
