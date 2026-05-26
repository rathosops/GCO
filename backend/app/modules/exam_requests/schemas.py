"""Schemas de solicitacoes de exames."""

import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.exam_requests.models import ExamRequestStatus


def _digits_or_none(value: str | None) -> str | None:
    """Normalize documentos brasileiros para somente digitos."""

    if value is None:
        return None
    normalized_value = re.sub(r"\D", "", value)
    return normalized_value or None


class ExamRequestItemCreate(BaseModel):
    """Item informado ao criar uma solicitacao."""

    exam_name: str = Field(min_length=1, max_length=180)
    exam_code: str | None = Field(default=None, max_length=60)
    exam_type: str | None = Field(default=None, max_length=80)
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    sort_order: int = 0


class ExamRequestCreate(BaseModel):
    """Dados para criar uma solicitacao de exames."""

    patient_id: int | None = None
    clinical_record_id: int | None = None
    patient_name: str | None = Field(default=None, min_length=1, max_length=160)
    patient_document: str | None = Field(default=None, max_length=20)
    requested_at: datetime | None = None
    status: ExamRequestStatus = ExamRequestStatus.PENDING
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes: str | None = None
    items: list[ExamRequestItemCreate] = Field(min_length=1)

    @field_validator("patient_document", mode="before")
    @classmethod
    def normalize_patient_document(cls, value: str | None) -> str | None:
        """Mantenha documento do paciente apenas com digitos."""

        return _digits_or_none(value)

    @model_validator(mode="after")
    def validate_patient_source(self) -> ExamRequestCreate:
        """Exija origem para identificar o paciente."""

        if (
            self.patient_id is None
            and self.clinical_record_id is None
            and not self.patient_name
        ):
            msg = "Informe paciente, consulta ou nome do paciente"
            raise ValueError(msg)
        return self


class ExamRequestCancel(BaseModel):
    """Motivo para cancelamento de solicitacao."""

    reason: str = Field(min_length=1, max_length=500)


class ExamRequestItemRead(BaseModel):
    """Item de solicitacao retornado pela API."""

    id: int
    exam_request_id: int
    exam_name: str
    exam_code: str | None
    exam_type: str | None
    unit_price: Decimal
    sort_order: int

    model_config = {"from_attributes": True}


class ExamRequestRead(BaseModel):
    """Representacao de solicitacao retornada pela API."""

    id: int
    patient_id: int | None
    clinical_record_id: int | None
    patient_name: str
    patient_document: str | None
    requested_at: datetime
    status: ExamRequestStatus
    subtotal_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    notes: str | None
    cancelled_reason: str | None
    items: list[ExamRequestItemRead]

    model_config = {"from_attributes": True}
