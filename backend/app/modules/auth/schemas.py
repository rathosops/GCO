"""Pydantic schemas for authentication endpoints."""

from pydantic import BaseModel, Field

from app.modules.auth.models import UserRole


class LoginRequest(BaseModel):
    """Credentials used to request an access token."""

    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    """Bearer token returned after authentication."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserRead(BaseModel):
    """Authenticated user representation exposed by the API."""

    id: int
    username: str
    display_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class CreateUserCommand(BaseModel):
    """Input required to create a local application user."""

    username: str = Field(min_length=1, max_length=80)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8)
    role: UserRole = UserRole.ADMIN
