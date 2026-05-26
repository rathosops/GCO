"""Testes para consultas e prontuario clinico."""

from datetime import UTC, datetime

import pytest
from app.modules.appointments.models import Appointment, AppointmentStatus
from app.modules.auth.models import User, UserRole
from app.modules.clinical_records.models import ClinicalRecordStatus
from app.modules.clinical_records.schemas import (
    ClinicalRecordCreate,
    ClinicalRecordUpdate,
)
from app.modules.clinical_records.service import ClinicalRecordService
from app.modules.patients.models import Patient
from app.shared.exceptions import BusinessRuleError
from sqlalchemy.orm import Session


def test_create_record_from_patient(db_session: Session) -> None:
    """Consulta iniciada por paciente usa dados cadastrais como snapshot."""

    actor = User(
        id=1,
        username="medico",
        display_name="Medico",
        password_hash="hash",
        role=UserRole.DOCTOR.value,
        is_active=True,
    )
    patient = Patient(id=1, full_name="Paciente Clinico", cpf="12345678901")
    db_session.add_all([actor, patient])
    db_session.commit()

    record = ClinicalRecordService(db_session).create_record(
        ClinicalRecordCreate(patient_id=patient.id, chief_complaint="Dor"),
        actor,
    )

    assert record.patient_id == patient.id
    assert record.patient_name == "Paciente Clinico"
    assert record.patient_document == "12345678901"
    assert record.status == ClinicalRecordStatus.DRAFT.value


def test_finish_record_updates_appointment_status(db_session: Session) -> None:
    """Finalizar consulta tambem conclui o agendamento vinculado."""

    actor = User(
        id=1,
        username="medico",
        display_name="Medico",
        password_hash="hash",
        role=UserRole.DOCTOR.value,
        is_active=True,
    )
    appointment = Appointment(
        id=1,
        patient_name="Paciente Agendado",
        scheduled_for=datetime.now(UTC),
        status=AppointmentStatus.IN_SERVICE.value,
    )
    db_session.add_all([actor, appointment])
    db_session.commit()

    service = ClinicalRecordService(db_session)
    record = service.create_record(
        ClinicalRecordCreate(appointment_id=appointment.id, diagnosis="Apto"),
        actor,
    )
    finished_record = service.finish_record(record.id, actor)

    assert finished_record.status == ClinicalRecordStatus.FINISHED.value
    assert appointment.status == AppointmentStatus.COMPLETED.value


def test_finished_record_cannot_be_updated(db_session: Session) -> None:
    """Prontuario finalizado bloqueia edicoes posteriores."""

    actor = User(
        id=1,
        username="medico",
        display_name="Medico",
        password_hash="hash",
        role=UserRole.DOCTOR.value,
        is_active=True,
    )
    db_session.add(actor)
    db_session.commit()

    service = ClinicalRecordService(db_session)
    record = service.create_record(
        ClinicalRecordCreate(patient_name="Paciente Manual"),
        actor,
    )
    service.finish_record(record.id, actor)

    with pytest.raises(BusinessRuleError, match="finalizado"):
        service.update_record(
            record.id,
            ClinicalRecordUpdate(chief_complaint="Novo relato"),
            actor,
        )
