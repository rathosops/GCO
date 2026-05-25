"""Tests for the tenant profile service."""

from app.modules.tenant.schemas import TenantProfileRead
from app.modules.tenant.service import TenantProfileService
from sqlalchemy.orm import Session


def test_tenant_profile_returns_neutral_fallback(db_session: Session) -> None:
    """A fresh installation can render the frontend before profile setup."""

    profile = TenantProfileService(db_session).get_profile()

    assert isinstance(profile, TenantProfileRead)
    assert profile.trade_name
    assert profile.timezone == "America/Sao_Paulo"
    assert profile.id is None
