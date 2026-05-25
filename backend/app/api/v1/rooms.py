"""Room routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.api.v1.errors import domain_error_to_http
from app.modules.auth.models import User, UserRole
from app.modules.rooms.schemas import RoomCreate, RoomRead, RoomUpdate
from app.modules.rooms.service import RoomService
from app.shared.exceptions import DomainError

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=list[RoomRead])
async def list_rooms(session: Session = Depends(get_db)) -> list[RoomRead]:
    """List rooms."""

    rooms = RoomService(session).list_rooms()
    return [RoomRead.model_validate(room) for room in rooms]


@router.post("", response_model=RoomRead)
async def create_room(
    payload: RoomCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OPERATOR)),
) -> RoomRead:
    """Create a room."""

    try:
        room = RoomService(session).create_room(payload, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return RoomRead.model_validate(room)


@router.patch("/{room_id}", response_model=RoomRead)
async def update_room(
    room_id: int,
    payload: RoomUpdate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OPERATOR)),
) -> RoomRead:
    """Update a room."""

    try:
        room = RoomService(session).update_room(room_id, payload, current_user)
    except DomainError as exc:
        raise domain_error_to_http(exc) from exc
    return RoomRead.model_validate(room)

