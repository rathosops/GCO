"""Business services for calls."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.appointments.models import AppointmentStatus
from app.modules.appointments.repository import AppointmentRepository
from app.modules.auth.models import User
from app.modules.audit.service import record_audit
from app.modules.calls.models import Call, CallKind, CallStatus
from app.modules.calls.repository import CallRepository
from app.modules.calls.schemas import CallCreate, CallFinish
from app.modules.rooms.repository import RoomRepository
from app.modules.triage.service import TriageService
from app.shared.exceptions import BusinessRuleError, NotFoundError


class CallService:
    """Coordinate call workflow rules and persistence."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.appointments = AppointmentRepository(session)
        self.calls = CallRepository(session)
        self.rooms = RoomRepository(session)

    def list_calls(self) -> list[Call]:
        """Return recent calls."""

        return self.calls.list_recent()

    def create_call(self, payload: CallCreate, actor: User) -> Call:
        """Create a call after validating appointment eligibility."""

        appointment = self.appointments.get(payload.appointment_id)
        if appointment is None:
            raise NotFoundError("Agendamento nao encontrado")

        if appointment.status not in (
            AppointmentStatus.WAITING.value,
            AppointmentStatus.CALLED.value,
        ):
            raise BusinessRuleError("Agendamento nao esta elegivel para chamada")

        room = None
        if payload.room_id is not None:
            room = self.rooms.get(payload.room_id)
            if room is None:
                raise NotFoundError("Sala nao encontrada")
            if not room.is_active:
                raise BusinessRuleError("Sala inativa nao pode receber chamadas")

        if (
            appointment.requires_triage
            and payload.kind == CallKind.DOCTOR
            and not TriageService(self.session).is_completed(appointment.id)
        ):
            raise BusinessRuleError("Paciente precisa concluir triagem antes da chamada")

        now = datetime.now(UTC)
        call = Call(
            appointment_id=appointment.id,
            room_id=room.id if room is not None else None,
            called_by_user_id=actor.id,
            status=CallStatus.CALLED.value,
            kind=payload.kind.value,
            sequence_number=self.calls.next_sequence_number(),
            message=payload.message,
            called_at=now,
            notes=payload.notes,
        )
        appointment.status = AppointmentStatus.CALLED.value
        self.calls.add(call)
        self.session.flush()
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action="call.created",
            entity_type="call",
            entity_id=call.id,
            payload={"appointment_id": appointment.id},
        )
        self.session.commit()
        self.session.refresh(call)
        return call

    def start_call(self, call_id: int, actor: User) -> Call:
        """Mark a call as in service."""

        call = self._get_required(call_id)
        if call.status != CallStatus.CALLED.value:
            raise BusinessRuleError("Chamada nao pode ser iniciada neste status")

        call.status = CallStatus.IN_SERVICE.value
        call.started_at = datetime.now(UTC)
        call.appointment.status = AppointmentStatus.IN_SERVICE.value
        self._audit(actor, "call.started", call)
        self.session.commit()
        self.session.refresh(call)
        return call

    def finish_call(self, call_id: int, payload: CallFinish, actor: User) -> Call:
        """Finish a call and update appointment status."""

        call = self._get_required(call_id)
        if call.status not in (CallStatus.CALLED.value, CallStatus.IN_SERVICE.value):
            raise BusinessRuleError("Chamada nao pode ser finalizada neste status")

        call.status = (
            CallStatus.COMPLETED.value
            if payload.patient_attended
            else CallStatus.NO_SHOW.value
        )
        call.finished_at = datetime.now(UTC)
        if payload.notes is not None:
            call.notes = payload.notes
        call.appointment.status = (
            AppointmentStatus.COMPLETED.value
            if payload.patient_attended
            else AppointmentStatus.NO_SHOW.value
        )
        self._audit(actor, "call.finished", call)
        self.session.commit()
        self.session.refresh(call)
        return call

    def cancel_call(self, call_id: int, actor: User) -> Call:
        """Cancel an active call."""

        call = self._get_required(call_id)
        if call.status not in (CallStatus.CALLED.value, CallStatus.IN_SERVICE.value):
            raise BusinessRuleError("Chamada nao pode ser cancelada neste status")

        call.status = CallStatus.CANCELLED.value
        call.cancelled_at = datetime.now(UTC)
        call.appointment.status = AppointmentStatus.CANCELLED.value
        self._audit(actor, "call.cancelled", call)
        self.session.commit()
        self.session.refresh(call)
        return call

    def _get_required(self, call_id: int) -> Call:
        call = self.calls.get(call_id)
        if call is None:
            raise NotFoundError("Chamada nao encontrada")
        return call

    def _audit(self, actor: User, action: str, call: Call) -> None:
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action=action,
            entity_type="call",
            entity_id=call.id,
            payload={"appointment_id": call.appointment_id},
        )
