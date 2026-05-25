"""
Adiciona flag aso_embutido_na_consulta à tabela empresas.

Por padrão True — o ASO já está incluso no valor_por_consulta.
O campo valor_por_aso é mantido por compatibilidade mas não é mais utilizado
na lógica de faturamento enquanto aso_embutido_na_consulta=True.
"""

from alembic import op
import sqlalchemy as sa

revision = "add_aso_embutido_na_consulta"
down_revision = "add_company_billing_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "empresas",
        sa.Column(
            "aso_embutido_na_consulta",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )


def downgrade() -> None:
    op.drop_column("empresas", "aso_embutido_na_consulta")
