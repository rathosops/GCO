"""Panel state service."""

from sqlalchemy.orm import Session

from app.modules.calls.models import Call, CallStatus
from app.modules.calls.repository import CallRepository


class PanelService:
    """Read panel state from persisted call data."""

    def __init__(self, session: Session) -> None:
        self.calls = CallRepository(session)

    def active_calls(self) -> list[Call]:
        """Return active calls for the panel."""

        return [
            call
            for call in self.calls.list_recent(limit=20)
            if call.status in (CallStatus.CALLED.value, CallStatus.IN_SERVICE.value)
        ]

    def recent_calls(self) -> list[Call]:
        """Return recent calls for reconnect fallback."""

        return self.calls.list_recent(limit=20)
