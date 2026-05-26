"""Schemas de consultas e prontuario."""

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.clinical_records.models import ClinicalRecordStatus


def _digits_or_none(value: str | None) -> str | None:
    """Normalize documentos brasileiros para somente digitos."""

    if value is None:
        return None
    normalized_value = re.sub(r"\D", "", value)
    return normalized_value or None


class ClinicalRecordCreate(BaseModel):
    """Dados para iniciar uma consulta clinica."""

    patient_id: int | None = None
    appointment_id: int | None = None
    patient_name: str | None = Field(default=None, min_length=1, max_length=160)
    patient_document: str | None = Field(default=None, max_length=20)
    started_at: datetime | None = None
    chief_complaint: str | None = None
    history: str | None = None
    physical_exam: str | None = None
    diagnosis: str | None = None
    conduct: str | None = None
    notes: str | None = None

    @field_validator("patient_document", mode="before")
    @classmethod
    def normalize_patient_document(cls, value: str | None) -> str | None:
        """Mantenha documento do paciente apenas com digitos."""

        return _digits_or_none(value)

    @model_validator(mode="after")
    def validate_patient_source(self) -> ClinicalRecordCreate:
        """Exija uma origem para identificar o paciente atendido."""

        if (
            self.patient_id is None
            and self.appointment_id is None
            and not self.patient_name
        ):
            msg = "Informe paciente, agendamento ou nome do paciente"
            raise ValueError(msg)
        return self


class ClinicalRecordUpdate(BaseModel):
    """Campos editaveis do prontuario enquanto a consulta esta aberta."""

    patient_name: str | None = Field(default=None, min_length=1, max_length=160)
    patient_document: str | None = Field(default=None, max_length=20)
    chief_complaint: str | None = None
    history: str | None = None
    physical_exam: str | None = None
    diagnosis: str | None = None
    conduct: str | None = None
    notes: str | None = None

    @field_validator("patient_document", mode="before")
    @classmethod
    def normalize_patient_document(cls, value: str | None) -> str | None:
        """Mantenha documento do paciente apenas com digitos."""

        return _digits_or_none(value)


class ClinicalRecordRead(BaseModel):
    """Representacao de uma consulta retornada pela API."""

    id: int
    patient_id: int | None
    appointment_id: int | None
    patient_name: str
    patient_document: str | None
    status: ClinicalRecordStatus
    started_at: datetime
    finished_at: datetime | None
    chief_complaint: str | None
    history: str | None
    physical_exam: str | None
    diagnosis: str | None
    conduct: str | None
    notes: str | None

    model_config = {"from_attributes": True}


class ClinicalRecordListResponse(BaseModel):
    """Resposta paginada para prontuarios."""

    data: list[ClinicalRecordRead]
    pagination: dict[str, int]
