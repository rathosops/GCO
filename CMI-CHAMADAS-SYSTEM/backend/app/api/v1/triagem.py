"""
Endpoints de triagem IMESC.
"""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentTriagem, DbSession
from app.schemas.triagem import ConcluirTriagemRequest, TriagemResponse
from app.services.triagem_service import TriagemService
from app.services.chamada_service import ChamadaService
from app.websocket.manager import manager

router = APIRouter(prefix="/triagem", tags=["Triagem IMESC"])


@router.post("/concluir", response_model=TriagemResponse)
async def concluir_triagem(
    request: ConcluirTriagemRequest,
    db: DbSession,
    user: CurrentTriagem,
) -> TriagemResponse:
    """
    Conclui triagem de paciente IMESC.

    Após conclusão, o paciente pode ser chamado pelo médico.

    Args:
        request: Dados da triagem.
        db: Sessão do banco.
        user: Usuário da triagem.

    Returns:
        Registro de triagem.
    """
    service = TriagemService(db)
    chamada_service = ChamadaService(db)  # 👈 para obter chamadas do painel

    try:
        triagem = service.concluir_triagem(
            agendamento_id=request.agendamento_id,
            usuario=user,
            observacoes=request.observacoes,
        )

        # Lista de chamadas ativas atualizadas (após triagem finalizar chamada de TRIAGEM)
        chamadas_painel = chamada_service.listar_chamadas_painel()

        # Broadcast para médicos, painéis, triagem, admin e dev
        await manager.broadcast_triagem(
            {
                "agendamento_id": triagem.agendamento_id,
                "triagem_id": triagem.id,
                "mensagem": "Paciente IMESC liberado para atendimento médico",
                "chamadas": chamadas_painel,
            },
        )

        return TriagemResponse.model_validate(triagem)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/pendentes")
async def listar_pendentes(
    db: DbSession,
    user: CurrentTriagem,
) -> list[dict]:
    """
    Lista pacientes IMESC aguardando triagem.

    Args:
        db: Sessão do banco.
        user: Usuário da triagem.

    Returns:
        Lista de agendamentos IMESC pendentes.
    """
    service = TriagemService(db)
    return service.listar_pendentes()


@router.get("/concluidas")
async def listar_concluidas(
    db: DbSession,
    user: CurrentTriagem,
) -> list[dict]:
    """
    Lista triagens concluídas hoje.

    Args:
        db: Sessão do banco.
        user: Usuário da triagem.

    Returns:
        Lista de triagens concluídas.
    """
    service = TriagemService(db)
    return service.listar_concluidas_hoje()


@router.get("/verificar/{agendamento_id}")
async def verificar_triagem(
    agendamento_id: int,
    db: DbSession,
) -> dict:
    """
    Verifica se triagem foi concluída para agendamento.

    Endpoint público para verificação rápida.

    Args:
        agendamento_id: ID do agendamento.
        db: Sessão do banco.

    Returns:
        Status da triagem.
    """
    service = TriagemService(db)
    concluida = service.verificar_triagem(agendamento_id)
    return {"agendamento_id": agendamento_id, "triagem_concluida": concluida}
