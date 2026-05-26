"""Modelos de persistencia para consultas e prontuario."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class ClinicalRecordStatus(StrEnum):
    """Status persistidos de uma consulta clinica."""

    DRAFT = "draft"
    FINISHED = "finished"


class ClinicalRecord(Base, TimestampMixin):
    """Registro clinico produzido durante uma consulta."""

    __tablename__ = "clinical_records"
    __table_args__ = (
        CheckConstraint(
            "status in ('draft', 'finished')",
            name="status_allowed",
        ),
        Index("ix_clinical_records_patient_id", "patient_id"),
        Index("ix_clinical_records_appointment_id", "appointment_id", unique=True),
        Index("ix_clinical_records_status", "status"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    patient_id: Mapped[int | None] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
    )
    appointment_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
    )
    patient_name: Mapped[str] = mapped_column(String(160), nullable=False)
    patient_document: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(nullable=True)
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    history: Mapped[str | None] = mapped_column(Text, nullable=True)
    physical_exam: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    conduct: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
