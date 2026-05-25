"""Schemas for appointment operations."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.appointments.models import AppointmentStatus


class AppointmentCreate(BaseModel):
    """Input for creating an appointment in the V2 workflow."""

    patient_name: str = Field(min_length=1, max_length=160)
    patient_document: str | None = Field(default=None, max_length=20)
    scheduled_for: datetime
    requires_triage: bool = False
    external_source: str | None = Field(default=None, max_length=40)
    external_id: str | None = Field(default=None, max_length=80)


class AppointmentRead(BaseModel):
    """Appointment representation returned by the API."""

    id: int
    patient_name: str
    patient_document: str | None
    scheduled_for: datetime
    status: AppointmentStatus
    requires_triage: bool
    external_source: str | None
    external_id: str | None

    model_config = {"from_attributes": True}

