import pytest
from sqlalchemy import inspect as sqlalchemy_inspect
from datetime import date
from models.payments_model import Pagamentos
from app.database import db


def test_table_and_columns_exist(test_client):
    """Garante que a tabela e colunas da model Pagamentos existem no banco"""
    inspector = sqlalchemy_inspect(Pagamentos.metadata.bind)
    table_name = Pagamentos.__tablename__
    tables = inspector.get_table_names()
    assert table_name in tables, f"Tabela '{table_name}' não encontrada"

    expected_columns = {
        "id": {"nullable": False},
        "tipo": {"nullable": False},
        "valor": {"nullable": False},
        "possui_desconto": {"nullable": True},
        "valor_desconto": {"nullable": True},
        "data": {"nullable": False},
        "nome_do_paciente": {"nullable": True},
        "cpf": {"nullable": True},
        "cnpj_empresas": {"nullable": True},
        "cnpj_convenios": {"nullable": True},
        "origem": {"nullable": False},
        "nome_empresa": {"nullable": True},
        "nome_convenio": {"nullable": True},
        "descricao": {"nullable": True},
        "qtd_parcelas_credito": {"nullable": True},
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
    "tipo,valor,possui_desconto,valor_desconto,data,nome_do_paciente,cpf,cnpj_empresas,cnpj_convenios,origem",
    [
        (
            "Pagamento Avulso",
            150.0,
            True,
            15.0,
            date(2025, 8, 29),
            "João da Silva",
            12345678900,
            None,
            None,
            "Paciente",
        ),
        (
            "Mensalidade",
            500.0,
            False,
            None,
            date(2025, 8, 15),
            None,
            None,
            11122233344455,
            None,
            "Empresa",
        ),
        (
            "Convênio",
            200.0,
            True,
            20.0,
            date(2025, 7, 20),
            None,
            None,
            None,
            55566677788899,
            "Convenio",
        ),
    ],
)
def test_create_and_serialize_pagamento(
    test_client,
    tipo,
    valor,
    possui_desconto,
    valor_desconto,
    data,
    nome_do_paciente,
    cpf,
    cnpj_empresas,
    cnpj_convenios,
    origem,
):
    """Testa criação de pagamento e serialização para múltiplos casos"""
    pg = Pagamentos(
        tipo=tipo,
        valor=valor,
        possui_desconto=possui_desconto,
        valor_desconto=valor_desconto,
        data=data,
        nome_do_paciente=nome_do_paciente,
        cpf=cpf,
        cnpj_empresas=cnpj_empresas,
        cnpj_convenios=cnpj_convenios,
        origem=origem,
        nome_empresa=None,
        nome_convenio=None,
        descricao="Teste",
        qtd_parcelas_credito=None,
    )

    db.session.add(pg)
    db.session.commit()

    saved = db.session.query(Pagamentos).filter_by(tipo=tipo, valor=valor).first()
    assert saved is not None
    assert saved.tipo == tipo
    assert saved.valor == valor

    d = saved.to_dict()
    assert d["tipo"] == tipo
    assert d["valor"] == valor
    assert d["possui_desconto"] == possui_desconto
    assert d["valor_desconto"] == valor_desconto
    assert d["data"] == data.strftime("%Y-%m-%d")

    assert tipo in repr(saved)
    assert str(valor) in repr(saved)
    assert str(data) in repr(saved)

    # Limpa o banco para o próximo parâmetro
    db.session.delete(saved)
    db.session.commit()
