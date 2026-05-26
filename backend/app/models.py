"""Importe modelos SQLAlchemy para descoberta de metadados pelo Alembic."""

from app.modules.appointments.models import Appointment
from app.modules.audit.models import AuditLog
from app.modules.auth.models import User
from app.modules.calls.models import Call
from app.modules.clinical_records.models import ClinicalRecord
from app.modules.exam_requests.models import ExamRequest, ExamRequestItem
from app.modules.panel.models import PanelSetting
from app.modules.patients.models import Patient
from app.modules.prescriptions.models import Prescription, PrescriptionItem
from app.modules.rooms.models import Room
from app.modules.tenant.models import TenantProfile
from app.modules.triage.models import TriageRecord

__all__ = [
    "Appointment",
    "AuditLog",
    "Call",
    "ClinicalRecord",
    "ExamRequest",
    "ExamRequestItem",
    "PanelSetting",
    "Patient",
    "Prescription",
    "PrescriptionItem",
    "Room",
    "TenantProfile",
    "TriageRecord",
    "User",
]
