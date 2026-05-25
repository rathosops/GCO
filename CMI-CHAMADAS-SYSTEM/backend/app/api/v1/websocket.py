"""
Endpoints WebSocket otimizados.

Tratamento robusto, logs mínimos.
"""

import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from app.websocket.manager import ClientType, manager

router = APIRouter(tags=["WebSocket"])


def _gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6]}"


@router.websocket("/ws/painel")
async def ws_painel(websocket: WebSocket) -> None:
    """WebSocket para painel da TV."""
    cid = _gen_id("P")
    try:
        await manager.connect(websocket, ClientType.PAINEL, cid)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("WS_ERR | {} | {}", cid, e)
    finally:
        await manager.disconnect(cid)


@router.websocket("/ws/medico")
async def ws_medico(
    websocket: WebSocket, sala: str = Query(default="Consultório 1")
) -> None:
    """WebSocket para médico."""
    cid = _gen_id("M")
    try:
        await manager.connect(websocket, ClientType.MEDICO, cid, {"sala": sala})
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("WS_ERR | {} | {}", cid, e)
    finally:
        await manager.disconnect(cid)


@router.websocket("/ws/triagem")
async def ws_triagem(websocket: WebSocket) -> None:
    """WebSocket para triagem."""
    cid = _gen_id("T")
    try:
        await manager.connect(websocket, ClientType.TRIAGEM, cid)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("WS_ERR | {} | {}", cid, e)
    finally:
        await manager.disconnect(cid)


@router.websocket("/ws/admin")
async def ws_admin(websocket: WebSocket) -> None:
    """WebSocket admin."""
    cid = _gen_id("A")
    try:
        await manager.connect(websocket, ClientType.ADMIN, cid)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("WS_ERR | {} | {}", cid, e)
    finally:
        await manager.disconnect(cid)


@router.websocket("/ws/dev")
async def ws_dev(websocket: WebSocket) -> None:
    """WebSocket dev."""
    cid = _gen_id("D")
    try:
        await manager.connect(websocket, ClientType.DEV, cid)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("WS_ERR | {} | {}", cid, e)
    finally:
        await manager.disconnect(cid)
