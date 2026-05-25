"""Schemas for panel state."""

from pydantic import BaseModel

from app.modules.calls.schemas import CallRead


class PanelState(BaseModel):
    """Current panel state returned after reconnects."""

    active_calls: list[CallRead]
    recent_calls: list[CallRead]
