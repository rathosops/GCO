"""Schemas for triage operations."""

from datetime import datetime

from pydantic import BaseModel

from app.modules.triage.models import TriageStatus


class TriageComplete(BaseModel):
    """Input used to complete triage for an appointment."""

    notes: str | None = None


class TriageRead(BaseModel):
    """Triage record representation returned by the API."""

    id: int
    appointment_id: int
    triaged_by_user_id: int | None
    status: TriageStatus
    notes: str | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}
