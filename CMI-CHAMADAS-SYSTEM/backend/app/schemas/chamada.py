"""
Schemas Pydantic para chamadas.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.chamada import StatusChamada, TipoChamada


class ChamadaCreate(BaseModel):
    """Request para criar chamada."""

    agendamento_id: int = Field(..., gt=0)
    sala: str = Field(..., min_length=1, max_length=50)
    tipo: TipoChamada = TipoChamada.MEDICO
    observacoes: str | None = None


class ChamadaUpdate(BaseModel):
    """Request para atualizar chamada."""

    status: StatusChamada | None = None
    observacoes: str | None = None


class ChamadaResponse(BaseModel):
    """Response de chamada."""

    id: int
    agendamento_id: int
    sala: str
    tipo: TipoChamada
    chamado_por_id: int | None
    chamado_por_nome: str
    status: StatusChamada
    chamado_em: datetime
    atendido_em: datetime | None
    finalizado_em: datetime | None
    observacoes: str | None

    model_config = {"from_attributes": True}


class ChamadaPainelResponse(BaseModel):
    """Response de chamada para o painel (com dados do paciente)."""

    id: int
    nome_paciente: str
    sala: str
    chamado_por_nome: str
    tipo: TipoChamada
    status: StatusChamada
    chamado_em: datetime

    model_config = {"from_attributes": True}


class IniciarAtendimentoRequest(BaseModel):
    """Request para iniciar atendimento."""

    chamada_id: int = Field(..., gt=0)


class FinalizarAtendimentoRequest(BaseModel):
    """Request para finalizar atendimento."""

    chamada_id: int = Field(..., gt=0)
    paciente_compareceu: bool = True
    observacoes: str | None = None
