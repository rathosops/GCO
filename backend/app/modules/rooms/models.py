"""Persistence models for rooms."""

from enum import StrEnum

from sqlalchemy import Boolean, CheckConstraint, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class RoomKind(StrEnum):
    """Supported room kinds."""

    OFFICE = "office"
    TRIAGE = "triage"
    RECEPTION = "reception"


class Room(Base, TimestampMixin):
    """Physical or logical place displayed in patient calls."""

    __tablename__ = "rooms"
    __table_args__ = (
        CheckConstraint(
            "kind in ('office', 'triage', 'reception')",
            name="kind_allowed",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    calls = relationship("Call", back_populates="room")
