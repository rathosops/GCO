"""Servicos de receituarios."""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.modules.audit.service import record_audit
from app.modules.auth.models import User
from app.modules.clinical_records.repository import ClinicalRecordRepository
from app.modules.patients.repository import PatientRepository
from app.modules.prescriptions.models import (
    Prescription,
    PrescriptionItem,
    PrescriptionKind,
    PrescriptionStatus,
)
from app.modules.prescriptions.repository import (
    PrescriptionItemRepository,
    PrescriptionRepository,
)
from app.modules.prescriptions.schemas import PrescriptionCancel, PrescriptionCreate
from app.shared.exceptions import BusinessRuleError, NotFoundError

VALIDITY_DAYS: dict[PrescriptionKind, int] = {
    PrescriptionKind.SIMPLE: 30,
    PrescriptionKind.SPECIAL_CONTROL: 30,
    PrescriptionKind.ANTIMICROBIAL: 10,
}


class PrescriptionService:
    """Coordene emissao e cancelamento de receituarios."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.prescriptions = PrescriptionRepository(session)
        self.items = PrescriptionItemRepository(session)
        self.patients = PatientRepository(session)
        self.records = ClinicalRecordRepository(session)

    def list_prescriptions(self) -> list[Prescription]:
        """Liste receituarios recentes com seus itens."""

        prescriptions = self.prescriptions.list_recent()
        for prescription in prescriptions:
            prescription.items = self.items.list_by_prescription(prescription.id)
        return prescriptions

    def get_prescription(self, prescription_id: int) -> Prescription:
        """Busque um receituario pelo identificador."""

        prescription = self.prescriptions.get(prescription_id)
        if prescription is None:
            raise NotFoundError("Receituario nao encontrado")
        prescription.items = self.items.list_by_prescription(prescription.id)
        return prescription

    def create_prescription(
        self,
        payload: PrescriptionCreate,
        actor: User,
    ) -> Prescription:
        """Emita um receituario ativo."""

        patient_name = payload.patient_name
        patient_document = payload.patient_document
        patient_id = payload.patient_id

        if payload.patient_id is not None:
            patient = self.patients.get(payload.patient_id)
            if patient is None:
                raise NotFoundError("Paciente nao encontrado")
            if not patient.is_active:
                raise BusinessRuleError("Paciente inativo nao pode receber receituario")
            patient_name = patient.full_name
            patient_document = patient.cpf

        if payload.clinical_record_id is not None:
            record = self.records.get(payload.clinical_record_id)
            if record is None:
                raise NotFoundError("Consulta nao encontrada")
            patient_id = patient_id or record.patient_id
            patient_name = patient_name or record.patient_name
            patient_document = patient_document or record.patient_document

        if not patient_name:
            raise BusinessRuleError("Nome do paciente e obrigatorio")

        issued_at = payload.issued_at or datetime.now(UTC)
        valid_until = payload.valid_until or self._default_valid_until(
            payload.kind,
            issued_at,
        )
        prescription = Prescription(
            patient_id=patient_id,
            clinical_record_id=payload.clinical_record_id,
            patient_name=patient_name,
            patient_document=patient_document,
            kind=payload.kind.value,
            status=PrescriptionStatus.ACTIVE.value,
            issued_at=issued_at,
            valid_until=valid_until,
            instructions=payload.instructions,
            notes=payload.notes,
        )
        self.prescriptions.add(prescription)
        self.session.flush()
        for item_payload in payload.items:
            self.items.add(
                PrescriptionItem(
                    prescription_id=prescription.id,
                    **item_payload.model_dump(),
                )
            )
        self._audit(actor, "prescription.created", prescription)
        self.session.commit()
        self.session.refresh(prescription)
        prescription.items = self.items.list_by_prescription(prescription.id)
        return prescription

    def cancel_prescription(
        self,
        prescription_id: int,
        payload: PrescriptionCancel,
        actor: User,
    ) -> Prescription:
        """Cancele logicamente um receituario ativo."""

        prescription = self.get_prescription(prescription_id)
        if prescription.status != PrescriptionStatus.ACTIVE.value:
            raise BusinessRuleError("Somente receituario ativo pode ser cancelado")
        prescription.status = PrescriptionStatus.CANCELLED.value
        prescription.cancelled_reason = payload.reason
        self._audit(actor, "prescription.cancelled", prescription)
        self.session.commit()
        self.session.refresh(prescription)
        prescription.items = self.items.list_by_prescription(prescription.id)
        return prescription

    def _default_valid_until(
        self,
        kind: PrescriptionKind,
        issued_at: datetime,
    ) -> date:
        days = VALIDITY_DAYS[kind]
        return (issued_at + timedelta(days=days)).date()

    def _audit(self, actor: User, action: str, prescription: Prescription) -> None:
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action=action,
            entity_type="prescription",
            entity_id=prescription.id,
            payload={
                "clinical_record_id": prescription.clinical_record_id,
                "patient_id": prescription.patient_id,
            },
        )
