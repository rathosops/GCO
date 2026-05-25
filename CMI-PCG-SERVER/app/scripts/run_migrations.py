"""
Run migrations safely (single source of truth).

This script is meant to be used by the container entrypoint.
It applies Alembic/Flask-Migrate migrations with a Postgres advisory lock
to prevent concurrent runs (e.g., multiple replicas, app + worker).

Principles:
- KISS: one job => upgrade to head
- DRY: one place to run migrations
- Explicit is better than implicit (Zen of Python)
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import os
import sys
import time
from dataclasses import dataclass

from flask import Flask
from flask_migrate import upgrade
from sqlalchemy import text

from app.app_factory import create_app
from app.database import db

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class Settings:
    """Runtime settings for migrations."""

    lock_key: int
    lock_timeout_seconds: int
    dry_run: bool


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def _lock_key_from_string(value: str) -> int:
    """
    Derive a stable signed int64 lock key from a string.

    Postgres advisory locks accept BIGINT. Negative values are allowed.
    """
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    # Take first 8 bytes => int64
    unsigned = int.from_bytes(digest[:8], byteorder="big", signed=False)
    signed = unsigned - (1 << 64) if unsigned >= (1 << 63) else unsigned
    return signed


def _parse_args() -> Settings:
    parser = argparse.ArgumentParser(description="Run database migrations safely.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show what would be done (no lock, no upgrade).",
    )
    parser.add_argument(
        "--lock-timeout",
        type=int,
        default=int(os.getenv("MIGRATION_LOCK_TIMEOUT", "60")),
        help="Seconds to wait for Postgres advisory lock (default: 60).",
    )
    parser.add_argument(
        "--lock-key",
        type=int,
        default=None,
        help="Override advisory lock BIGINT key (advanced).",
    )

    args = parser.parse_args()

    if args.lock_key is not None:
        lock_key = int(args.lock_key)
    else:
        # Stable default key (project-scoped). Can be overridden via env.
        lock_name = os.getenv("MIGRATION_LOCK_NAME", "cmi-pcg-server:migrations")
        lock_key = _lock_key_from_string(lock_name)

    return Settings(
        lock_key=lock_key,
        lock_timeout_seconds=max(0, int(args.lock_timeout)),
        dry_run=bool(args.dry_run),
    )


def _get_current_revision() -> str | None:
    """
    Read alembic_version.version_num if table exists; otherwise return None.
    """
    try:
        exists = db.session.execute(
            text(
                "SELECT EXISTS ("
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='alembic_version'"
                ")"
            )
        ).scalar()

        if not exists:
            return None

        row = db.session.execute(
            text("SELECT version_num FROM alembic_version LIMIT 1")
        ).fetchone()
        return row[0] if row else None
    except Exception:  # pragma: no cover (best-effort diagnostics)
        return None


def _acquire_lock(lock_key: int, timeout_seconds: int) -> None:
    """
    Acquire Postgres advisory lock (blocking with timeout).

    Uses pg_try_advisory_lock in a loop to allow a user-friendly timeout.
    """
    start = time.monotonic()
    attempt = 0

    while True:
        attempt += 1
        locked = db.session.execute(
            text("SELECT pg_try_advisory_lock(:key)"),
            {"key": lock_key},
        ).scalar()

        if locked:
            LOGGER.info("✓ Advisory lock acquired (key=%s)", lock_key)
            return

        elapsed = int(time.monotonic() - start)
        if elapsed >= timeout_seconds:
            raise TimeoutError(
                f"Timeout acquiring advisory lock after {timeout_seconds}s (key={lock_key})"
            )

        if attempt == 1 or attempt % 5 == 0:
            LOGGER.info(
                "Waiting for advisory lock... (%ss/%ss, key=%s)",
                elapsed,
                timeout_seconds,
                lock_key,
            )

        time.sleep(1)


def _release_lock(lock_key: int) -> None:
    try:
        unlocked = db.session.execute(
            text("SELECT pg_advisory_unlock(:key)"),
            {"key": lock_key},
        ).scalar()
        LOGGER.info(
            "✓ Advisory lock released (key=%s, released=%s)", lock_key, unlocked
        )
    except Exception as exc:  # pragma: no cover
        LOGGER.warning("Could not release advisory lock: %s", exc)


def run(app: Flask, settings: Settings) -> int:
    """
    Main flow:
    1) (optional) dry-run
    2) acquire advisory lock
    3) upgrade to head
    4) release lock
    """
    with app.app_context():
        current_rev = _get_current_revision()

        if settings.dry_run:
            LOGGER.info(
                "[DRY-RUN] Would acquire advisory lock (key=%s)", settings.lock_key
            )
            LOGGER.info("[DRY-RUN] Current revision: %s", current_rev or "(none)")
            LOGGER.info("[DRY-RUN] Would run: flask db upgrade (to head)")
            return 0

        _acquire_lock(settings.lock_key, settings.lock_timeout_seconds)
        try:
            LOGGER.info("Current revision: %s", current_rev or "(none)")
            LOGGER.info("Running migrations: upgrade -> head")
            upgrade()
            LOGGER.info("✓ Migrations applied successfully")
            return 0
        finally:
            _release_lock(settings.lock_key)


def main() -> None:
    _configure_logging()
    settings = _parse_args()

    # Lighter app boot for migrations
    app = create_app(register_blueprints=False)

    try:
        code = run(app, settings)
    except TimeoutError as exc:
        LOGGER.error("✗ %s", exc)
        sys.exit(1)
    except Exception as exc:  # pylint: disable=broad-except
        LOGGER.exception("✗ Migration run failed: %s", exc)
        sys.exit(1)

    sys.exit(code)


if __name__ == "__main__":
    main()
