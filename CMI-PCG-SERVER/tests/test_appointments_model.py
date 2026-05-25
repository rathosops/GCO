import pytest
from sqlalchemy import inspect as sqlalchemy_inspect
from models.appointments_model import Agendamentos
from app.database import db
from datetime import date, time


def test_table_and_columns_exist(test_client):
    """Garante que a tabela e colunas da model Agendamentos existem no banco"""
    inspector = sqlalchemy_inspect(Agendamentos.metadata.bind)

    table_name = Agendamentos.__tablename__
    tables = inspector.get_table_names()
    assert table_name in tables, f"Tabela '{table_name}' não encontrada"

    expected_columns = {
        "id": {"nullable": False},
        "dia": {"nullable": False},
        "hora": {"nullable": False},
        "cpf_paciente": {"nullable": True},
        "nome_paciente": {"nullable": True},
        "procedimento": {"nullable": True},
        "numero_de_contato": {"nullable": True},
        "numero_de_protocolo": {"nullable": True},
        "paciente_compareceu": {"nullable": True},
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
    "dia,hora,cpf_paciente,nome_paciente,procedimento,numero_de_contato,numero_de_protocolo,paciente_compareceu",
    [
        (
            date(2025, 1, 1),
            time(10, 30),
            12345678900,
            "João da Silva",
            "Consulta",
            11999999999,
            5555,
            True,
        ),
        (
            date(2025, 2, 15),
            time(14, 0),
            None,
            "Maria Oliveira",
            None,
            None,
            7777,
            False,
        ),
        (
            date(2025, 3, 20),
            time(9, 15),
            98765432100,
            "Carlos Souza",
            "Exame",
            11988887777,
            None,
            None,
        ),
    ],
)
def test_create_and_serialize_agendamento(
    test_client,
    dia,
    hora,
    cpf_paciente,
    nome_paciente,
    procedimento,
    numero_de_contato,
    numero_de_protocolo,
    paciente_compareceu,
):
    """Testa criação de agendamento e serialização para múltiplos casos"""
    ag = Agendamentos(
        dia=dia,
        hora=hora,
        cpf_paciente=cpf_paciente,
        nome_paciente=nome_paciente,
        procedimento=procedimento,
        numero_de_contato=numero_de_contato,
        numero_de_protocolo=numero_de_protocolo,
        paciente_compareceu=paciente_compareceu,
    )

    db.session.add(ag)
    db.session.commit()

    saved = (
        db.session.query(Agendamentos).filter_by(nome_paciente=nome_paciente).first()
    )
    assert saved is not None
    assert saved.nome_paciente == nome_paciente

    d = saved.to_dict()
    assert d["nome_paciente"] == nome_paciente
    assert d["procedimento"] == procedimento
    assert d["cpf_paciente"] == cpf_paciente

    assert nome_paciente in repr(saved)
    assert dia.isoformat() in repr(saved)
    assert hora.isoformat() in repr(saved)

    # Limpa o banco para o próximo parâmetro
    db.session.delete(saved)
    db.session.commit()
