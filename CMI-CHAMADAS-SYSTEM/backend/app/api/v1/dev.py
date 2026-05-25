"""
Endpoints para desenvolvedores.

Fornece métricas, logs e simuladores para debug.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.api.deps import CurrentDev, DbSession
from app.models.chamada import TipoChamada
from app.services.chamada_service import ChamadaService
from app.websocket.manager import manager

router = APIRouter(prefix="/dev", tags=["Desenvolvimento"])


@router.get("/stats")
async def get_stats(user: CurrentDev) -> dict:
    """
    Retorna estatísticas do sistema.

    Args:
        user: Usuário dev autenticado.

    Returns:
        Estatísticas de conexões e sistema.
    """
    ws_stats = manager.get_stats()
    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "websocket": ws_stats,
        "system": {
            "status": "online",
            "version": "1.0.0",
        },
    }


@router.get("/conexoes")
async def listar_conexoes(user: CurrentDev) -> dict:
    """
    Lista todas as conexões WebSocket ativas.

    Args:
        user: Usuário dev autenticado.

    Returns:
        Detalhes das conexões.
    """
    return manager.get_stats()


@router.post("/simular-chamada")
async def simular_chamada(
    agendamento_id: int,
    sala: str,
    tipo: TipoChamada,
    db: DbSession,
    user: CurrentDev,
) -> dict:
    """
    Simula uma chamada para testes.

    Args:
        agendamento_id: ID do agendamento.
        sala: Sala de destino.
        tipo: Tipo de chamada.
        db: Sessão do banco.
        user: Usuário dev.

    Returns:
        Resultado da simulação.
    """
    service = ChamadaService(db)

    try:
        chamada = service.criar_chamada(
            agendamento_id=agendamento_id,
            sala=sala,
            tipo=tipo,
            usuario=user,
            observacoes="[SIMULAÇÃO DEV]",
        )

        # Broadcast
        chamadas_painel = service.listar_chamadas_painel()
        await manager.broadcast_chamada({"chamadas": chamadas_painel, "nova": chamada.to_dict()})

        return {"success": True, "chamada": chamada.to_dict()}

    except ValueError as e:
        return {"success": False, "error": str(e)}


@router.post("/broadcast-teste")
async def broadcast_teste(
    mensagem: str,
    user: CurrentDev,
) -> dict:
    """
    Envia broadcast de teste para todas as conexões.

    Args:
        mensagem: Mensagem de teste.
        user: Usuário dev.

    Returns:
        Confirmação do broadcast.
    """
    from app.websocket.manager import EventType

    await manager.broadcast(
        EventType.ERRO,
        {"tipo": "TESTE_DEV", "mensagem": mensagem, "enviado_por": user.nome},
    )

    return {"success": True, "conexoes_ativas": manager.connection_count}


@router.get("/logs")
async def get_logs(
    user: CurrentDev,
    linhas: int = 100,
) -> dict:
    """
    Retorna últimas linhas de log.

    Args:
        user: Usuário dev.
        linhas: Número de linhas.

    Returns:
        Logs do sistema.
    """
    # TODO: Implementar leitura de logs do arquivo
    return {
        "info": "Logs em implementação",
        "dica": "Use docker logs cmi-chamadas-backend para ver os logs",
    }


@router.get("/db-status")
async def db_status(
    db: DbSession,
    user: CurrentDev,
) -> dict:
    """
    Verifica status do banco de dados.

    Args:
        db: Sessão do banco.
        user: Usuário dev.

    Returns:
        Status das tabelas.
    """
    tables_query = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = [row[0] for row in db.execute(tables_query)]

    counts = {}
    for table in ["agendamentos", "chamadas", "usuarios_chamadas", "triagem_imesc", "salas_chamadas"]:
        if table in tables:
            count_query = text(f"SELECT COUNT(*) FROM {table}")  # noqa: S608
            counts[table] = db.execute(count_query).scalar()
        else:
            counts[table] = "TABELA NÃO EXISTE"

    return {
        "status": "connected",
        "tables": tables,
        "counts": counts,
    }
