"""Repositories for appointment models."""

from sqlalchemy import select

from app.modules.appointments.models import Appointment
from app.shared.repository import Repository


class AppointmentRepository(Repository[Appointment]):
    """Repository for appointment persistence."""

    model = Appointment

    def list_all(self, limit: int = 100) -> list[Appointment]:
        """Return appointments ordered by schedule."""

        statement = select(Appointment).order_by(Appointment.scheduled_for).limit(limit)
        return list(self.session.scalars(statement))
