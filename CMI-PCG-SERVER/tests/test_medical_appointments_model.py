import pytest
from datetime import date, time
from sqlalchemy import inspect as sqlalchemy_inspect
from models.medical_appointments_model import Consultas
from app.database import db
from models.patients_model import Pacientes
from models.doctors_model import Medicos


def test_table_and_columns_exist(test_client):
    """Garante que a tabela e colunas da model Consultas existem no banco"""
    inspector = sqlalchemy_inspect(Consultas.metadata.bind)
    table_name = Consultas.__tablename__
    tables = inspector.get_table_names()
    assert table_name in tables, f"Tabela '{table_name}' não encontrada"

    expected_columns = {
        "id": {"nullable": False},
        "cpf_paciente": {"nullable": True},
        "procedimentos": {"nullable": True},
        "data": {"nullable": False},
        "crm_medico": {"nullable": True},
        "tipo": {"nullable": True},
        "houve_solicitacao_de_exame": {"nullable": True},
        "houve_prescricao_medicamentos": {"nullable": True},
        "medicamentos_prescrevidos": {"nullable": True},
        "hora_consulta": {"nullable": True},
        "anamnese": {"nullable": True},
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


def test_create_and_serialize_consulta(test_client):
    """Testa criação de consulta e serialização"""
    # Criando paciente e médico de teste
    paciente = Pacientes(
        nome="Paciente Teste", cpf=12345678901, data_de_nascimento=date(1990, 1, 1)
    )
    medico = Medicos(
        nome="Dr. Teste",
        cpf=98765432100,
        crm=12345,
        data_de_nascimento=date(1980, 1, 1),
        sexo="M",
    )

    db.session.add_all([paciente, medico])
    db.session.commit()

    consulta = Consultas(
        cpf_paciente=paciente.cpf,
        procedimentos="Consulta geral",
        data=date.today(),
        crm_medico=medico.crm,
        tipo="Rotina",
        houve_solicitacao_de_exame=True,
        houve_prescricao_medicamentos=False,
        medicamentos_prescrevidos=None,
        hora_consulta=time(10, 30),
        anamnese="Paciente está saudável",
    )

    db.session.add(consulta)
    db.session.commit()

    saved = db.session.query(Consultas).filter_by(cpf_paciente=paciente.cpf).first()
    assert saved is not None
    assert saved.cpf_paciente == paciente.cpf
    assert saved.crm_medico == medico.crm
    assert saved.procedimentos == "Consulta geral"

    d = saved.to_dict()
    assert d["cpf"] == paciente.cpf
    assert d["nome_do_paciente"] == paciente.nome
    assert d["nome_do_medico"] == medico.nome
    assert d["procedimentos"] == "Consulta geral"
    assert d["houve_solicitacao_de_exame"] is True
    assert d["houve_prescricao_medicamentos"] is False
    assert d["anamnese"] == "Paciente está saudável"

    assert "Consulta paciente" in repr(saved)

    # Limpa o banco
    db.session.delete(saved)
    db.session.delete(paciente)
    db.session.delete(medico)
    db.session.commit()
