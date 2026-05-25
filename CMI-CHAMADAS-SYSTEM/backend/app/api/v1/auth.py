"""
Endpoints de autenticação.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.usuario import UsuarioChamadas
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UsuarioCreate,
    UsuarioResponse,
)

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """
    Realiza login e retorna token JWT.

    Args:
        request: Credenciais de login.
        db: Sessão do banco.

    Returns:
        Token de acesso e dados do usuário.
    """
    # Buscar usuário
    user = db.execute(
        select(UsuarioChamadas).where(UsuarioChamadas.username == request.username)
    ).scalar_one_or_none()

    if not user or not verify_password(request.password, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
        )

    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo",
        )

    # Gerar token
    token = create_access_token(data={"sub": str(user.id), "tipo": user.tipo.value})

    return TokenResponse(
        access_token=token,
        usuario=UsuarioResponse.model_validate(user),
    )


@router.post("/register", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: UsuarioCreate,
    db: Annotated[Session, Depends(get_db)],
) -> UsuarioResponse:
    """
    Registra novo usuário (apenas para setup inicial).

    Em produção, este endpoint deve ser protegido ou removido.

    Args:
        request: Dados do novo usuário.
        db: Sessão do banco.

    Returns:
        Usuário criado.
    """
    # Verificar se username já existe
    existing = db.execute(
        select(UsuarioChamadas).where(UsuarioChamadas.username == request.username)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username já existe",
        )

    user = UsuarioChamadas(
        username=request.username,
        nome=request.nome,
        senha_hash=get_password_hash(request.password),
        tipo=request.tipo,
        sala=request.sala,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UsuarioResponse.model_validate(user)
