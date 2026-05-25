"""Tests for token helpers."""

from datetime import timedelta

import pytest
from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token


def test_access_token_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    """JWT helpers should preserve the subject for valid tokens."""

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-with-enough-entropy")

    token = create_access_token("123", expires_delta=timedelta(minutes=5))
    payload = decode_access_token(token)

    assert payload is not None
    assert payload["sub"] == "123"
    get_settings.cache_clear()
