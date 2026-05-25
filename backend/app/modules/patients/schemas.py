"""Schemas do cadastro de pacientes."""

import re
from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.modules.patients.models import PatientSex


def _digits_or_none(value: str | None) -> str | None:
    """Normalize documentos e CEPs brasileiros para somente digitos."""

    if value is None:
        return None
    normalized_value = re.sub(r"\D", "", value)
    return normalized_value or None


class PatientCreate(BaseModel):
    """Dados necessarios para cadastrar um paciente."""

    full_name: str = Field(min_length=1, max_length=160)
    cpf: str | None = Field(default=None, max_length=14)
    birth_date: date | None = None
    sex: PatientSex = PatientSex.NOT_INFORMED
    email: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=30)
    address_line: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    postal_code: str | None = Field(default=None, max_length=10)
    notes: str | None = None
    is_active: bool = True

    @field_validator("cpf", "postal_code", mode="before")
    @classmethod
    def normalize_digits(cls, value: str | None) -> str | None:
        """Mantenha CPF e CEP apenas com digitos."""

        return _digits_or_none(value)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str | None) -> str | None:
        """Valide o tamanho do CPF quando ele for informado."""

        if value is not None and len(value) != 11:
            msg = "CPF deve conter 11 digitos"
            raise ValueError(msg)
        return value

    @field_validator("postal_code")
    @classmethod
    def validate_postal_code(cls, value: str | None) -> str | None:
        """Valide o tamanho do CEP quando ele for informado."""

        if value is not None and len(value) != 8:
            msg = "CEP deve conter 8 digitos"
            raise ValueError(msg)
        return value

    @field_validator("state", mode="before")
    @classmethod
    def normalize_state(cls, value: str | None) -> str | None:
        """Armazene UF brasileira em letras maiusculas."""

        if value is None:
            return None
        normalized_value = value.strip().upper()
        return normalized_value or None


class PatientUpdate(BaseModel):
    """Dados editaveis de um paciente existente."""

    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    cpf: str | None = Field(default=None, max_length=14)
    birth_date: date | None = None
    sex: PatientSex | None = None
    email: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=30)
    address_line: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    postal_code: str | None = Field(default=None, max_length=10)
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("cpf", "postal_code", mode="before")
    @classmethod
    def normalize_digits(cls, value: str | None) -> str | None:
        """Mantenha CPF e CEP apenas com digitos."""

        return _digits_or_none(value)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str | None) -> str | None:
        """Valide o tamanho do CPF quando ele for informado."""

        if value is not None and len(value) != 11:
            msg = "CPF deve conter 11 digitos"
            raise ValueError(msg)
        return value

    @field_validator("postal_code")
    @classmethod
    def validate_postal_code(cls, value: str | None) -> str | None:
        """Valide o tamanho do CEP quando ele for informado."""

        if value is not None and len(value) != 8:
            msg = "CEP deve conter 8 digitos"
            raise ValueError(msg)
        return value

    @field_validator("state", mode="before")
    @classmethod
    def normalize_state(cls, value: str | None) -> str | None:
        """Armazene UF brasileira em letras maiusculas."""

        if value is None:
            return None
        normalized_value = value.strip().upper()
        return normalized_value or None


class PatientRead(BaseModel):
    """Representacao de paciente retornada pela API."""

    id: int
    full_name: str
    cpf: str | None
    birth_date: date | None
    sex: PatientSex
    email: str | None
    phone: str | None
    address_line: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    notes: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class PaginationRead(BaseModel):
    """Metadados de paginacao para listas novas da API."""

    limit: int
    offset: int
    total: int


class PatientListResponse(BaseModel):
    """Resposta paginada do cadastro de pacientes."""

    data: list[PatientRead]
    pagination: PaginationRead
