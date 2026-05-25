"""Repositories for authentication models."""

from sqlalchemy import select

from app.modules.auth.models import User
from app.shared.repository import Repository


class UserRepository(Repository[User]):
    """Repository for user persistence."""

    model = User

    def get_by_username(self, username: str) -> User | None:
        """Return one user by username."""

        statement = select(User).where(User.username == username)
        return self.session.scalar(statement)

    def username_exists(self, username: str) -> bool:
        """Return whether a username is already in use."""

        return self.get_by_username(username) is not None
