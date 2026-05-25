"""Repositories for triage models."""

from sqlalchemy import select

from app.modules.triage.models import TriageRecord
from app.shared.repository import Repository


class TriageRecordRepository(Repository[TriageRecord]):
    """Repository for triage record persistence."""

    model = TriageRecord

    def get_by_appointment_id(self, appointment_id: int) -> TriageRecord | None:
        """Return triage record for an appointment."""

        statement = select(TriageRecord).where(
            TriageRecord.appointment_id == appointment_id
        )
        return self.session.scalar(statement)

