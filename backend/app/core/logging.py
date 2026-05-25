"""Logging configuration for the API process."""

import logging
from logging.config import dictConfig


def configure_logging(level: str) -> None:
    """Configure concise structured logs for container stdout."""

    normalized_level = level.upper()
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": (
                        "%(asctime)s %(levelname)s %(name)s "
                        "request_id=%(request_id)s %(message)s"
                    )
                }
            },
            "filters": {
                "request_id": {
                    "()": "app.core.logging.RequestIdFilter",
                }
            },
            "handlers": {
                "default": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "filters": ["request_id"],
                }
            },
            "root": {
                "handlers": ["default"],
                "level": normalized_level,
            },
        }
    )


class RequestIdFilter(logging.Filter):
    """Ensure records always have a request_id attribute."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True
