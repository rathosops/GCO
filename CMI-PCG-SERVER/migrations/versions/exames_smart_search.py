"""Adiciona extensões unaccent/pg_trgm e índices GIN para busca inteligente de exames."""

from alembic import op

revision = "exames_smart_search"
down_revision = "add_expenses_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --------------------------------------------------
    # Extensões
    # --------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    # --------------------------------------------------
    # Função IMMUTABLE (referenciando schema corretamente)
    # --------------------------------------------------
    op.execute("""
    CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
    RETURNS text AS $$
        SELECT public.unaccent($1)
    $$ LANGUAGE sql IMMUTABLE;
    """)

    # --------------------------------------------------
    # Índices
    # --------------------------------------------------
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_exames_nome_trgm
        ON exames
        USING GIN (public.immutable_unaccent(lower(nome)) gin_trgm_ops);
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_exames_tipo_trgm
        ON exames
        USING GIN (public.immutable_unaccent(lower(tipo)) gin_trgm_ops);
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_exames_codigo_trgm
        ON exames
        USING GIN (codigo gin_trgm_ops);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_exames_nome_trgm;")
    op.execute("DROP INDEX IF EXISTS ix_exames_tipo_trgm;")
    op.execute("DROP INDEX IF EXISTS ix_exames_codigo_trgm;")

    op.execute("DROP FUNCTION IF EXISTS public.immutable_unaccent(text);")