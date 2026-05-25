# app/services/usuario_service.py

from typing import List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.usuario import UsuarioChamadas
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate


class UsuarioService:
    """Serviço para gerenciar usuários do sistema de chamadas."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def listar(self) -> List[UsuarioChamadas]:
        return (
            self.db.execute(select(UsuarioChamadas).order_by(UsuarioChamadas.nome))
            .scalars()
            .all()
        )

    def get(self, usuario_id: int) -> UsuarioChamadas:
        """Obtém um usuário pelo ID, ou lança 404 se não encontrar."""
        usuario = self.db.get(UsuarioChamadas, usuario_id)
        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado",
            )
        return usuario

    def get_by_username(self, username: str) -> UsuarioChamadas | None:
        """Busca usuário pelo username."""
        return (
            self.db.execute(
                select(UsuarioChamadas).where(UsuarioChamadas.username == username),
            )
            .scalars()
            .first()
        )

    def criar(self, data: UsuarioCreate) -> UsuarioChamadas:
        """
        Cria um novo usuário.

        Garante unicidade de username e faz hash de senha.
        """
        # Verificar username único
        if self.get_by_username(data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nome de usuário já está em uso",
            )

        usuario = UsuarioChamadas(
            username=data.username,
            nome=data.nome,
            tipo=data.tipo,
            sala=data.sala,
            ativo=data.ativo,
            senha_hash=get_password_hash(data.senha),
        )

        self.db.add(usuario)
        self.db.commit()
        self.db.refresh(usuario)
        return usuario

    def atualizar(self, usuario_id: int, data: UsuarioUpdate) -> UsuarioChamadas:
        """
        Atualiza dados de um usuário existente.

        Permite atualizar nome, tipo, sala, ativo e senha.
        """
        usuario = self.get(usuario_id)

        if data.nome is not None:
            usuario.nome = data.nome
        if data.tipo is not None:
            usuario.tipo = data.tipo
        if data.sala is not None:
            usuario.sala = data.sala
        if data.ativo is not None:
            usuario.ativo = data.ativo
        if data.senha:
            usuario.senha_hash = get_password_hash(data.senha)

        self.db.commit()
        self.db.refresh(usuario)
        return usuario

    def deletar(self, usuario_id: int) -> None:
        """
        Remove um usuário do sistema.

        Lança 404 se o usuário não existir.
        """
        usuario = self.get(usuario_id)

        # (Opcional) poderíamos impedir apagar o próprio usuário logado ou
        # o último ADMIN do sistema; por enquanto, delete simples.
        self.db.delete(usuario)
        self.db.commit()
