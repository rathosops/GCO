"""Persistence models for authentication."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, CheckConstraint, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class UserRole(StrEnum):
    """Supported user roles for the initial V2 authorization model."""

    ADMIN = "admin"
    OPERATOR = "operator"
    TRIAGE = "triage"
    DOCTOR = "doctor"


class User(Base, TimestampMixin):
    """Application user allowed to operate protected screens."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role in ('admin', 'operator', 'triage', 'doctor')",
            name="role_allowed",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(nullable=True)

    calls = relationship("Call", back_populates="called_by_user")
    triage_records = relationship("TriageRecord", back_populates="triaged_by_user")
    audit_logs = relationship("AuditLog", back_populates="actor_user")

    @property
    def role_enum(self) -> UserRole:
        """Return the user role as an enum value."""

        return UserRole(self.role)

    @property
    def permissions(self) -> list[str]:
        """Return permissions calculated from the current role."""

        from app.modules.auth.permissions import permissions_for_role

        return permissions_for_role(self.role_enum)
