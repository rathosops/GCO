"""
Endpoints de agendamentos otimizados.

Usa serviço com cache Redis.
"""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, CurrentTriagem, DbSession
from app.services.agendamento_service import AgendamentoService
from app.services.triagem_service import TriagemService

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])


@router.get("/hoje")
async def listar_agendamentos_hoje(db: DbSession, user: CurrentUser) -> list[dict]:
    """Lista agendamentos do dia (cached)."""
    service = AgendamentoService(db)
    return service.get_hoje()


@router.get("/aguardando")
async def listar_aguardando_chamada(db: DbSession, user: CurrentUser) -> list[dict]:
    """Lista pacientes aguardando chamada (cached)."""
    service = AgendamentoService(db)
    return service.get_aguardando()


@router.get("/confirmados")
async def listar_confirmados_hoje(db: DbSession, user: CurrentUser) -> list[dict]:
    """Lista pacientes confirmados (cached)."""
    service = AgendamentoService(db)
    return service.get_confirmados()


@router.get("/triagem")
async def listar_agendamentos_triagem(db: DbSession, user: CurrentTriagem) -> list[dict]:
    """
    Lista agendamentos IMESC pendentes de triagem.
    
    Mesmo que /triagem/pendentes mas acessível via /agendamentos.
    """
    service = TriagemService(db)
    return service.listar_pendentes()


@router.get("/{agendamento_id}")
async def get_agendamento(
    agendamento_id: int, db: DbSession, user: CurrentUser
) -> dict:
    """Busca agendamento por ID."""
    service = AgendamentoService(db)
    ag = service.get_by_id(agendamento_id)

    if not ag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agendamento não encontrado",
        )

    return ag