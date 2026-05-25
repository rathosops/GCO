"""
Reconcile database migration state (manual maintenance tool).

Use this when the database schema was modified outside Alembic history
or when alembic_version is out-of-sync (legacy environments).

IMPORTANT:
- This script should NOT be used automatically in container startup.
- Default mode is dry-run (shows what would be done).
- Use --apply to actually stamp/upgrade.
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import os
import sys
import time
from dataclasses import dataclass
from typing import NamedTuple

from flask import Flask
from flask_migrate import stamp, upgrade
from sqlalchemy import inspect, text

from app.app_factory import create_app
from app.database import db

LOGGER = logging.getLogger(__name__)


class TableState(NamedTuple):
    """Database table state."""

    exists: bool
    columns: set[str]


class MigrationCheck(NamedTuple):
    """Check for a migration-like state."""

    revision: str
    description: str
    checks: list[tuple[str, str, bool]]  # (table, column, exists)

    @property
    def is_applied(self) -> bool:
        return all(exists for _, _, exists in self.checks)


@dataclass(frozen=True)
class Settings:
    """Runtime settings."""

    dry_run: bool
    apply: bool
    force_head: bool
    lock_key: int
    lock_timeout_seconds: int


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def _lock_key_from_string(value: str) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    unsigned = int.from_bytes(digest[:8], byteorder="big", signed=False)
    signed = unsigned - (1 << 64) if unsigned >= (1 << 63) else unsigned
    return signed


def _parse_args() -> Settings:
    parser = argparse.ArgumentParser(description="Reconcile Alembic migration state.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show actions without changing the database (default).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes (stamp and/or upgrade).",
    )
    parser.add_argument(
        "--force-head",
        action="store_true",
        help="Force stamp to head (dangerous; use only on known-good schemas).",
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

    # Default is dry-run unless --apply is passed
    dry_run = bool(args.dry_run) or not bool(args.apply)

    if args.lock_key is not None:
        lock_key = int(args.lock_key)
    else:
        lock_name = os.getenv("MIGRATION_LOCK_NAME", "cmi-pcg-server:migrations")
        lock_key = _lock_key_from_string(lock_name)

    return Settings(
        dry_run=dry_run,
        apply=bool(args.apply),
        force_head=bool(args.force_head),
        lock_key=lock_key,
        lock_timeout_seconds=max(0, int(args.lock_timeout)),
    )


def _acquire_lock(lock_key: int, timeout_seconds: int) -> None:
    start = time.monotonic()
    while True:
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

        LOGGER.info("Waiting for advisory lock... (%ss/%ss)", elapsed, timeout_seconds)
        time.sleep(1)


def _release_lock(lock_key: int) -> None:
    try:
        db.session.execute(
            text("SELECT pg_advisory_unlock(:key)"),
            {"key": lock_key},
        )
        LOGGER.info("✓ Advisory lock released (key=%s)", lock_key)
    except Exception as exc:  # pragma: no cover
        LOGGER.warning("Could not release advisory lock: %s", exc)


class Reconciler:
    """Reconcile alembic_version with actual schema (best-effort)."""

    def __init__(self, app: Flask) -> None:
        self.app = app
        self._inspector = None

    def _get_inspector(self):
        if self._inspector is None:
            self._inspector = inspect(db.engine)
        return self._inspector

    def get_table_state(self, table_name: str) -> TableState:
        inspector = self._get_inspector()
        tables = inspector.get_table_names()

        if table_name not in tables:
            return TableState(exists=False, columns=set())

        columns = {col["name"] for col in inspector.get_columns(table_name)}
        return TableState(exists=True, columns=columns)

    def has_column(self, table: str, column: str) -> bool:
        return column in self.get_table_state(table).columns

    def get_current_revision(self) -> str | None:
        try:
            row = db.session.execute(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).fetchone()
            return row[0] if row else None
        except Exception:
            return None

    def check_migrations(self) -> list[MigrationCheck]:
        """
        IMPORTANT:
        This is project-specific knowledge. Keep it small, explicit, and updated
        only when absolutely needed.
        """
        return [
            MigrationCheck(
                revision="8b4aa92bbd9d",
                description="Alterar pagamentos para usar empresa_id e convenio_id",
                checks=[
                    (
                        "pagamentos",
                        "empresa_id",
                        self.has_column("pagamentos", "empresa_id"),
                    ),
                    (
                        "pagamentos",
                        "convenio_id",
                        self.has_column("pagamentos", "convenio_id"),
                    ),
                ],
            ),
            MigrationCheck(
                revision="add_exames_fields",
                description="Adiciona campos em exames",
                checks=[
                    ("exames", "codigo", self.has_column("exames", "codigo")),
                    (
                        "exames",
                        "codigo_parceiro",
                        self.has_column("exames", "codigo_parceiro"),
                    ),
                    ("exames", "valor_venda", self.has_column("exames", "valor_venda")),
                    ("exames", "ativo", self.has_column("exames", "ativo")),
                ],
            ),
            MigrationCheck(
                revision="5560c28f370c",
                description="Atualiza models (agendamentos, clinica_infos, pacientes)",
                checks=[
                    (
                        "agendamentos",
                        "status",
                        self.has_column("agendamentos", "status"),
                    ),
                    (
                        "agendamentos",
                        "observacoes",
                        self.has_column("agendamentos", "observacoes"),
                    ),
                    (
                        "clinica_infos",
                        "cnpj_clinica",
                        self.has_column("clinica_infos", "cnpj_clinica"),
                    ),
                    ("pacientes", "sexo", self.has_column("pacientes", "sexo")),
                    ("pacientes", "cep", self.has_column("pacientes", "cep")),
                ],
            ),
            MigrationCheck(
                revision="46e67639198f",
                description="Merge heads",
                checks=[
                    (
                        "agendamentos",
                        "status",
                        self.has_column("agendamentos", "status"),
                    ),
                    ("exames", "codigo", self.has_column("exames", "codigo")),
                ],
            ),
            MigrationCheck(
                revision="add_auth_columns_v2",
                description="Adiciona colunas auth (roles.created_by, etc)",
                checks=[
                    ("roles", "created_by", self.has_column("roles", "created_by")),
                    ("roles", "updated_at", self.has_column("roles", "updated_at")),
                    ("staff", "updated_at", self.has_column("staff", "updated_at")),
                    ("staff", "created_by", self.has_column("staff", "created_by")),
                ],
            ),
        ]

    def find_target_revision(self, checks: list[MigrationCheck]) -> str | None:
        migration_order = [
            "8b4aa92bbd9d",
            "add_exames_fields",
            "5560c28f370c",
            "46e67639198f",
            "add_auth_columns_v2",
        ]

        check_map = {c.revision: c for c in checks}

        last_applied: str | None = None
        for rev in migration_order:
            check = check_map.get(rev)
            if check and check.is_applied:
                last_applied = rev
            else:
                break

        return last_applied

    def reconcile(self, settings: Settings) -> int:
        LOGGER.info("=" * 60)
        LOGGER.info("RECONCILE MIGRATIONS")
        LOGGER.info("=" * 60)

        current_rev = self.get_current_revision()
        LOGGER.info("Current alembic_version: %s", current_rev or "(none)")

        checks = self.check_migrations()
        for chk in checks:
            status = "✓ APPLIED" if chk.is_applied else "✗ PENDING"
            LOGGER.info("[%s] %s: %s", chk.revision, chk.description, status)

        if settings.force_head:
            if settings.dry_run:
                LOGGER.info("[DRY-RUN] Would stamp: head")
                return 0
            stamp(revision="head")
            LOGGER.info("✓ Stamped to head")
            if settings.apply:
                upgrade()
                LOGGER.info("✓ Upgraded to head")
            return 0

        target = self.find_target_revision(checks)
        if not target:
            LOGGER.info("No target revision detected (db might be new or unknown).")
            if settings.dry_run:
                LOGGER.info("[DRY-RUN] Would run: upgrade -> head (no stamp)")
                return 0
            if settings.apply:
                upgrade()
                LOGGER.info("✓ Upgraded to head")
            return 0

        LOGGER.info("Detected last applied revision: %s", target)

        if settings.dry_run:
            if current_rev != target:
                LOGGER.info(
                    "[DRY-RUN] Would stamp to: %s (and clear alembic_version)", target
                )
            if settings.apply:
                LOGGER.info("[DRY-RUN] Would upgrade to head")
            return 0

        if current_rev != target:
            db.session.execute(text("DELETE FROM alembic_version"))
            db.session.commit()
            stamp(revision=target)
            LOGGER.info("✓ Stamped to %s", target)
        else:
            LOGGER.info("alembic_version already matches detected state")

        if settings.apply:
            upgrade()
            LOGGER.info("✓ Upgraded to head")

        return 0


def main() -> None:
    _configure_logging()
    settings = _parse_args()

    app = create_app(register_blueprints=False)

    with app.app_context():
        if not settings.dry_run:
            _acquire_lock(settings.lock_key, settings.lock_timeout_seconds)

        try:
            reconciler = Reconciler(app)
            code = reconciler.reconcile(settings)
        finally:
            if not settings.dry_run:
                _release_lock(settings.lock_key)

    sys.exit(code)


if __name__ == "__main__":
    main()
