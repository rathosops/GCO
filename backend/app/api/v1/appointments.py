"""Appointment routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.modules.appointments.schemas import AppointmentCreate, AppointmentRead
from app.modules.appointments.service import AppointmentService
from app.modules.auth.models import User, UserRole

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("", response_model=list[AppointmentRead])
async def list_appointments(
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OPERATOR)),
) -> list[AppointmentRead]:
    """List appointments."""

    appointments = AppointmentService(session).list_appointments()
    return [AppointmentRead.model_validate(appointment) for appointment in appointments]


@router.post("", response_model=AppointmentRead)
async def create_appointment(
    payload: AppointmentCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OPERATOR)),
) -> AppointmentRead:
    """Create an appointment."""

    appointment = AppointmentService(session).create_appointment(payload, current_user)
    return AppointmentRead.model_validate(appointment)
