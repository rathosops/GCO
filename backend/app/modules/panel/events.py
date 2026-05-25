"""Realtime event contracts for the panel."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

EVENT_VERSION = 1
PANEL_EVENTS_CHANNEL = "gco:panel:events"
PANEL_EVENT_SOURCE_ID = str(uuid4())


class PanelEvent(BaseModel):
    """Versioned event envelope consumed by panel clients."""

    version: int = EVENT_VERSION
    type: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    payload: dict[str, Any]
