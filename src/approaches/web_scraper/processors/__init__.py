"""Web scraper processors module."""

from src.approaches.web_scraper.processors.cross_reference import CrossReferenceProcessor
from src.approaches.web_scraper.processors.deduplicator import DeduplicationProcessor
from src.approaches.web_scraper.processors.gem_classifier import GemClassifier

__all__ = [
    "CrossReferenceProcessor",
    "DeduplicationProcessor",
    "GemClassifier",
]
