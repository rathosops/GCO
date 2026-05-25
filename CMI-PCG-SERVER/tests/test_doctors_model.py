import inspect
from sqlalchemy import inspect as sqlalchemy_inspect
from models.doctors_model import Medicos

def test_table_exists(test_client):
    inspector = sqlalchemy_inspect(Medicos.metadata.bind)
    tables = inspector.get_table_names()
    assert "medicos" in tables

def test_columns_doctors(test_client):
    inspector = sqlalchemy_inspect(Medicos.metadata.bind)
    columns = {col["name"]: col for col in inspector.get_columns("medicos")}

    expected = {
        "id": {"nullable": False},
        "nome": {"nullable": False},
        "data_de_nascimento": {"nullable": False},
        "especialidade": {"nullable": True},
        "cpf": {"nullable": False},
        "crm": {"nullable": False},
        "sexo": {"nullable": False},
    }

    for col, rules in expected.items():
        assert col in columns, f"Coluna {col} não encontrada"
        for rule, expected_value in rules.items():
            assert columns[col][rule] == expected_value
