"""Call routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permissions
from app.api.v1.errors import domain_error_to_http
from app.modules.auth.models import User
from app.modules.auth.permissions import Permission
from app.modules.calls.schemas import CallCreate, CallFinish, CallRead
from app.modules.calls.service import CallService
from app.modules.panel.broadcaster import manager
from app.modules.panel.publisher import publish_call_event
from app.shared.exceptions import DomainError

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("", response_model=list[CallRead])
async def list_calls(
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_permissions(Permission.CALLS_READ)),
) -> list[CallRead]:
    """List recent calls."""

    calls = CallService(session).list_calls()
    return [CallRead.model_validate(call) for call in calls]


@router.post("", response_model=CallRead)
async def create_call(
    payload: CallCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.CALLS_MANAGE)),
) -> CallRead:
    """Create a call."""

    try:
        call = CallService(session).create_call(payload, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    await manager.broadcast(publish_call_event("call.created", call))
    return CallRead.model_validate(call)


@router.post("/{call_id}/start", response_model=CallRead)
async def start_call(
    call_id: int,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.CALLS_MANAGE)),
) -> CallRead:
    """Start a call."""

    try:
        call = CallService(session).start_call(call_id, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    await manager.broadcast(publish_call_event("call.started", call))
    return CallRead.model_validate(call)


@router.post("/{call_id}/finish", response_model=CallRead)
async def finish_call(
    call_id: int,
    payload: CallFinish,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.CALLS_MANAGE)),
) -> CallRead:
    """Finish a call."""

    try:
        call = CallService(session).finish_call(call_id, payload, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    await manager.broadcast(publish_call_event("call.finished", call))
    return CallRead.model_validate(call)


@router.post("/{call_id}/cancel", response_model=CallRead)
async def cancel_call(
    call_id: int,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.CALLS_MANAGE)),
) -> CallRead:
    """Cancel a call."""

    try:
        call = CallService(session).cancel_call(call_id, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    await manager.broadcast(publish_call_event("call.cancelled", call))
    return CallRead.model_validate(call)
