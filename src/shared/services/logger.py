"""Structured logging utilities."""

import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if hasattr(record, "data") and record.data:
            log_entry["data"] = record.data

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


class StructuredLogger:
    def __init__(self, name: str, level: int = logging.INFO):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)

        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(StructuredFormatter())
            self.logger.addHandler(handler)

    def _log(self, level: int, message: str, **kwargs: Any) -> None:
        extra = {"data": kwargs} if kwargs else {}
        self.logger.log(level, message, extra=extra)

    def info(self, message: str, **kwargs: Any) -> None:
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs: Any) -> None:
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs: Any) -> None:
        self._log(logging.ERROR, message, **kwargs)

    def debug(self, message: str, **kwargs: Any) -> None:
        self._log(logging.DEBUG, message, **kwargs)

    def log_location_found(self, name: str, source: str, gem_level: Optional[int] = None) -> None:
        self.info(
            "Location found",
            name=name,
            source=source,
            gem_level=gem_level,
        )

    def log_validation_failed(self, name: str, reason: str) -> None:
        self.warning(
            "Validation failed",
            name=name,
            reason=reason,
        )

    def log_api_request(self, service: str, endpoint: str, status: str) -> None:
        self.debug(
            "API request",
            service=service,
            endpoint=endpoint,
            status=status,
        )

    def log_scrape_result(self, source: str, count: int, duration_ms: float) -> None:
        self.info(
            "Scrape complete",
            source=source,
            locations_found=count,
            duration_ms=duration_ms,
        )

    def log_cost(self, service: str, tokens: int, cost_usd: float) -> None:
        self.info(
            "API cost",
            service=service,
            tokens=tokens,
            cost_usd=cost_usd,
        )


_loggers: dict[str, StructuredLogger] = {}


def get_logger(name: str) -> StructuredLogger:
    if name not in _loggers:
        _loggers[name] = StructuredLogger(name)
    return _loggers[name]


def setup_file_logging(log_dir: Path, name: str = "hidden-gems") -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"{name}.log"

    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(StructuredFormatter())

    root_logger = logging.getLogger()
    root_logger.addHandler(file_handler)
