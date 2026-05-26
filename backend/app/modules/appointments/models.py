"""Persistence models for appointments."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class AppointmentStatus(StrEnum):
    """Supported appointment statuses for the calling workflow."""

    WAITING = "waiting"
    CALLED = "called"
    IN_SERVICE = "in_service"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class Appointment(Base, TimestampMixin):
    """Patient appointment visible to the call workflow."""

    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(
            "status in ("
            "'waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show'"
            ")",
            name="status_allowed",
        ),
        Index("ix_appointments_scheduled_for_status", "scheduled_for", "status"),
        Index("ix_appointments_patient_id", "patient_id"),
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
    patient_name: Mapped[str] = mapped_column(String(160), nullable=False)
    patient_document: Mapped[str | None] = mapped_column(String(20), nullable=True)
    scheduled_for: Mapped[datetime] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    requires_triage: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    external_source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(80), nullable=True)

    calls = relationship("Call", back_populates="appointment")
    triage_record = relationship("TriageRecord", back_populates="appointment")
