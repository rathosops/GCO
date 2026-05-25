"""Repositories for room models."""

from sqlalchemy import select

from app.modules.rooms.models import Room
from app.shared.repository import Repository


class RoomRepository(Repository[Room]):
    """Repository for room persistence."""

    model = Room

    def list_all(self) -> list[Room]:
        """Return all rooms ordered for display."""

        statement = select(Room).order_by(Room.sort_order, Room.name)
        return list(self.session.scalars(statement))

    def get_by_code(self, code: str) -> Room | None:
        """Return one room by code."""

        statement = select(Room).where(Room.code == code)
        return self.session.scalar(statement)

