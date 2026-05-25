"""Schemas for call operations."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.calls.models import CallKind, CallStatus


class CallCreate(BaseModel):
    """Input for creating a call."""

    appointment_id: int
    room_id: int | None = None
    kind: CallKind
    message: str | None = Field(default=None, max_length=180)
    notes: str | None = None


class CallFinish(BaseModel):
    """Input for finishing a call."""

    patient_attended: bool = True
    notes: str | None = None


class CallRead(BaseModel):
    """Call representation returned by the API."""

    id: int
    appointment_id: int
    room_id: int | None
    called_by_user_id: int | None
    status: CallStatus
    kind: CallKind
    sequence_number: int
    message: str | None
    called_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    cancelled_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}

