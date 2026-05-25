# app/schemas/usuario.py

from typing import Optional

from pydantic import BaseModel, Field
from app.models.usuario import TipoUsuario


class UsuarioBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    nome: str = Field(..., min_length=3, max_length=100)
    tipo: TipoUsuario
    sala: Optional[str] = None
    ativo: bool = True


class UsuarioCreate(UsuarioBase):
    senha: str = Field(..., min_length=4, max_length=128)


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=3, max_length=100)
    tipo: Optional[TipoUsuario] = None
    sala: Optional[str] = None
    ativo: Optional[bool] = None
    senha: Optional[str] = Field(None, min_length=4, max_length=128)


class UsuarioRead(UsuarioBase):
    id: int

    class Config:
        from_attributes = True  # SQLAlchemy -> Pydantic 2
