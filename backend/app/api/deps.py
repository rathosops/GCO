"""Reusable FastAPI dependencies."""

from collections.abc import Callable, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db_session
from app.core.security import decode_access_token
from app.modules.auth.models import User, UserRole
from app.modules.auth.permissions import Permission, has_permissions
from app.modules.auth.repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session]:
    """Yield a database session for route handlers."""

    yield from get_db_session()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_db),
) -> User:
    """Return the authenticated active user or raise HTTP 401."""

    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais invalidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise unauthorized

    subject = payload.get("sub")
    if subject is None:
        raise unauthorized

    try:
        user_id = int(subject)
    except ValueError as exc:
        raise unauthorized from exc

    user = UserRepository(session).get(user_id)
    if user is None or not user.is_active:
        raise unauthorized

    return user


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Return a dependency that allows only specific user roles."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role_enum not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissao insuficiente",
            )
        return user

    return dependency


def require_permissions(*permissions: Permission | str) -> Callable[[User], User]:
    """Return a dependency that requires all listed permissions."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if not has_permissions(user.permissions, permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissao insuficiente",
            )
        return user

    return dependency
