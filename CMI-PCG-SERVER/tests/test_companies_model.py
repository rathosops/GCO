import pytest
from sqlalchemy import inspect as sqlalchemy_inspect
from models.companies_model import Empresas
from app.database import db


def test_table_and_columns_exist(test_client):
    """Garante que a tabela e colunas da model Empresas existem no banco"""
    inspector = sqlalchemy_inspect(Empresas.metadata.bind)
    table_name = Empresas.__tablename__
    tables = inspector.get_table_names()
    assert table_name in tables, f"Tabela '{table_name}' não encontrada"

    expected_columns = {
        "id": {"nullable": False},
        "cnpj": {"nullable": False},
        "nome": {"nullable": False},
        "numero_para_contato": {"nullable": True},
        "email": {"nullable": True},
    }

    columns = {col["name"]: col for col in inspector.get_columns(table_name)}

    for col_name, rules in expected_columns.items():
        assert (
            col_name in columns
        ), f"Coluna '{col_name}' não encontrada em '{table_name}'"
        for rule, expected_value in rules.items():
            assert columns[col_name][rule] == expected_value, (
                f"Coluna '{col_name}' em '{table_name}': esperado {rule}={expected_value}, "
                f"encontrado {columns[col_name][rule]}"
            )


@pytest.mark.parametrize(
    "cnpj,nome,numero_para_contato,email",
    [
        (11122233344455, "Empresa A", 11999999999, "contato@empresaA.com"),
        (22233344455566, "Empresa B", None, None),
    ],
)
def test_create_and_serialize_empresa(
    test_client, cnpj, nome, numero_para_contato, email
):
    """Testa criação de empresa e serialização"""
    empresa = Empresas(
        cnpj=cnpj, nome=nome, numero_para_contato=numero_para_contato, email=email
    )

    db.session.add(empresa)
    db.session.commit()

    saved = db.session.query(Empresas).filter_by(cnpj=cnpj).first()
    assert saved is not None
    assert saved.cnpj == cnpj
    assert saved.nome == nome
    assert saved.numero_para_contato == numero_para_contato
    assert saved.email == email

    d = saved.to_dict()
    assert d["cnpj"] == cnpj
    assert d["nome"] == nome
    assert d["numero_para_contato"] == numero_para_contato
    assert d["email"] == email
    assert isinstance(d["pacientes"], list)

    assert nome in repr(saved)

    # Limpa o banco
    db.session.delete(saved)
    db.session.commit()
