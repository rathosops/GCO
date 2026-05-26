"""Rotas de solicitacoes de exames."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permissions
from app.api.v1.errors import domain_error_to_http
from app.modules.auth.models import User
from app.modules.auth.permissions import Permission
from app.modules.exam_requests.schemas import (
    ExamRequestCancel,
    ExamRequestCreate,
    ExamRequestRead,
)
from app.modules.exam_requests.service import ExamRequestService
from app.shared.exceptions import DomainError

router = APIRouter(prefix="/exam-requests", tags=["exam-requests"])


@router.get("", response_model=list[ExamRequestRead])
async def list_exam_requests(
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_permissions(Permission.EXAM_REQUESTS_READ)),
) -> list[ExamRequestRead]:
    """Liste solicitacoes de exames recentes."""

    requests = ExamRequestService(session).list_requests()
    return [ExamRequestRead.model_validate(exam_request) for exam_request in requests]


@router.post("", response_model=ExamRequestRead)
async def create_exam_request(
    payload: ExamRequestCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.EXAM_REQUESTS_WRITE)),
) -> ExamRequestRead:
    """Crie uma solicitacao de exames."""

    try:
        exam_request = ExamRequestService(session).create_request(payload, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return ExamRequestRead.model_validate(exam_request)


@router.post("/{exam_request_id}/cancel", response_model=ExamRequestRead)
async def cancel_exam_request(
    exam_request_id: int,
    payload: ExamRequestCancel,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.EXAM_REQUESTS_WRITE)),
) -> ExamRequestRead:
    """Cancele uma solicitacao de exames."""

    try:
        exam_request = ExamRequestService(session).cancel_request(
            exam_request_id,
            payload,
            current_user,
        )
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return ExamRequestRead.model_validate(exam_request)
