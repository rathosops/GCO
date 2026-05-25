"""Modelos de persistencia do cadastro de pacientes."""

from datetime import date
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class PatientSex(StrEnum):
    """Valores aceitos para sexo biologico informado no cadastro."""

    FEMALE = "female"
    MALE = "male"
    OTHER = "other"
    NOT_INFORMED = "not_informed"


class Patient(Base, TimestampMixin):
    """Paciente atendido pela clinica ocupacional."""

    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint(
            "sex in ('female', 'male', 'other', 'not_informed')",
            name="sex_allowed",
        ),
        Index("ix_patients_full_name", "full_name"),
        Index("ix_patients_cpf", "cpf", unique=True),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    cpf: Mapped[str | None] = mapped_column(String(11), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(nullable=True)
    sex: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PatientSex.NOT_INFORMED.value,
        server_default=text("'not_informed'"),
    )
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address_line: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )

    @property
    def sex_enum(self) -> PatientSex:
        """Retorne o sexo informado como enum do dominio."""

        return PatientSex(self.sex)
