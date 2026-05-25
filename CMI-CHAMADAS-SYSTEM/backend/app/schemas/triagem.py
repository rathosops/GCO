"""
Schemas Pydantic para triagem IMESC.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class TriagemCreate(BaseModel):
    """Request para registrar triagem."""

    agendamento_id: int = Field(..., gt=0)
    observacoes: str | None = None


class TriagemResponse(BaseModel):
    """Response de triagem."""

    id: int
    agendamento_id: int
    triagem_concluida: bool
    triagem_em: datetime | None
    realizada_por_id: int | None
    observacoes: str | None

    model_config = {"from_attributes": True}


class ConcluirTriagemRequest(BaseModel):
    """Request para concluir triagem."""

    agendamento_id: int = Field(..., gt=0)
    observacoes: str | None = None
