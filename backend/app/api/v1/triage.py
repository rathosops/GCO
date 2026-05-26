"""Triage routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permissions
from app.api.v1.errors import domain_error_to_http
from app.modules.auth.models import User
from app.modules.auth.permissions import Permission
from app.modules.triage.schemas import TriageComplete, TriageRead
from app.modules.triage.service import TriageService
from app.shared.exceptions import DomainError

router = APIRouter(prefix="/triage", tags=["triage"])


@router.post("/{appointment_id}/complete", response_model=TriageRead)
async def complete_triage(
    appointment_id: int,
    payload: TriageComplete,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.TRIAGE_MANAGE)),
) -> TriageRead:
    """Complete triage for an appointment."""

    try:
        record = TriageService(session).complete_triage(
            appointment_id,
            payload,
            current_user,
        )
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return TriageRead.model_validate(record)
