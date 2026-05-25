"""Testes do servico de pacientes."""

from datetime import date

import pytest
from app.modules.auth.models import User, UserRole
from app.modules.patients.models import PatientSex
from app.modules.patients.schemas import PatientCreate, PatientUpdate
from app.modules.patients.service import PatientService
from app.shared.exceptions import BusinessRuleError
from sqlalchemy.orm import Session


def _actor() -> User:
    """Crie um usuario de apoio para auditoria nos testes."""

    return User(
        id=1,
        username="admin",
        display_name="Admin",
        password_hash="hash",
        role=UserRole.ADMIN.value,
        is_active=True,
    )


def test_create_patient_normalizes_brazilian_fields(db_session: Session) -> None:
    """O cadastro normaliza CPF, CEP e UF antes de persistir."""

    actor = _actor()
    db_session.add(actor)
    db_session.commit()

    payload = PatientCreate(
        full_name="Maria Silva",
        cpf="123.456.789-01",
        birth_date=date(1990, 5, 20),
        sex=PatientSex.FEMALE,
        postal_code="01001-000",
        state="sp",
    )

    patient = PatientService(db_session).create_patient(payload, actor)

    assert patient.cpf == "12345678901"
    assert patient.postal_code == "01001000"
    assert patient.state == "SP"


def test_create_patient_rejects_duplicate_cpf(db_session: Session) -> None:
    """Dois pacientes nao podem compartilhar o mesmo CPF."""

    actor = _actor()
    db_session.add(actor)
    db_session.commit()
    service = PatientService(db_session)
    payload = PatientCreate(full_name="Maria Silva", cpf="12345678901")

    service.create_patient(payload, actor)

    with pytest.raises(BusinessRuleError, match="CPF"):
        service.create_patient(payload, actor)


def test_update_patient_changes_basic_fields(db_session: Session) -> None:
    """A atualizacao altera somente campos enviados."""

    actor = _actor()
    db_session.add(actor)
    db_session.commit()
    service = PatientService(db_session)
    patient = service.create_patient(
        PatientCreate(full_name="Maria Silva", cpf="12345678901"),
        actor,
    )

    updated_patient = service.update_patient(
        patient.id,
        PatientUpdate(full_name="Maria Oliveira", city="Santos"),
        actor,
    )

    assert updated_patient.full_name == "Maria Oliveira"
    assert updated_patient.city == "Santos"
    assert updated_patient.cpf == "12345678901"
