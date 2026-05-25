"""Schemas for room operations."""

from pydantic import BaseModel, Field

from app.modules.rooms.models import RoomKind


class RoomCreate(BaseModel):
    """Input for creating a room."""

    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=80)
    display_name: str = Field(min_length=1, max_length=80)
    kind: RoomKind
    is_active: bool = True
    sort_order: int = 0


class RoomUpdate(BaseModel):
    """Input for updating mutable room fields."""

    name: str | None = Field(default=None, min_length=1, max_length=80)
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    kind: RoomKind | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class RoomRead(BaseModel):
    """Room representation returned by the API."""

    id: int
    code: str
    name: str
    display_name: str
    kind: RoomKind
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}
