"""Tests for runtime configuration safeguards."""

import pytest
from app.core.config import get_settings


def test_production_rejects_default_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    """Production must fail fast when SECRET_KEY is unsafe."""

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "change-me")

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        get_settings()

    get_settings.cache_clear()
