"""Business services for appointments."""

from sqlalchemy.orm import Session

from app.modules.appointments.models import Appointment, AppointmentStatus
from app.modules.appointments.repository import AppointmentRepository
from app.modules.appointments.schemas import AppointmentCreate
from app.modules.auth.models import User
from app.modules.audit.service import record_audit
from app.shared.exceptions import NotFoundError


class AppointmentService:
    """Coordinate appointment persistence for the call workflow."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.appointments = AppointmentRepository(session)

    def list_appointments(self) -> list[Appointment]:
        """Return appointments."""

        return self.appointments.list_all()

    def create_appointment(
        self,
        payload: AppointmentCreate,
        actor: User,
    ) -> Appointment:
        """Create an appointment in waiting status."""

        appointment = Appointment(
            patient_name=payload.patient_name,
            patient_document=payload.patient_document,
            scheduled_for=payload.scheduled_for,
            status=AppointmentStatus.WAITING.value,
            requires_triage=payload.requires_triage,
            external_source=payload.external_source,
            external_id=payload.external_id,
        )
        self.appointments.add(appointment)
        self.session.flush()
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action="appointment.created",
            entity_type="appointment",
            entity_id=appointment.id,
        )
        self.session.commit()
        self.session.refresh(appointment)
        return appointment

    def get_required(self, appointment_id: int) -> Appointment:
        """Return an appointment or raise when missing."""

        appointment = self.appointments.get(appointment_id)
        if appointment is None:
            raise NotFoundError("Agendamento nao encontrado")
        return appointment

