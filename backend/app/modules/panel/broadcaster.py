"""WebSocket connection manager and Redis subscriber for panel events."""

import asyncio
import contextlib

from fastapi import WebSocket
from redis import RedisError

from app.core.redis import get_async_redis_client
from app.modules.panel.events import (
    PANEL_EVENT_SOURCE_ID,
    PANEL_EVENTS_CHANNEL,
    PanelEvent,
)


class PanelConnectionManager:
    """Track connected panel clients and broadcast events."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a WebSocket connection."""

        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""

        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, event: PanelEvent) -> None:
        """Broadcast one event to all currently connected clients."""

        async with self._lock:
            connections = list(self._connections)

        stale_connections: list[WebSocket] = []
        payload = event.model_dump(mode="json")
        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                stale_connections.append(websocket)

        if stale_connections:
            async with self._lock:
                for websocket in stale_connections:
                    self._connections.discard(websocket)


manager = PanelConnectionManager()


async def subscribe_panel_events() -> None:
    """Forward Redis Pub/Sub panel events to local WebSocket connections."""

    client = get_async_redis_client()
    while True:
        pubsub = client.pubsub()
        try:
            await pubsub.subscribe(PANEL_EVENTS_CHANNEL)
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                event = PanelEvent.model_validate_json(message["data"])
                if event.payload.get("_source_id") == PANEL_EVENT_SOURCE_ID:
                    continue
                await manager.broadcast(event)
        except (RedisError, OSError, ValueError):
            await asyncio.sleep(2)
        finally:
            with contextlib.suppress(Exception):
                await pubsub.close()
