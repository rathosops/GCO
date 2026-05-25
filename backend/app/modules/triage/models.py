"""Persistence models for triage records."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class TriageStatus(StrEnum):
    """Supported statuses for triage records."""

    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TriageRecord(Base, TimestampMixin):
    """Triage state for an appointment that requires pre-attendance screening."""

    __tablename__ = "triage_records"
    __table_args__ = (
        CheckConstraint(
            "status in ('pending', 'completed', 'cancelled')",
            name="status_allowed",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    triaged_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    appointment = relationship("Appointment", back_populates="triage_record")
    triaged_by_user = relationship("User", back_populates="triage_records")

