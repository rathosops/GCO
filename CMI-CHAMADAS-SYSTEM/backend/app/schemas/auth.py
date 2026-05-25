"""
Schemas Pydantic para autenticação.
"""

from pydantic import BaseModel, Field

from app.models.usuario import TipoUsuario


class LoginRequest(BaseModel):
    """Request de login."""

    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)


class TokenResponse(BaseModel):
    """Response com token JWT."""

    access_token: str
    token_type: str = "bearer"
    usuario: "UsuarioResponse"


class UsuarioResponse(BaseModel):
    """Response de usuário (sem senha)."""

    id: int
    username: str
    nome: str
    tipo: TipoUsuario
    sala: str | None
    ativo: bool

    model_config = {"from_attributes": True}


class UsuarioCreate(BaseModel):
    """Request para criar usuário."""

    username: str = Field(..., min_length=3, max_length=50)
    nome: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=4)
    tipo: TipoUsuario = TipoUsuario.MEDICO
    sala: str | None = None


class UsuarioUpdate(BaseModel):
    """Request para atualizar usuário."""

    nome: str | None = Field(None, min_length=2, max_length=100)
    password: str | None = Field(None, min_length=4)
    tipo: TipoUsuario | None = None
    sala: str | None = None
    ativo: bool | None = None
