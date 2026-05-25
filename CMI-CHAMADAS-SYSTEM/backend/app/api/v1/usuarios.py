# app/api/v1/usuarios.py

from typing import List

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.models.usuario import TipoUsuario, UsuarioChamadas
from app.schemas.usuario import UsuarioCreate, UsuarioRead, UsuarioUpdate
from app.services.usuario_service import UsuarioService

router = APIRouter(prefix="/usuarios", tags=["Usuários"])


def _ensure_admin_or_dev(usuario: UsuarioChamadas) -> None:
    """Garante que apenas ADMIN ou DEV possam gerenciar usuários."""
    if usuario.tipo not in (TipoUsuario.ADMIN, TipoUsuario.DEV):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas ADMIN ou DEV podem gerenciar usuários",
        )


@router.get("/", response_model=List[UsuarioRead])
def listar_usuarios(
    db: DbSession,
    usuario_atual: CurrentUser,
) -> List[UsuarioRead]:
    """
    Lista todos os usuários do sistema.

    Restrito a ADMIN e DEV.
    """
    _ensure_admin_or_dev(usuario_atual)
    service = UsuarioService(db)
    usuarios = service.listar()
    return [UsuarioRead.model_validate(u) for u in usuarios]


@router.get("/{usuario_id}", response_model=UsuarioRead)
def obter_usuario(
    usuario_id: int,
    db: DbSession,
    usuario_atual: CurrentUser,
) -> UsuarioRead:
    """
    Obtém um usuário específico pelo ID.

    Restrito a ADMIN e DEV.
    """
    _ensure_admin_or_dev(usuario_atual)
    service = UsuarioService(db)
    usuario = service.get(usuario_id)
    return UsuarioRead.model_validate(usuario)


@router.post("/", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED)
def criar_usuario(
    payload: UsuarioCreate,
    db: DbSession,
    usuario_atual: CurrentUser,
) -> UsuarioRead:
    """
    Cria um novo usuário (médico, triagem, admin, dev).

    Restrito a ADMIN e DEV.
    """
    _ensure_admin_or_dev(usuario_atual)
    service = UsuarioService(db)
    usuario = service.criar(payload)
    return UsuarioRead.model_validate(usuario)


@router.patch("/{usuario_id}", response_model=UsuarioRead)
def atualizar_usuario(
    usuario_id: int,
    payload: UsuarioUpdate,
    db: DbSession,
    usuario_atual: CurrentUser,
) -> UsuarioRead:
    """
    Atualiza dados de um usuário existente.

    Restrito a ADMIN e DEV.
    """
    _ensure_admin_or_dev(usuario_atual)
    service = UsuarioService(db)
    usuario = service.atualizar(usuario_id, payload)
    return UsuarioRead.model_validate(usuario)


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_usuario(
    usuario_id: int,
    db: DbSession,
    usuario_atual: CurrentUser,
) -> None:
    """
    Remove um usuário do sistema.

    Restrito a ADMIN e DEV.
    """
    _ensure_admin_or_dev(usuario_atual)
    service = UsuarioService(db)
    service.deletar(usuario_id)
