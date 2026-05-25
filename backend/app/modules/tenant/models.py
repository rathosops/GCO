"""Modelos de perfil white-label da clinica."""

from sqlalchemy import Boolean, CheckConstraint, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class TenantProfile(Base, TimestampMixin):
    """Perfil configuravel da clinica operada pela instalacao."""

    __tablename__ = "tenant_profiles"
    __table_args__ = (CheckConstraint("id = 1", name="tenant_profile_singleton"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    trade_name: Mapped[str] = mapped_column(String(120), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    document: Mapped[str | None] = mapped_column(String(14), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address_line: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    primary_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    timezone: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        server_default=text("'America/Sao_Paulo'"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
