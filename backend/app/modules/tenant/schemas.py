"""Schemas do perfil white-label da clinica."""

import re

from pydantic import BaseModel, Field, field_validator


def _only_digits(value: str | None) -> str | None:
    """Normalize Brazilian document-like values to digits only."""

    if value is None:
        return None
    normalized = re.sub(r"\D", "", value)
    return normalized or None


class TenantProfileRead(BaseModel):
    """Perfil publico usado para identidade visual da instalacao."""

    id: int | None = None
    trade_name: str
    legal_name: str | None = None
    document: str | None = None
    email: str | None = None
    phone: str | None = None
    address_line: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    timezone: str
    is_active: bool = True

    model_config = {"from_attributes": True}


class TenantProfileUpdate(BaseModel):
    """Dados editaveis do perfil white-label da clinica."""

    trade_name: str = Field(min_length=1, max_length=120)
    legal_name: str | None = Field(default=None, max_length=160)
    document: str | None = Field(default=None, max_length=18)
    email: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=30)
    address_line: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    postal_code: str | None = Field(default=None, max_length=10)
    logo_url: str | None = Field(default=None, max_length=300)
    primary_color: str | None = Field(default=None, max_length=20)
    timezone: str = Field(default="America/Sao_Paulo", min_length=1, max_length=80)
    is_active: bool = True

    @field_validator("document", "postal_code", mode="before")
    @classmethod
    def normalize_digits(cls, value: str | None) -> str | None:
        """Keep CPF, CNPJ and CEP fields with digits only."""

        return _only_digits(value)

    @field_validator("state", mode="before")
    @classmethod
    def normalize_state(cls, value: str | None) -> str | None:
        """Store Brazilian state abbreviations in uppercase."""

        if value is None:
            return None
        return value.strip().upper() or None
