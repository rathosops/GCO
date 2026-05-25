"""Schemas for panel state."""

from app.modules.calls.schemas import CallRead

from pydantic import BaseModel


class PanelState(BaseModel):
    """Current panel state returned after reconnects."""

    active_calls: list[CallRead]
    recent_calls: list[CallRead]

