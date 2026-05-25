"""
Dependências compartilhadas para injeção.

Versão com CurrentChamador para permitir triagem criar chamadas.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.usuario import TipoUsuario, UsuarioChamadas

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> UsuarioChamadas:
    """
    Obtém usuário atual a partir do token JWT.

    Args:
        credentials: Credenciais do header Authorization.
        db: Sessão do banco.

    Returns:
        Usuário autenticado.

    Raises:
        HTTPException: Se token inválido ou usuário não encontrado.
    """
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformado",
        )

    user = db.get(UsuarioChamadas, int(user_id))
    if not user or not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo",
        )

    return user


async def get_current_medico(
    user: Annotated[UsuarioChamadas, Depends(get_current_user)],
) -> UsuarioChamadas:
    """Verifica se usuário é médico ou admin."""
    if user.tipo not in [TipoUsuario.MEDICO, TipoUsuario.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a médicos",
        )
    return user


async def get_current_chamador(
    user: Annotated[UsuarioChamadas, Depends(get_current_user)],
) -> UsuarioChamadas:
    """
    Verifica se usuário pode criar/gerenciar chamadas.
    
    Permite: MEDICO, TRIAGEM, ADMIN, DEV
    """
    tipos_permitidos = [
        TipoUsuario.MEDICO,
        TipoUsuario.TRIAGEM,
        TipoUsuario.ADMIN,
        TipoUsuario.DEV,
    ]
    if user.tipo not in tipos_permitidos:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a médicos, triagem e administradores",
        )
    return user


async def get_current_triagem(
    user: Annotated[UsuarioChamadas, Depends(get_current_user)],
) -> UsuarioChamadas:
    """Verifica se usuário é triagem ou admin."""
    if user.tipo not in [TipoUsuario.TRIAGEM, TipoUsuario.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito à triagem",
        )
    return user


async def get_current_admin(
    user: Annotated[UsuarioChamadas, Depends(get_current_user)],
) -> UsuarioChamadas:
    """Verifica se usuário é admin."""
    if user.tipo != TipoUsuario.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return user


async def get_current_dev(
    user: Annotated[UsuarioChamadas, Depends(get_current_user)],
) -> UsuarioChamadas:
    """Verifica se usuário é dev ou admin."""
    if user.tipo not in [TipoUsuario.DEV, TipoUsuario.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a desenvolvedores",
        )
    return user


# Type aliases para uso nos endpoints
CurrentUser = Annotated[UsuarioChamadas, Depends(get_current_user)]
CurrentMedico = Annotated[UsuarioChamadas, Depends(get_current_medico)]
CurrentChamador = Annotated[UsuarioChamadas, Depends(get_current_chamador)]
CurrentTriagem = Annotated[UsuarioChamadas, Depends(get_current_triagem)]
CurrentAdmin = Annotated[UsuarioChamadas, Depends(get_current_admin)]
CurrentDev = Annotated[UsuarioChamadas, Depends(get_current_dev)]
DbSession = Annotated[Session, Depends(get_db)]
