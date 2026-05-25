"""Persistence models for patient calls."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class CallStatus(StrEnum):
    """Supported statuses for a patient call."""

    WAITING = "waiting"
    CALLED = "called"
    IN_SERVICE = "in_service"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"


class CallKind(StrEnum):
    """Supported call kinds."""

    DOCTOR = "doctor"
    TRIAGE = "triage"
    ADMINISTRATIVE = "administrative"


class Call(Base, TimestampMixin):
    """History record for one patient call."""

    __tablename__ = "calls"
    __table_args__ = (
        CheckConstraint(
            "status in ("
            "'waiting', 'called', 'in_service', 'completed', 'no_show', 'cancelled'"
            ")",
            name="status_allowed",
        ),
        CheckConstraint(
            "kind in ('doctor', 'triage', 'administrative')",
            name="kind_allowed",
        ),
        Index("ix_calls_status_called_at", "status", "called_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    room_id: Mapped[int | None] = mapped_column(
        ForeignKey("rooms.id", ondelete="SET NULL"),
        nullable=True,
    )
    called_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str | None] = mapped_column(String(180), nullable=True)
    called_at: Mapped[datetime] = mapped_column(nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    appointment = relationship("Appointment", back_populates="calls")
    room = relationship("Room", back_populates="calls")
    called_by_user = relationship("User", back_populates="calls")
