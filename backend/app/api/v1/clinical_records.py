"""Rotas de consultas e prontuario."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permissions
from app.api.v1.errors import domain_error_to_http
from app.modules.auth.models import User
from app.modules.auth.permissions import Permission
from app.modules.clinical_records.schemas import (
    ClinicalRecordCreate,
    ClinicalRecordListResponse,
    ClinicalRecordRead,
    ClinicalRecordUpdate,
)
from app.modules.clinical_records.service import ClinicalRecordService
from app.shared.exceptions import DomainError

router = APIRouter(prefix="/clinical-records", tags=["clinical-records"])


@router.get("", response_model=ClinicalRecordListResponse)
async def list_clinical_records(
    patient_id: int | None = Query(default=None),
    appointment_id: int | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_db),
    _current_user: User = Depends(
        require_permissions(Permission.CLINICAL_RECORDS_READ)
    ),
) -> ClinicalRecordListResponse:
    """Liste prontuarios."""

    records, total_records = ClinicalRecordService(session).list_records(
        patient_id=patient_id,
        appointment_id=appointment_id,
        limit=limit,
        offset=offset,
    )
    return ClinicalRecordListResponse(
        data=[ClinicalRecordRead.model_validate(record) for record in records],
        pagination={"limit": limit, "offset": offset, "total": total_records},
    )


@router.get("/{record_id}", response_model=ClinicalRecordRead)
async def get_clinical_record(
    record_id: int,
    session: Session = Depends(get_db),
    _current_user: User = Depends(
        require_permissions(Permission.CLINICAL_RECORDS_READ)
    ),
) -> ClinicalRecordRead:
    """Busque um prontuario pelo identificador."""

    try:
        record = ClinicalRecordService(session).get_record(record_id)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return ClinicalRecordRead.model_validate(record)


@router.post("", response_model=ClinicalRecordRead)
async def create_clinical_record(
    payload: ClinicalRecordCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(
        require_permissions(Permission.CLINICAL_RECORDS_WRITE)
    ),
) -> ClinicalRecordRead:
    """Inicie uma consulta clinica."""

    try:
        record = ClinicalRecordService(session).create_record(payload, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return ClinicalRecordRead.model_validate(record)


@router.put("/{record_id}", response_model=ClinicalRecordRead)
async def update_clinical_record(
    record_id: int,
    payload: ClinicalRecordUpdate,
    session: Session = Depends(get_db),
    current_user: User = Depends(
        require_permissions(Permission.CLINICAL_RECORDS_WRITE)
    ),
) -> ClinicalRecordRead:
    """Atualize uma consulta clinica em rascunho."""

    try:
        record = ClinicalRecordService(session).update_record(
            record_id,
            payload,
            current_user,
        )
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return ClinicalRecordRead.model_validate(record)


@router.post("/{record_id}/finish", response_model=ClinicalRecordRead)
async def finish_clinical_record(
    record_id: int,
    session: Session = Depends(get_db),
    current_user: User = Depends(
        require_permissions(Permission.CLINICAL_RECORDS_WRITE)
    ),
) -> ClinicalRecordRead:
    """Finalize uma consulta clinica."""

    try:
        record = ClinicalRecordService(session).finish_record(record_id, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return ClinicalRecordRead.model_validate(record)
