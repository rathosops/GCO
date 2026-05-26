"""Schemas de receituarios."""

import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.prescriptions.models import PrescriptionKind, PrescriptionStatus


def _digits_or_none(value: str | None) -> str | None:
    """Normalize documentos brasileiros para somente digitos."""

    if value is None:
        return None
    normalized_value = re.sub(r"\D", "", value)
    return normalized_value or None


class PrescriptionItemCreate(BaseModel):
    """Item informado ao criar um receituario."""

    medication_name: str = Field(min_length=1, max_length=180)
    dosage: str | None = Field(default=None, max_length=120)
    route: str | None = Field(default=None, max_length=80)
    frequency: str | None = Field(default=None, max_length=120)
    duration: str | None = Field(default=None, max_length=120)
    quantity: str | None = Field(default=None, max_length=80)
    unit_price: Decimal | None = None
    instructions: str | None = None


class PrescriptionCreate(BaseModel):
    """Dados para emitir um receituario."""

    patient_id: int | None = None
    clinical_record_id: int | None = None
    patient_name: str | None = Field(default=None, min_length=1, max_length=160)
    patient_document: str | None = Field(default=None, max_length=20)
    kind: PrescriptionKind = PrescriptionKind.SIMPLE
    issued_at: datetime | None = None
    valid_until: date | None = None
    instructions: str | None = None
    notes: str | None = None
    items: list[PrescriptionItemCreate] = Field(min_length=1)

    @field_validator("patient_document", mode="before")
    @classmethod
    def normalize_patient_document(cls, value: str | None) -> str | None:
        """Mantenha documento do paciente apenas com digitos."""

        return _digits_or_none(value)

    @model_validator(mode="after")
    def validate_patient_source(self) -> PrescriptionCreate:
        """Exija uma origem para identificar o paciente."""

        if (
            self.patient_id is None
            and self.clinical_record_id is None
            and not self.patient_name
        ):
            msg = "Informe paciente, consulta ou nome do paciente"
            raise ValueError(msg)
        return self


class PrescriptionCancel(BaseModel):
    """Motivo para cancelamento logico de receituario."""

    reason: str = Field(min_length=1, max_length=500)


class PrescriptionItemRead(BaseModel):
    """Item de receituario retornado pela API."""

    id: int
    prescription_id: int
    medication_name: str
    dosage: str | None
    route: str | None
    frequency: str | None
    duration: str | None
    quantity: str | None
    unit_price: Decimal | None
    instructions: str | None

    model_config = {"from_attributes": True}


class PrescriptionRead(BaseModel):
    """Representacao de receituario retornada pela API."""

    id: int
    patient_id: int | None
    clinical_record_id: int | None
    patient_name: str
    patient_document: str | None
    kind: PrescriptionKind
    status: PrescriptionStatus
    issued_at: datetime
    valid_until: date
    instructions: str | None
    notes: str | None
    cancelled_reason: str | None
    items: list[PrescriptionItemRead]

    model_config = {"from_attributes": True}
