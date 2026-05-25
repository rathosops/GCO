"""
Schemas Pydantic para salas.
"""

from pydantic import BaseModel, Field

from app.models.sala import TipoSala


class SalaCreate(BaseModel):
    """Request para criar sala."""

    codigo: str = Field(..., min_length=1, max_length=20)
    nome: str = Field(..., min_length=2, max_length=100)
    tipo: TipoSala = TipoSala.CONSULTORIO
    descricao: str | None = None


class SalaUpdate(BaseModel):
    """Request para atualizar sala."""

    nome: str | None = Field(None, min_length=2, max_length=100)
    tipo: TipoSala | None = None
    descricao: str | None = None
    ativa: bool | None = None


class SalaResponse(BaseModel):
    """Response de sala."""

    id: int
    codigo: str
    nome: str
    tipo: TipoSala
    descricao: str | None
    ativa: bool

    model_config = {"from_attributes": True}
