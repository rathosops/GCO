"""Importe modelos SQLAlchemy para descoberta de metadados pelo Alembic."""

from app.modules.appointments.models import Appointment
from app.modules.audit.models import AuditLog
from app.modules.auth.models import User
from app.modules.calls.models import Call
from app.modules.panel.models import PanelSetting
from app.modules.patients.models import Patient
from app.modules.rooms.models import Room
from app.modules.tenant.models import TenantProfile
from app.modules.triage.models import TriageRecord

__all__ = [
    "Appointment",
    "AuditLog",
    "Call",
    "PanelSetting",
    "Patient",
    "Room",
    "TenantProfile",
    "TriageRecord",
    "User",
]
