import pytest
from sqlalchemy import inspect as sqlalchemy_inspect
from models.patients_model import Pacientes
from app.database import db
from datetime import date


# ---------- SCHEMA TESTS ----------

def test_table_exists(test_client):
    inspector = sqlalchemy_inspect(Pacientes.metadata.bind)
    tables = inspector.get_table_names()
    assert "pacientes" in tables


def test_columns_patients(test_client):
    inspector = sqlalchemy_inspect(Pacientes.metadata.bind)
    columns = {col["name"]: col for col in inspector.get_columns("pacientes")}

    expected = {
        "id": {"nullable": False},
        "nome": {"nullable": False},
        "cpf": {"nullable": False},
        "data_de_nascimento": {"nullable": False},
        "numero_de_contato": {"nullable": True},
        "email": {"nullable": True},
        "vinculado_a_empresa": {"nullable": True},
        "cnpj_empresa": {"nullable": True},
        "vinculado_a_convenio": {"nullable": True},
        "cnpj_convenio": {"nullable": True},
        "endereco": {"nullable": True},
    }

    for col, rules in expected.items():
        assert col in columns, f"Coluna {col} não encontrada"
        for rule, expected_value in rules.items():
            assert columns[col][rule] == expected_value


# ---------- CONSTRAINTS TESTS ----------

def test_cannot_insert_without_required_fields(test_client):
    paciente = Pacientes()
    db.session.add(paciente)
    with pytest.raises(Exception):
        db.session.commit()
    db.session.rollback()


def test_cannot_insert_duplicate_cpf(test_client):
    p1 = Pacientes(nome="João", cpf=11111111111, data_de_nascimento=date(1990, 1, 1))
    p2 = Pacientes(nome="Maria", cpf=11111111111, data_de_nascimento=date(1995, 5, 5))
    db.session.add(p1)
    db.session.commit()
    db.session.add(p2)
    with pytest.raises(Exception):
        db.session.commit()
    db.session.rollback()


def test_can_insert_valid_patient(test_client):
    paciente = Pacientes(
        nome="Carlos Silva",
        cpf=22222222222,
        data_de_nascimento=date(1988, 7, 14),
        email="carlos@email.com",
        endereco="Rua A, 123"
    )
    db.session.add(paciente)
    db.session.commit()

    saved = Pacientes.query.filter_by(cpf=22222222222).first()
    assert saved is not None
    assert saved.nome == "Carlos Silva"


# ---------- SERIALIZATION TEST ----------

def test_to_dict_format(test_client):
    paciente = Pacientes(
        nome="Ana Paula",
        cpf=33333333333,
        data_de_nascimento=date(2000, 12, 25),
        numero_de_contato=11988887777,
        email="ana@email.com",
        endereco="Rua B, 456"
    )
    db.session.add(paciente)
    db.session.commit()

    saved = Pacientes.query.filter_by(cpf=33333333333).first()
    data = saved.to_dict()

    assert data["nome"] == "Ana Paula"
    assert data["cpf"] == 33333333333
    assert data["data_de_nascimento"] == "25/12/2000"
    assert data["endereco"] == "Rua B, 456"
