"""Servicos de solicitacoes de exames."""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.audit.service import record_audit
from app.modules.auth.models import User
from app.modules.clinical_records.repository import ClinicalRecordRepository
from app.modules.exam_requests.models import (
    ExamRequest,
    ExamRequestItem,
    ExamRequestStatus,
)
from app.modules.exam_requests.repository import (
    ExamRequestItemRepository,
    ExamRequestRepository,
)
from app.modules.exam_requests.schemas import ExamRequestCancel, ExamRequestCreate
from app.modules.patients.repository import PatientRepository
from app.shared.exceptions import BusinessRuleError, NotFoundError


class ExamRequestService:
    """Coordene solicitacoes de exames."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.requests = ExamRequestRepository(session)
        self.items = ExamRequestItemRepository(session)
        self.patients = PatientRepository(session)
        self.records = ClinicalRecordRepository(session)

    def list_requests(self) -> list[ExamRequest]:
        """Liste solicitacoes recentes com itens."""

        requests = self.requests.list_recent()
        for exam_request in requests:
            exam_request.items = self.items.list_by_request(exam_request.id)
        return requests

    def get_request(self, exam_request_id: int) -> ExamRequest:
        """Busque uma solicitacao pelo identificador."""

        exam_request = self.requests.get(exam_request_id)
        if exam_request is None:
            raise NotFoundError("Solicitacao de exames nao encontrada")
        exam_request.items = self.items.list_by_request(exam_request.id)
        return exam_request

    def create_request(
        self,
        payload: ExamRequestCreate,
        actor: User,
    ) -> ExamRequest:
        """Crie uma solicitacao de exames."""

        patient_name = payload.patient_name
        patient_document = payload.patient_document
        patient_id = payload.patient_id

        if payload.patient_id is not None:
            patient = self.patients.get(payload.patient_id)
            if patient is None:
                raise NotFoundError("Paciente nao encontrado")
            if not patient.is_active:
                raise BusinessRuleError("Paciente inativo nao pode receber solicitacao")
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

        subtotal_amount = sum(
            (item.unit_price for item in payload.items),
            Decimal("0.00"),
        )
        total_amount = subtotal_amount - payload.discount_amount
        if total_amount < 0:
            raise BusinessRuleError("Valor final da solicitacao nao pode ser negativo")

        exam_request = ExamRequest(
            patient_id=patient_id,
            clinical_record_id=payload.clinical_record_id,
            patient_name=patient_name,
            patient_document=patient_document,
            requested_at=payload.requested_at or datetime.now(UTC),
            status=payload.status.value,
            subtotal_amount=subtotal_amount,
            discount_amount=payload.discount_amount,
            total_amount=total_amount,
            notes=payload.notes,
        )
        self.requests.add(exam_request)
        self.session.flush()
        for item_payload in payload.items:
            self.items.add(
                ExamRequestItem(
                    exam_request_id=exam_request.id,
                    **item_payload.model_dump(),
                )
            )
        self._audit(actor, "exam_request.created", exam_request)
        self.session.commit()
        self.session.refresh(exam_request)
        exam_request.items = self.items.list_by_request(exam_request.id)
        return exam_request

    def cancel_request(
        self,
        exam_request_id: int,
        payload: ExamRequestCancel,
        actor: User,
    ) -> ExamRequest:
        """Cancele uma solicitacao pendente ou externa."""

        exam_request = self.get_request(exam_request_id)
        if exam_request.status == ExamRequestStatus.CANCELLED.value:
            raise BusinessRuleError("Solicitacao ja esta cancelada")
        exam_request.status = ExamRequestStatus.CANCELLED.value
        exam_request.cancelled_reason = payload.reason
        self._audit(actor, "exam_request.cancelled", exam_request)
        self.session.commit()
        self.session.refresh(exam_request)
        exam_request.items = self.items.list_by_request(exam_request.id)
        return exam_request

    def _audit(self, actor: User, action: str, exam_request: ExamRequest) -> None:
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action=action,
            entity_type="exam_request",
            entity_id=exam_request.id,
            payload={
                "clinical_record_id": exam_request.clinical_record_id,
                "patient_id": exam_request.patient_id,
            },
        )
