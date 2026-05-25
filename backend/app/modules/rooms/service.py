"""Business services for rooms."""

from sqlalchemy.orm import Session

from app.modules.audit.service import record_audit
from app.modules.auth.models import User
from app.modules.rooms.models import Room
from app.modules.rooms.repository import RoomRepository
from app.modules.rooms.schemas import RoomCreate, RoomUpdate
from app.shared.exceptions import BusinessRuleError, NotFoundError


class RoomService:
    """Coordinate room rules and persistence."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.rooms = RoomRepository(session)

    def list_rooms(self) -> list[Room]:
        """Return all rooms."""

        return self.rooms.list_all()

    def create_room(self, payload: RoomCreate, actor: User) -> Room:
        """Create a room with a unique code."""

        if self.rooms.get_by_code(payload.code) is not None:
            raise BusinessRuleError("Codigo de sala ja cadastrado")

        room = Room(
            code=payload.code,
            name=payload.name,
            display_name=payload.display_name,
            kind=payload.kind.value,
            is_active=payload.is_active,
            sort_order=payload.sort_order,
        )
        self.rooms.add(room)
        self.session.flush()
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action="room.created",
            entity_type="room",
            entity_id=room.id,
            payload={"code": room.code},
        )
        self.session.commit()
        self.session.refresh(room)
        return room

    def update_room(self, room_id: int, payload: RoomUpdate, actor: User) -> Room:
        """Update a room."""

        room = self.rooms.get(room_id)
        if room is None:
            raise NotFoundError("Sala nao encontrada")

        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(room, field, value.value if hasattr(value, "value") else value)

        record_audit(
            self.session,
            actor_user_id=actor.id,
            action="room.updated",
            entity_type="room",
            entity_id=room.id,
            payload=update_data,
        )
        self.session.commit()
        self.session.refresh(room)
        return room
