"""legacy_safe_drop_staff_fks_from_audit

Revision ID: 21cae2a12cd5
Revises: merge_pericias_imesc
Create Date: 2026-01-28 12:10:25.876362

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "21cae2a12cd5"
down_revision = "merge_pericias_imesc"
branch_labels = None
depends_on = None


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def _has_table(insp: Inspector, table_name: str) -> bool:
    try:
        return table_name in insp.get_table_names()
    except Exception:
        return False


def _drop_fk_to_staff(insp: Inspector, table: str, constrained_columns: list[str]) -> None:
    """
    Drop FK constraints on `table` that:
      - are constrained on any of constrained_columns
      - reference staff(id)
    Works even when constraint names differ across environments.
    """
    if not _has_table(insp, table):
        return

    fks = insp.get_foreign_keys(table) or []
    target_cols = set(constrained_columns)

    for fk in fks:
        name = fk.get("name")
        cols = set(fk.get("constrained_columns") or [])
        referred_table = fk.get("referred_table")
        referred_cols = set(fk.get("referred_columns") or [])

        if not name:
            continue

        if not (cols & target_cols):
            continue

        if referred_table != "staff":
            continue

        if "id" not in referred_cols:
            continue

        # Drop using batch_alter_table for compatibility
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(name, type_="foreignkey")


def _ensure_fk_to_staff(
    insp: Inspector,
    table: str,
    column: str,
    fk_name: str,
    ondelete: str = "SET NULL",
) -> None:
    """
    Create a FK table.column -> staff.id if:
      - table exists
      - staff exists
      - fk doesn't already exist
    """
    if not _has_table(insp, table):
        return
    if not _has_table(insp, "staff"):
        return

    existing = insp.get_foreign_keys(table) or []
    for fk in existing:
        cols = set(fk.get("constrained_columns") or [])
        if column in cols and fk.get("referred_table") == "staff":
            return  # already has some FK to staff

    with op.batch_alter_table(table) as batch:
        batch.create_foreign_key(
            fk_name,
            "staff",
            [column],
            ["id"],
            ondelete=ondelete,
        )


# -------------------------------------------------------------------
# Tables/columns that must NOT depend on staff.id in legacy-only mode
# -------------------------------------------------------------------
AUDIT_CORE_TABLES = [
    "agendamentos",
    "clinica_infos",
    "empresas",
    "exames",
    "solicitacoes_de_exames",
    "convenios",
    "consultas",
    "pacientes",
    "pagamentos",
    "pericias_imesc",
]

AUDIT_COLUMNS = ["created_by_id", "updated_by_id"]


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1) Drop audit FKs (created_by_id / updated_by_id -> staff.id)
    for table in AUDIT_CORE_TABLES:
        _drop_fk_to_staff(insp, table, AUDIT_COLUMNS)

    # 2) Drop pericias_imesc.staff_parecer_social_id -> staff.id
    _drop_fk_to_staff(insp, "pericias_imesc", ["staff_parecer_social_id"])


def downgrade():
    """
    Best-effort downgrade:
      - Recreate FKs to staff.id if staff table exists.
      - If staff table doesn't exist (legacy-only), downgrade won't break.
    """
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # created_by_id / updated_by_id back to staff.id (SET NULL)
    for table in AUDIT_CORE_TABLES:
        _ensure_fk_to_staff(
            insp, table, "created_by_id", f"fk_{table}_created_by_id_staff", ondelete="SET NULL"
        )
        _ensure_fk_to_staff(
            insp, table, "updated_by_id", f"fk_{table}_updated_by_id_staff", ondelete="SET NULL"
        )

    # pericias_imesc.staff_parecer_social_id back to staff.id (SET NULL)
    _ensure_fk_to_staff(
        insp,
        "pericias_imesc",
        "staff_parecer_social_id",
        "fk_pericias_imesc_staff_parecer_social_id_staff",
        ondelete="SET NULL",
    )
