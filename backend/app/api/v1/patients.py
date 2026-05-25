"""Rotas do cadastro de pacientes."""

import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permissions
from app.api.v1.errors import domain_error_to_http
from app.modules.auth.models import User
from app.modules.auth.permissions import Permission
from app.modules.patients.schemas import (
    PaginationRead,
    PatientCreate,
    PatientListResponse,
    PatientRead,
    PatientUpdate,
)
from app.modules.patients.service import PatientService
from app.shared.exceptions import DomainError

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=PatientListResponse)
async def list_patients(
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_permissions(Permission.PATIENTS_READ)),
) -> PatientListResponse:
    """Liste pacientes com paginacao."""

    patients, total_patients = PatientService(session).list_patients(
        search=search,
        limit=limit,
        offset=offset,
    )
    return PatientListResponse(
        data=[PatientRead.model_validate(patient) for patient in patients],
        pagination=PaginationRead(limit=limit, offset=offset, total=total_patients),
    )


@router.get("/cpf/{cpf}", response_model=PatientRead)
async def get_patient_by_cpf(
    cpf: str,
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_permissions(Permission.PATIENTS_READ)),
) -> PatientRead:
    """Busque um paciente pelo CPF."""

    normalized_cpf = re.sub(r"\D", "", cpf)
    try:
        patient = PatientService(session).get_patient_by_cpf(normalized_cpf)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return PatientRead.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientRead)
async def get_patient(
    patient_id: int,
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_permissions(Permission.PATIENTS_READ)),
) -> PatientRead:
    """Busque um paciente pelo identificador."""

    try:
        patient = PatientService(session).get_patient(patient_id)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return PatientRead.model_validate(patient)


@router.post("", response_model=PatientRead)
async def create_patient(
    payload: PatientCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PATIENTS_WRITE)),
) -> PatientRead:
    """Cadastre um paciente."""

    try:
        patient = PatientService(session).create_patient(payload, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return PatientRead.model_validate(patient)


@router.put("/{patient_id}", response_model=PatientRead)
async def update_patient(
    patient_id: int,
    payload: PatientUpdate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PATIENTS_WRITE)),
) -> PatientRead:
    """Atualize um paciente."""

    try:
        patient = PatientService(session).update_patient(
            patient_id,
            payload,
            current_user,
        )
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return PatientRead.model_validate(patient)
