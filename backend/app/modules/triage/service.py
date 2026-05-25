"""Business services for triage."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.appointments.repository import AppointmentRepository
from app.modules.auth.models import User
from app.modules.audit.service import record_audit
from app.modules.triage.models import TriageRecord, TriageStatus
from app.modules.triage.repository import TriageRecordRepository
from app.modules.triage.schemas import TriageComplete
from app.shared.exceptions import NotFoundError


class TriageService:
    """Coordinate triage rules and persistence."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.appointments = AppointmentRepository(session)
        self.triage_records = TriageRecordRepository(session)

    def complete_triage(
        self,
        appointment_id: int,
        payload: TriageComplete,
        actor: User,
    ) -> TriageRecord:
        """Mark an appointment triage as completed."""

        appointment = self.appointments.get(appointment_id)
        if appointment is None:
            raise NotFoundError("Agendamento nao encontrado")

        record = self.triage_records.get_by_appointment_id(appointment_id)
        now = datetime.now(UTC)
        if record is None:
            record = TriageRecord(
                appointment_id=appointment_id,
                triaged_by_user_id=actor.id,
                status=TriageStatus.COMPLETED.value,
                notes=payload.notes,
                completed_at=now,
            )
            self.triage_records.add(record)
        else:
            record.triaged_by_user_id = actor.id
            record.status = TriageStatus.COMPLETED.value
            record.notes = payload.notes
            record.completed_at = now

        self.session.flush()
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action="triage.completed",
            entity_type="triage_record",
            entity_id=record.id,
            payload={"appointment_id": appointment_id},
        )
        self.session.commit()
        self.session.refresh(record)
        return record

    def is_completed(self, appointment_id: int) -> bool:
        """Return whether triage is completed for an appointment."""

        record = self.triage_records.get_by_appointment_id(appointment_id)
        return record is not None and record.status == TriageStatus.COMPLETED.value

