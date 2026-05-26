"""Modelos de persistencia para solicitacoes de exames."""

from datetime import datetime
from decimal import Decimal
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


class ExamRequestStatus(StrEnum):
    """Status aceitos para solicitacoes de exames."""

    PENDING = "pending"
    BILLED = "billed"
    EXTERNAL = "external"
    CANCELLED = "cancelled"


class ExamRequest(Base, TimestampMixin):
    """Solicitacao de exames vinculada a paciente ou consulta."""

    __tablename__ = "exam_requests"
    __table_args__ = (
        CheckConstraint(
            "status in ('pending', 'billed', 'external', 'cancelled')",
            name="status_allowed",
        ),
        Index("ix_exam_requests_patient_id", "patient_id"),
        Index("ix_exam_requests_clinical_record_id", "clinical_record_id"),
        Index("ix_exam_requests_status", "status"),
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
    requested_at: Mapped[datetime] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class ExamRequestItem(Base, TimestampMixin):
    """Item normalizado de solicitacao de exames."""

    __tablename__ = "exam_request_items"
    __table_args__ = (Index("ix_exam_request_items_request_id", "exam_request_id"),)

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    exam_request_id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer(), "sqlite"),
        ForeignKey("exam_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    exam_name: Mapped[str] = mapped_column(String(180), nullable=False)
    exam_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    exam_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
