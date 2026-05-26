"""Rotas de receituarios."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permissions
from app.api.v1.errors import domain_error_to_http
from app.modules.auth.models import User
from app.modules.auth.permissions import Permission
from app.modules.prescriptions.schemas import (
    PrescriptionCancel,
    PrescriptionCreate,
    PrescriptionRead,
)
from app.modules.prescriptions.service import PrescriptionService
from app.shared.exceptions import DomainError

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


@router.get("", response_model=list[PrescriptionRead])
async def list_prescriptions(
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_permissions(Permission.PRESCRIPTIONS_READ)),
) -> list[PrescriptionRead]:
    """Liste receituarios recentes."""

    prescriptions = PrescriptionService(session).list_prescriptions()
    return [
        PrescriptionRead.model_validate(prescription) for prescription in prescriptions
    ]


@router.post("", response_model=PrescriptionRead)
async def create_prescription(
    payload: PrescriptionCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PRESCRIPTIONS_WRITE)),
) -> PrescriptionRead:
    """Emita um receituario."""

    try:
        prescription = PrescriptionService(session).create_prescription(
            payload,
            current_user,
        )
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return PrescriptionRead.model_validate(prescription)


@router.post("/{prescription_id}/cancel", response_model=PrescriptionRead)
async def cancel_prescription(
    prescription_id: int,
    payload: PrescriptionCancel,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PRESCRIPTIONS_WRITE)),
) -> PrescriptionRead:
    """Cancele um receituario."""

    try:
        prescription = PrescriptionService(session).cancel_prescription(
            prescription_id,
            payload,
            current_user,
        )
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return PrescriptionRead.model_validate(prescription)
