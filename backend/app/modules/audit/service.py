"""Audit helpers for domain services."""

from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog


def record_audit(
    session: Session,
    *,
    actor_user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | str | None = None,
    payload: dict | None = None,
) -> AuditLog:
    """Append one audit entry to the current unit of work."""

    log = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        payload=payload,
    )
    session.add(log)
    return log
