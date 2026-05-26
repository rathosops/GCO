"""Business services for appointments."""

from sqlalchemy.orm import Session

from app.modules.appointments.models import Appointment, AppointmentStatus
from app.modules.appointments.repository import AppointmentRepository
from app.modules.appointments.schemas import AppointmentCreate
from app.modules.audit.service import record_audit
from app.modules.auth.models import User
from app.modules.patients.repository import PatientRepository
from app.shared.exceptions import BusinessRuleError, NotFoundError


class AppointmentService:
    """Coordinate appointment persistence for the call workflow."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.appointments = AppointmentRepository(session)
        self.patients = PatientRepository(session)

    def list_appointments(self) -> list[Appointment]:
        """Return appointments."""

        return self.appointments.list_all()

    def create_appointment(
        self,
        payload: AppointmentCreate,
        actor: User,
    ) -> Appointment:
        """Create an appointment in waiting status."""

        patient = None
        patient_name = payload.patient_name
        patient_document = payload.patient_document
        if payload.patient_id is not None:
            patient = self.patients.get(payload.patient_id)
            if patient is None:
                raise NotFoundError("Paciente nao encontrado")
            if not patient.is_active:
                raise BusinessRuleError("Paciente inativo nao pode ser agendado")
            patient_name = patient.full_name
            patient_document = patient.cpf

        appointment = Appointment(
            patient_id=patient.id if patient is not None else None,
            patient_name=patient_name,
            patient_document=patient_document,
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

    def render_receipt(self, appointment_id: int) -> str:
        """Renderize um comprovante simples de agendamento."""

        appointment = self.get_required(appointment_id)
        document = appointment.patient_document or "Nao informado"
        return (
            "<!doctype html>"
            '<html lang="pt-BR"><head><meta charset="utf-8">'
            "<title>Comprovante de agendamento</title></head><body>"
            "<main>"
            "<h1>Comprovante de agendamento</h1>"
            f"<p><strong>Paciente:</strong> {appointment.patient_name}</p>"
            f"<p><strong>Documento:</strong> {document}</p>"
            f"<p><strong>Horario:</strong> {appointment.scheduled_for.isoformat()}</p>"
            f"<p><strong>Status:</strong> {appointment.status}</p>"
            "</main></body></html>"
        )

    def get_required(self, appointment_id: int) -> Appointment:
        """Return an appointment or raise when missing."""

        appointment = self.appointments.get(appointment_id)
        if appointment is None:
            raise NotFoundError("Agendamento nao encontrado")
        return appointment
