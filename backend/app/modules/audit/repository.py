"""Repositories for audit models."""

from app.modules.audit.models import AuditLog
from app.shared.repository import Repository


class AuditLogRepository(Repository[AuditLog]):
    """Repository for audit log persistence."""

    model = AuditLog
