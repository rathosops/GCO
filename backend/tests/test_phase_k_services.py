"""Testes da operacao clinica da Fase K."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from app.modules.appointments.models import AppointmentStatus
from app.modules.appointments.schemas import AppointmentCreate
from app.modules.appointments.service import AppointmentService
from app.modules.auth.models import User, UserRole
from app.modules.exam_requests.schemas import ExamRequestCreate, ExamRequestItemCreate
from app.modules.exam_requests.service import ExamRequestService
from app.modules.patients.models import Patient
from app.modules.prescriptions.models import PrescriptionKind, PrescriptionStatus
from app.modules.prescriptions.schemas import PrescriptionCreate, PrescriptionItemCreate
from app.modules.prescriptions.service import PrescriptionService
from app.shared.exceptions import BusinessRuleError
from sqlalchemy.orm import Session


def _actor() -> User:
    return User(
        id=1,
        username="medico",
        display_name="Medico",
        password_hash="hash",
        role=UserRole.DOCTOR.value,
        is_active=True,
    )


def test_appointment_uses_active_patient_snapshot(db_session: Session) -> None:
    """Agendamento por paciente copia dados atuais e mantem vinculo."""

    actor = _actor()
    patient = Patient(id=1, full_name="Paciente Agenda", cpf="12345678901")
    db_session.add_all([actor, patient])
    db_session.commit()

    appointment = AppointmentService(db_session).create_appointment(
        AppointmentCreate(
            patient_id=patient.id,
            patient_name="Ignorado",
            scheduled_for=datetime.now(UTC),
        ),
        actor,
    )

    assert appointment.patient_id == patient.id
    assert appointment.patient_name == "Paciente Agenda"
    assert appointment.patient_document == "12345678901"
    assert appointment.status == AppointmentStatus.WAITING.value


def test_appointment_blocks_inactive_patient(db_session: Session) -> None:
    """Paciente inativo nao pode ser usado em novo agendamento."""

    actor = _actor()
    patient = Patient(
        id=1,
        full_name="Paciente Inativo",
        cpf="12345678901",
        is_active=False,
    )
    db_session.add_all([actor, patient])
    db_session.commit()

    with pytest.raises(BusinessRuleError, match="inativo"):
        AppointmentService(db_session).create_appointment(
            AppointmentCreate(
                patient_id=patient.id,
                patient_name="Paciente Inativo",
                scheduled_for=datetime.now(UTC),
            ),
            actor,
        )


def test_create_prescription_with_item(db_session: Session) -> None:
    """Receituario exige item e calcula validade conforme o tipo."""

    actor = _actor()
    patient = Patient(id=1, full_name="Paciente Receita", cpf="12345678901")
    db_session.add_all([actor, patient])
    db_session.commit()

    prescription = PrescriptionService(db_session).create_prescription(
        PrescriptionCreate(
            patient_id=patient.id,
            kind=PrescriptionKind.ANTIMICROBIAL,
            items=[
                PrescriptionItemCreate(
                    medication_name="Medicamento Teste",
                    dosage="500 mg",
                    frequency="12/12h",
                )
            ],
        ),
        actor,
    )

    assert prescription.status == PrescriptionStatus.ACTIVE.value
    assert prescription.patient_name == patient.full_name
    assert len(prescription.items) == 1
    assert (prescription.valid_until - prescription.issued_at.date()).days == 10


def test_create_exam_request_calculates_total(db_session: Session) -> None:
    """Solicitacao soma itens e aplica desconto sem permitir total negativo."""

    actor = _actor()
    patient = Patient(id=1, full_name="Paciente Exame", cpf="12345678901")
    db_session.add_all([actor, patient])
    db_session.commit()

    exam_request = ExamRequestService(db_session).create_request(
        ExamRequestCreate(
            patient_id=patient.id,
            discount_amount=Decimal("10.00"),
            items=[
                ExamRequestItemCreate(
                    exam_name="Hemograma",
                    unit_price=Decimal("50.00"),
                ),
                ExamRequestItemCreate(
                    exam_name="Glicemia",
                    unit_price=Decimal("20.00"),
                ),
            ],
        ),
        actor,
    )

    assert exam_request.subtotal_amount == Decimal("70.00")
    assert exam_request.total_amount == Decimal("60.00")
    assert len(exam_request.items) == 2
