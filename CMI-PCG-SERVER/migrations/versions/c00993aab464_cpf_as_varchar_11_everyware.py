"""cpf as varchar(11) everyware

Revision ID: c00993aab464
Revises: f7acf1d576e7
Create Date: 2026-01-25 16:59:30.779694
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "c00993aab464"
down_revision = "f7acf1d576e7"
branch_labels = None
depends_on = None


def upgrade():
    # ============================================================
    # 1) Drop FKs que apontam para pacientes(cpf)
    # ============================================================
    op.execute("ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_pacientes_fk;")
    op.execute("ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_pacientes_fk;")
    op.execute("ALTER TABLE solicitacoes_de_asos DROP CONSTRAINT IF EXISTS solicitacoes_de_asos_pacientes_fk;")
    op.execute("ALTER TABLE solicitacoes_de_exames DROP CONSTRAINT IF EXISTS solicitacoes_de_exames_pacientes_fk;")

    # ============================================================
    # 2) Alterar tipo nas tabelas dependentes (primeiro)
    #    Mantém zeros à esquerda usando LPAD
    # ============================================================

    # consultas.cpf_paciente
    op.execute(
        """
        ALTER TABLE consultas
        ALTER COLUMN cpf_paciente TYPE varchar(11)
        USING CASE
            WHEN cpf_paciente IS NULL THEN NULL
            ELSE lpad(cpf_paciente::text, 11, '0')
        END;
        """
    )

    # pagamentos.cpf
    op.execute(
        """
        ALTER TABLE pagamentos
        ALTER COLUMN cpf TYPE varchar(11)
        USING CASE
            WHEN cpf IS NULL THEN NULL
            ELSE lpad(cpf::text, 11, '0')
        END;
        """
    )

    # solicitacoes_de_asos.cpf_paciente
    op.execute(
        """
        ALTER TABLE solicitacoes_de_asos
        ALTER COLUMN cpf_paciente TYPE varchar(11)
        USING CASE
            WHEN cpf_paciente IS NULL THEN NULL
            ELSE lpad(cpf_paciente::text, 11, '0')
        END;
        """
    )

    # solicitacoes_de_exames.cpf_paciente
    op.execute(
        """
        ALTER TABLE solicitacoes_de_exames
        ALTER COLUMN cpf_paciente TYPE varchar(11)
        USING CASE
            WHEN cpf_paciente IS NULL THEN NULL
            ELSE lpad(cpf_paciente::text, 11, '0')
        END;
        """
    )

    # ============================================================
    # 3) Alterar pacientes.cpf (tabela “principal”)
    # ============================================================
    op.execute(
        """
        ALTER TABLE pacientes
        ALTER COLUMN cpf TYPE varchar(11)
        USING lpad(cpf::text, 11, '0');
        """
    )

    # ============================================================
    # 4) Garantias: CHECK para 11 dígitos (somente números)
    # ============================================================

    # pacientes.cpf deve ter 11 dígitos
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'pacientes_cpf_digits_11_chk'
            ) THEN
                ALTER TABLE pacientes
                ADD CONSTRAINT pacientes_cpf_digits_11_chk
                CHECK (cpf ~ '^[0-9]{11}$');
            END IF;
        END $$;
        """
    )

    # checks opcionais nas tabelas dependentes (CPF pode ser NULL em algumas)
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultas_cpf_digits_11_chk') THEN
                ALTER TABLE consultas
                ADD CONSTRAINT consultas_cpf_digits_11_chk
                CHECK (cpf_paciente IS NULL OR cpf_paciente ~ '^[0-9]{11}$');
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagamentos_cpf_digits_11_chk') THEN
                ALTER TABLE pagamentos
                ADD CONSTRAINT pagamentos_cpf_digits_11_chk
                CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitacoes_asos_cpf_digits_11_chk') THEN
                ALTER TABLE solicitacoes_de_asos
                ADD CONSTRAINT solicitacoes_asos_cpf_digits_11_chk
                CHECK (cpf_paciente IS NULL OR cpf_paciente ~ '^[0-9]{11}$');
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitacoes_exames_cpf_digits_11_chk') THEN
                ALTER TABLE solicitacoes_de_exames
                ADD CONSTRAINT solicitacoes_exames_cpf_digits_11_chk
                CHECK (cpf_paciente IS NULL OR cpf_paciente ~ '^[0-9]{11}$');
            END IF;
        END $$;
        """
    )

    # ============================================================
    # 5) Recriar FKs
    # ============================================================
    op.execute(
        """
        ALTER TABLE consultas
        ADD CONSTRAINT consultas_pacientes_fk
        FOREIGN KEY (cpf_paciente) REFERENCES pacientes(cpf);
        """
    )

    op.execute(
        """
        ALTER TABLE pagamentos
        ADD CONSTRAINT pagamentos_pacientes_fk
        FOREIGN KEY (cpf) REFERENCES pacientes(cpf);
        """
    )

    op.execute(
        """
        ALTER TABLE solicitacoes_de_asos
        ADD CONSTRAINT solicitacoes_de_asos_pacientes_fk
        FOREIGN KEY (cpf_paciente) REFERENCES pacientes(cpf);
        """
    )

    op.execute(
        """
        ALTER TABLE solicitacoes_de_exames
        ADD CONSTRAINT solicitacoes_de_exames_pacientes_fk
        FOREIGN KEY (cpf_paciente) REFERENCES pacientes(cpf);
        """
    )


def downgrade():
    # ⚠️ Downgrade perde zeros à esquerda (texto -> bigint).
    # Só mantenho para consistência do Alembic.

    # Drop FKs
    op.execute("ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_pacientes_fk;")
    op.execute("ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_pacientes_fk;")
    op.execute("ALTER TABLE solicitacoes_de_asos DROP CONSTRAINT IF EXISTS solicitacoes_de_asos_pacientes_fk;")
    op.execute("ALTER TABLE solicitacoes_de_exames DROP CONSTRAINT IF EXISTS solicitacoes_de_exames_pacientes_fk;")

    # Drop CHECKs
    op.execute("ALTER TABLE pacientes DROP CONSTRAINT IF EXISTS pacientes_cpf_digits_11_chk;")
    op.execute("ALTER TABLE consultas DROP CONSTRAINT IF EXISTS consultas_cpf_digits_11_chk;")
    op.execute("ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_cpf_digits_11_chk;")
    op.execute("ALTER TABLE solicitacoes_de_asos DROP CONSTRAINT IF EXISTS solicitacoes_asos_cpf_digits_11_chk;")
    op.execute("ALTER TABLE solicitacoes_de_exames DROP CONSTRAINT IF EXISTS solicitacoes_exames_cpf_digits_11_chk;")

    # Reverter tipos (varchar -> bigint)
    op.execute(
        """
        ALTER TABLE pacientes
        ALTER COLUMN cpf TYPE bigint
        USING cpf::bigint;
        """
    )

    op.execute(
        """
        ALTER TABLE consultas
        ALTER COLUMN cpf_paciente TYPE bigint
        USING CASE
            WHEN cpf_paciente IS NULL THEN NULL
            ELSE cpf_paciente::bigint
        END;
        """
    )

    op.execute(
        """
        ALTER TABLE pagamentos
        ALTER COLUMN cpf TYPE bigint
        USING CASE
            WHEN cpf IS NULL THEN NULL
            ELSE cpf::bigint
        END;
        """
    )

    op.execute(
        """
        ALTER TABLE solicitacoes_de_asos
        ALTER COLUMN cpf_paciente TYPE bigint
        USING CASE
            WHEN cpf_paciente IS NULL THEN NULL
            ELSE cpf_paciente::bigint
        END;
        """
    )

    op.execute(
        """
        ALTER TABLE solicitacoes_de_exames
        ALTER COLUMN cpf_paciente TYPE bigint
        USING CASE
            WHEN cpf_paciente IS NULL THEN NULL
            ELSE cpf_paciente::bigint
        END;
        """
    )

    # Recriar FKs
    op.execute(
        """
        ALTER TABLE consultas
        ADD CONSTRAINT consultas_pacientes_fk
        FOREIGN KEY (cpf_paciente) REFERENCES pacientes(cpf);
        """
    )

    op.execute(
        """
        ALTER TABLE pagamentos
        ADD CONSTRAINT pagamentos_pacientes_fk
        FOREIGN KEY (cpf) REFERENCES pacientes(cpf);
        """
    )

    op.execute(
        """
        ALTER TABLE solicitacoes_de_asos
        ADD CONSTRAINT solicitacoes_de_asos_pacientes_fk
        FOREIGN KEY (cpf_paciente) REFERENCES pacientes(cpf);
        """
    )

    op.execute(
        """
        ALTER TABLE solicitacoes_de_exames
        ADD CONSTRAINT solicitacoes_de_exames_pacientes_fk
        FOREIGN KEY (cpf_paciente) REFERENCES pacientes(cpf);
        """
    )

