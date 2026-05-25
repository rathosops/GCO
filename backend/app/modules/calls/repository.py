"""Repositories for call models."""

from sqlalchemy import func, select

from app.modules.calls.models import Call
from app.shared.repository import Repository


class CallRepository(Repository[Call]):
    """Repository for call persistence."""

    model = Call

    def list_recent(self, limit: int = 100) -> list[Call]:
        """Return recent calls."""

        statement = select(Call).order_by(Call.called_at.desc()).limit(limit)
        return list(self.session.scalars(statement))

    def next_sequence_number(self) -> int:
        """Return the next call sequence number."""

        statement = select(func.coalesce(func.max(Call.sequence_number), 0) + 1)
        return int(self.session.scalar(statement) or 1)

