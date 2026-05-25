"""Create or update the clinic profile from environment variables."""

import os
import sys

from sqlalchemy.exc import SQLAlchemyError

from app import models as _models  # noqa: F401
from app.core.database import SessionLocal
from app.modules.tenant.schemas import TenantProfileUpdate
from app.modules.tenant.service import TenantProfileService

TRADE_NAME_ENV = "GCO_TENANT_TRADE_NAME"


def _value(name: str) -> str | None:
    """Return a normalized optional environment value."""

    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def main() -> int:
    """Persist the initial white-label clinic profile."""

    trade_name = _value(TRADE_NAME_ENV)
    if trade_name is None:
        print(f"Erro: defina {TRADE_NAME_ENV} com o nome da clinica.", file=sys.stderr)
        return 2

    payload = TenantProfileUpdate(
        trade_name=trade_name,
        legal_name=_value("GCO_TENANT_LEGAL_NAME"),
        document=_value("GCO_TENANT_DOCUMENT"),
        email=_value("GCO_TENANT_EMAIL"),
        phone=_value("GCO_TENANT_PHONE"),
        address_line=_value("GCO_TENANT_ADDRESS_LINE"),
        city=_value("GCO_TENANT_CITY"),
        state=_value("GCO_TENANT_STATE"),
        postal_code=_value("GCO_TENANT_POSTAL_CODE"),
        logo_url=_value("GCO_TENANT_LOGO_URL"),
        primary_color=_value("GCO_TENANT_PRIMARY_COLOR"),
        timezone=_value("GCO_TENANT_TIMEZONE") or "America/Sao_Paulo",
        is_active=True,
    )

    try:
        with SessionLocal() as session:
            profile = TenantProfileService(session).upsert_profile(payload, actor=None)
    except SQLAlchemyError as exc:
        print(f"Erro ao atualizar perfil da clinica: {exc}", file=sys.stderr)
        return 1

    print(f"Perfil da clinica atualizado: {profile.trade_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
