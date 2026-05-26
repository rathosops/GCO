"""Servicos de consultas e prontuario."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.appointments.models import AppointmentStatus
from app.modules.appointments.repository import AppointmentRepository
from app.modules.audit.service import record_audit
from app.modules.auth.models import User
from app.modules.clinical_records.models import ClinicalRecord, ClinicalRecordStatus
from app.modules.clinical_records.repository import ClinicalRecordRepository
from app.modules.clinical_records.schemas import (
    ClinicalRecordCreate,
    ClinicalRecordUpdate,
)
from app.modules.patients.repository import PatientRepository
from app.shared.exceptions import BusinessRuleError, NotFoundError


class ClinicalRecordService:
    """Coordene regras de consulta e prontuario."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.records = ClinicalRecordRepository(session)
        self.appointments = AppointmentRepository(session)
        self.patients = PatientRepository(session)

    def list_records(
        self,
        *,
        patient_id: int | None,
        appointment_id: int | None,
        limit: int,
        offset: int,
    ) -> tuple[list[ClinicalRecord], int]:
        """Liste prontuarios com paginacao."""

        return self.records.list_records(
            patient_id=patient_id,
            appointment_id=appointment_id,
            limit=limit,
            offset=offset,
        )

    def get_record(self, record_id: int) -> ClinicalRecord:
        """Busque um prontuario pelo identificador."""

        record = self.records.get(record_id)
        if record is None:
            raise NotFoundError("Prontuario nao encontrado")
        return record

    def create_record(
        self,
        payload: ClinicalRecordCreate,
        actor: User,
    ) -> ClinicalRecord:
        """Inicie uma consulta e crie seu prontuario."""

        appointment = None
        if payload.appointment_id is not None:
            appointment = self.appointments.get(payload.appointment_id)
            if appointment is None:
                raise NotFoundError("Agendamento nao encontrado")
            if self.records.find_by_appointment_id(appointment.id) is not None:
                raise BusinessRuleError("Agendamento ja possui prontuario")

        patient = None
        if payload.patient_id is not None:
            patient = self.patients.get(payload.patient_id)
            if patient is None:
                raise NotFoundError("Paciente nao encontrado")

        patient_name = payload.patient_name
        patient_document = payload.patient_document
        if patient is not None:
            patient_name = patient.full_name
            patient_document = patient.cpf
        elif appointment is not None:
            patient_name = appointment.patient_name
            patient_document = appointment.patient_document

        if not patient_name:
            raise BusinessRuleError("Nome do paciente e obrigatorio")

        now = datetime.now(UTC)
        record = ClinicalRecord(
            patient_id=patient.id if patient is not None else None,
            appointment_id=appointment.id if appointment is not None else None,
            patient_name=patient_name,
            patient_document=patient_document,
            status=ClinicalRecordStatus.DRAFT.value,
            started_at=payload.started_at or now,
            chief_complaint=payload.chief_complaint,
            history=payload.history,
            physical_exam=payload.physical_exam,
            diagnosis=payload.diagnosis,
            conduct=payload.conduct,
            notes=payload.notes,
        )
        if appointment is not None:
            appointment.status = AppointmentStatus.IN_SERVICE.value

        self.records.add(record)
        self.session.flush()
        self._audit(actor, "clinical_record.created", record)
        self.session.commit()
        self.session.refresh(record)
        return record

    def update_record(
        self,
        record_id: int,
        payload: ClinicalRecordUpdate,
        actor: User,
    ) -> ClinicalRecord:
        """Atualize o prontuario enquanto ele estiver em rascunho."""

        record = self.get_record(record_id)
        if record.status != ClinicalRecordStatus.DRAFT.value:
            raise BusinessRuleError("Prontuario finalizado nao pode ser alterado")

        update_data = payload.model_dump(exclude_unset=True)
        for field_name, field_value in update_data.items():
            setattr(record, field_name, field_value)

        self._audit(actor, "clinical_record.updated", record)
        self.session.commit()
        self.session.refresh(record)
        return record

    def finish_record(self, record_id: int, actor: User) -> ClinicalRecord:
        """Finalize uma consulta clinica."""

        record = self.get_record(record_id)
        if record.status != ClinicalRecordStatus.DRAFT.value:
            raise BusinessRuleError("Prontuario ja esta finalizado")

        record.status = ClinicalRecordStatus.FINISHED.value
        record.finished_at = datetime.now(UTC)
        if record.appointment_id is not None:
            appointment = self.appointments.get(record.appointment_id)
            if appointment is not None:
                appointment.status = AppointmentStatus.COMPLETED.value

        self._audit(actor, "clinical_record.finished", record)
        self.session.commit()
        self.session.refresh(record)
        return record

    def _audit(self, actor: User, action: str, record: ClinicalRecord) -> None:
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action=action,
            entity_type="clinical_record",
            entity_id=record.id,
            payload={
                "appointment_id": record.appointment_id,
                "patient_id": record.patient_id,
            },
        )
