"""WebSocket routes."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.modules.panel.broadcaster import manager

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/panel")
async def panel_websocket(websocket: WebSocket) -> None:
    """Keep a panel WebSocket connection open for realtime events."""

    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)

