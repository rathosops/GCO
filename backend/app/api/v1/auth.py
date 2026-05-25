"""Authentication routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.modules.auth.exceptions import InactiveUserError, InvalidCredentialsError
from app.modules.auth.models import User
from app.modules.auth.schemas import LoginRequest, TokenResponse, UserRead
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, session: Session = Depends(get_db)
) -> TokenResponse:
    """Authenticate a user and return a bearer token."""

    try:
        return AuthService(session).authenticate(payload.username, payload.password)
    except InactiveUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inativo",
        ) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais invalidas",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> UserRead:
    """Return the current authenticated user."""

    return UserRead.model_validate(current_user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(_current_user: User = Depends(get_current_user)) -> None:
    """Accept logout requests for stateless bearer-token clients."""

    return
