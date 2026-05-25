"""Business services for authentication."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth.exceptions import (
    InactiveUserError,
    InvalidCredentialsError,
    UserAlreadyExistsError,
)
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.schemas import CreateUserCommand, TokenResponse


class AuthService:
    """Coordinate authentication rules and user persistence."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.users = UserRepository(session)

    def authenticate(self, username: str, password: str) -> TokenResponse:
        """Validate credentials and return an access token."""

        user = self.users.get_by_username(username)
        if user is None or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError

        if not user.is_active:
            raise InactiveUserError

        user.last_login_at = datetime.now(UTC)
        self.session.commit()

        settings = get_settings()
        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            expires_in=settings.access_token_expire_minutes * 60,
        )

    def create_user(self, command: CreateUserCommand) -> User:
        """Create a user with a hashed password."""

        if self.users.username_exists(command.username):
            raise UserAlreadyExistsError

        user = User(
            username=command.username,
            display_name=command.display_name,
            password_hash=hash_password(command.password),
            role=command.role.value,
            is_active=True,
        )
        self.users.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

