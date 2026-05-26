"""Modelos de persistencia para receituarios."""

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class PrescriptionKind(StrEnum):
    """Tipos de receituario aceitos na V2 inicial."""

    SIMPLE = "simple"
    SPECIAL_CONTROL = "special_control"
    ANTIMICROBIAL = "antimicrobial"


class PrescriptionStatus(StrEnum):
    """Status persistidos de um receituario."""

    ACTIVE = "active"
    CANCELLED = "cancelled"
    DISPENSED = "dispensed"


class Prescription(Base, TimestampMixin):
    """Receituario emitido durante ou apos uma consulta."""

    __tablename__ = "prescriptions"
    __table_args__ = (
        CheckConstraint(
            "kind in ('simple', 'special_control', 'antimicrobial')",
            name="kind_allowed",
        ),
        CheckConstraint(
            "status in ('active', 'cancelled', 'dispensed')",
            name="status_allowed",
        ),
        Index("ix_prescriptions_patient_id", "patient_id"),
        Index("ix_prescriptions_clinical_record_id", "clinical_record_id"),
        Index("ix_prescriptions_status", "status"),
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
    clinical_record_id: Mapped[int | None] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        ForeignKey("clinical_records.id", ondelete="SET NULL"),
        nullable=True,
    )
    patient_name: Mapped[str] = mapped_column(String(160), nullable=False)
    patient_document: Mapped[str | None] = mapped_column(String(20), nullable=True)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(nullable=False)
    valid_until: Mapped[date] = mapped_column(nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class PrescriptionItem(Base, TimestampMixin):
    """Item livre de medicamento prescrito."""

    __tablename__ = "prescription_items"
    __table_args__ = (
        Index("ix_prescription_items_prescription_id", "prescription_id"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    prescription_id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    medication_name: Mapped[str] = mapped_column(String(180), nullable=False)
    dosage: Mapped[str | None] = mapped_column(String(120), nullable=True)
    route: Mapped[str | None] = mapped_column(String(80), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(120), nullable=True)
    quantity: Mapped[str | None] = mapped_column(String(80), nullable=True)
    unit_price: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
