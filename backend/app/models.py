"""Import all SQLAlchemy models so Alembic can discover metadata."""

from app.modules.appointments.models import Appointment
from app.modules.audit.models import AuditLog
from app.modules.auth.models import User
from app.modules.calls.models import Call
from app.modules.panel.models import PanelSetting
from app.modules.rooms.models import Room
from app.modules.triage.models import TriageRecord

__all__ = [
    "Appointment",
    "AuditLog",
    "Call",
    "PanelSetting",
    "Room",
    "TriageRecord",
    "User",
]
