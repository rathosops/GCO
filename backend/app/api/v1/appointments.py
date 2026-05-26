"""Appointment routes."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permissions
from app.modules.appointments.schemas import AppointmentCreate, AppointmentRead
from app.modules.appointments.service import AppointmentService
from app.modules.auth.models import User
from app.modules.auth.permissions import Permission

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("", response_model=list[AppointmentRead])
async def list_appointments(
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_permissions(Permission.APPOINTMENTS_READ)),
) -> list[AppointmentRead]:
    """List appointments."""

    appointments = AppointmentService(session).list_appointments()
    return [AppointmentRead.model_validate(appointment) for appointment in appointments]


@router.post("", response_model=AppointmentRead)
async def create_appointment(
    payload: AppointmentCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.APPOINTMENTS_MANAGE)),
) -> AppointmentRead:
    """Create an appointment."""

    appointment = AppointmentService(session).create_appointment(payload, current_user)
    return AppointmentRead.model_validate(appointment)


@router.get("/{appointment_id}/receipt", response_class=Response)
async def get_appointment_receipt(
    appointment_id: int,
    session: Session = Depends(get_db),
    _current_user: User = Depends(require_permissions(Permission.APPOINTMENTS_READ)),
) -> Response:
    """Gere um comprovante HTML simples de agendamento."""

    receipt = AppointmentService(session).render_receipt(appointment_id)
    return Response(
        content=receipt,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'inline; filename="comprovante-agendamento-{appointment_id}.html"'
            )
        },
    )
