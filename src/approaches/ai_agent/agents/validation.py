"""Validation Agent - Verify locations on Google Maps."""

from typing import Optional

from pydantic import BaseModel, Field

from src.approaches.ai_agent.config.prompts import (
    VALIDATION_AGENT_BACKSTORY,
    VALIDATION_AGENT_GOAL,
    VALIDATION_AGENT_ROLE,
)
from src.approaches.ai_agent.tools.validate_location import (
    LocationValidationResult,
    validate_location,
)
from src.shared.services.logger import get_logger
from src.shared.types.location import LocationCandidate

logger = get_logger(__name__)


class ValidatedLocation(BaseModel):
    candidate: LocationCandidate
    validation: LocationValidationResult
    passed: bool = False
    skip_reason: Optional[str] = None


class ValidationOutput(BaseModel):
    validated: list[ValidatedLocation] = Field(default_factory=list)
    rejected: list[ValidatedLocation] = Field(default_factory=list)
    error: Optional[str] = None


def run_validation(
    candidates: list[LocationCandidate],
    skip_chains: bool = True,
    require_coordinates: bool = True,
) -> ValidationOutput:
    """Validate a list of location candidates.

    Args:
        candidates: List of location candidates to validate
        skip_chains: Skip chain/franchise locations
        require_coordinates: Require valid coordinates

    Returns:
        ValidationOutput with validated and rejected locations
    """
    validated: list[ValidatedLocation] = []
    rejected: list[ValidatedLocation] = []

    logger.info(f"Validating {len(candidates)} candidates")

    for candidate in candidates:
        validation = validate_location(
            name=candidate.name,
            neighborhood=candidate.neighborhood,
        )

        skip_reason = None
        passed = True

        if validation.error:
            passed = False
            skip_reason = f"Validation error: {validation.error}"

        elif not validation.verified:
            passed = False
            skip_reason = "Location not found on Google Maps"

        elif skip_chains and validation.is_chain:
            passed = False
            skip_reason = "Chain/franchise location"

        elif require_coordinates and (not validation.latitude or not validation.longitude):
            passed = False
            skip_reason = "Missing coordinates"

        result = ValidatedLocation(
            candidate=candidate,
            validation=validation,
            passed=passed,
            skip_reason=skip_reason,
        )

        if passed:
            validated.append(result)
            logger.info(f"Validated: {validation.name}")
        else:
            rejected.append(result)
            logger.warning(f"Rejected {candidate.name}: {skip_reason}")

    logger.info(f"Validation complete: {len(validated)} passed, {len(rejected)} rejected")

    return ValidationOutput(validated=validated, rejected=rejected)


class ValidationAgent:
    """Agent for validating location candidates."""

    role: str = VALIDATION_AGENT_ROLE
    goal: str = VALIDATION_AGENT_GOAL
    backstory: str = VALIDATION_AGENT_BACKSTORY

    def run(
        self,
        candidates: list[LocationCandidate],
        skip_chains: bool = True,
        require_coordinates: bool = True,
    ) -> ValidationOutput:
        """Run the validation agent."""
        return run_validation(candidates, skip_chains, require_coordinates)
