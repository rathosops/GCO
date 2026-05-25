"""
Endpoints de chamadas otimizados.

Responses mais enxutas para TV.
"""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentChamador, CurrentUser, DbSession
from app.models.chamada import Chamada, StatusChamada
from app.schemas.chamada import (
    ChamadaCreate,
    ChamadaResponse,
    FinalizarAtendimentoRequest,
    IniciarAtendimentoRequest,
)
from app.services.chamada_service import ChamadaService
from app.websocket.manager import manager

router = APIRouter(prefix="/chamadas", tags=["Chamadas"])


@router.post("/", response_model=ChamadaResponse, status_code=status.HTTP_201_CREATED)
async def criar_chamada(
    request: ChamadaCreate, db: DbSession, user: CurrentChamador
) -> ChamadaResponse:
    """Cria nova chamada."""
    service = ChamadaService(db)

    try:
        chamada = service.criar_chamada(
            agendamento_id=request.agendamento_id,
            sala=request.sala,
            tipo=request.tipo,
            usuario=user,
            observacoes=request.observacoes,
        )

        # Broadcast otimizado - evento CHAMADA (C) para tocar som no painel
        chamadas = service.listar_chamadas_painel()
        await manager.broadcast_chamada({"chamadas": chamadas})

        return ChamadaResponse.model_validate(chamada)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/iniciar-atendimento", response_model=ChamadaResponse)
async def iniciar_atendimento(
    request: IniciarAtendimentoRequest, db: DbSession, user: CurrentChamador
) -> ChamadaResponse:
    """Marca como em atendimento."""
    service = ChamadaService(db)

    try:
        chamada = service.iniciar_atendimento(request.chamada_id)
        chamadas = service.listar_chamadas_painel()
        # Evento ATUALIZA (U) - sem som
        await manager.broadcast_atualizacao({"chamadas": chamadas})
        return ChamadaResponse.model_validate(chamada)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/finalizar-atendimento", response_model=ChamadaResponse)
async def finalizar_atendimento(
    request: FinalizarAtendimentoRequest, db: DbSession, user: CurrentChamador
) -> ChamadaResponse:
    """Finaliza atendimento."""
    service = ChamadaService(db)

    try:
        chamada = service.finalizar_atendimento(
            chamada_id=request.chamada_id,
            paciente_compareceu=request.paciente_compareceu,
            observacoes=request.observacoes,
        )
        chamadas = service.listar_chamadas_painel()
        # Evento ATUALIZA (U) - sem som
        await manager.broadcast_atualizacao({"chamadas": chamadas})
        return ChamadaResponse.model_validate(chamada)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{chamada_id}/cancelar", response_model=ChamadaResponse)
async def cancelar_chamada(
    chamada_id: int, db: DbSession, user: CurrentChamador
) -> ChamadaResponse:
    """Cancela chamada."""
    service = ChamadaService(db)

    try:
        chamada = service.cancelar_chamada(chamada_id)
        chamadas = service.listar_chamadas_painel()
        await manager.broadcast_atualizacao({"chamadas": chamadas})
        return ChamadaResponse.model_validate(chamada)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{chamada_id}/emitir-som")
async def emitir_som_chamada(
    chamada_id: int, db: DbSession, user: CurrentChamador
) -> dict:
    """
    Emite som de chamada no painel (paciente demorando).

    Envia evento CHAMADA (C) via WebSocket para que o painel
    toque o som de notificação 3x.
    """
    service = ChamadaService(db)

    # Verifica se chamada existe
    chamada = db.get(Chamada, chamada_id)
    if not chamada:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chamada não encontrada",
        )

    # Só pode emitir som se estiver chamando
    if chamada.status != StatusChamada.CHAMANDO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Só pode emitir som para chamadas com status CHAMANDO",
        )

    # Broadcast CHAMADA (C) - mesmo evento de nova chamada = toca som no painel
    chamadas = service.listar_chamadas_painel()
    await manager.broadcast_chamada({"chamadas": chamadas})

    return {"ok": True, "message": "Som emitido no painel"}


@router.post("/resetar")
async def resetar_chamadas(db: DbSession, user: CurrentChamador) -> dict:
    """Reseta chamadas ativas."""
    service = ChamadaService(db)

    try:
        count = service.resetar_chamadas_ativas()
        chamadas = service.listar_chamadas_painel()
        await manager.broadcast_atualizacao({"chamadas": chamadas})
        return {"message": f"{count} chamada(s) resetada(s)", "count": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.get("/painel")
async def listar_chamadas_painel(db: DbSession) -> list[dict]:
    """Lista chamadas para painel (público, cached)."""
    service = ChamadaService(db)
    return service.listar_chamadas_painel(limite=5)


@router.get("/historico-hoje")
async def listar_historico_hoje(db: DbSession, limite: int = 20) -> list[dict]:
    """Histórico do dia (cached)."""
    service = ChamadaService(db)
    return service.listar_historico_hoje(limite=limite)


@router.get("/historico", response_model=list[ChamadaResponse])
async def listar_historico(
    db: DbSession, user: CurrentUser, limite: int = 100
) -> list[ChamadaResponse]:
    """Histórico completo (admin)."""
    service = ChamadaService(db)
    chamadas = service.listar_historico(limite=limite)
    return [ChamadaResponse.model_validate(c) for c in chamadas]
