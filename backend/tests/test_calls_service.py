"""Tests for central call workflow rules."""

from datetime import UTC, datetime

import pytest
from app.modules.appointments.models import Appointment, AppointmentStatus
from app.modules.auth.models import User, UserRole
from app.modules.calls.models import CallKind
from app.modules.calls.schemas import CallCreate
from app.modules.calls.service import CallService
from app.modules.rooms.models import Room, RoomKind
from app.shared.exceptions import BusinessRuleError
from sqlalchemy.orm import Session


def test_doctor_call_requires_completed_triage(db_session: Session) -> None:
    """Medical calls are blocked until required triage is completed."""

    actor = User(
        id=1,
        username="admin",
        display_name="Admin",
        password_hash="hash",
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    appointment = Appointment(
        id=1,
        patient_name="Paciente Teste",
        scheduled_for=datetime.now(UTC),
        status=AppointmentStatus.WAITING.value,
        requires_triage=True,
    )
    room = Room(
        id=1,
        code="consultorio-1",
        name="Consultorio 1",
        display_name="Consultorio 1",
        kind=RoomKind.OFFICE.value,
        is_active=True,
    )
    db_session.add_all([actor, appointment, room])
    db_session.commit()

    payload = CallCreate(
        appointment_id=appointment.id,
        room_id=room.id,
        kind=CallKind.DOCTOR,
    )

    with pytest.raises(BusinessRuleError, match="triagem"):
        CallService(db_session).create_call(payload, actor)
