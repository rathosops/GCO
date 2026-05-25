"""
Gerenciador de conexões WebSocket.

Gerencia conexões e broadcast de chamadas em tempo real.

Eventos:
- C (CHAMADA): Nova chamada de paciente
- S (EMITIR_SOM): Rechamada (paciente demorando) 
- U (ATUALIZA): Atualização de status (sem som)
- T (TRIAGEM): Triagem concluída
- H (HEARTBEAT): Keep-alive
- OK (CONECTADO): Confirmação de conexão
- E (ERRO): Erro
"""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from fastapi import WebSocket
from loguru import logger


class EventType(StrEnum):
    """Tipos de eventos (nomes curtos para payload menor)."""

    CHAMADA = "C"      # Nova chamada → toca som 3x
    EMITIR_SOM = "S"   # Rechamada → toca som 1x (diferente)
    ATUALIZA = "U"     # Atualização → sem som
    TRIAGEM = "T"
    HEARTBEAT = "H"
    CONECTADO = "OK"
    ERRO = "E"


class ClientType(StrEnum):
    """Tipos de cliente."""

    PAINEL = "P"
    MEDICO = "M"
    TRIAGEM = "T"
    ADMIN = "A"
    DEV = "D"


@dataclass
class WSClient:
    """Cliente WebSocket."""

    ws: WebSocket
    tipo: ClientType
    id: str
    conectado_em: datetime = field(default_factory=lambda: datetime.now(UTC))
    ultimo_ping: datetime = field(default_factory=lambda: datetime.now(UTC))


class ConnectionManager:
    """Gerenciador de conexões otimizado."""

    SEND_TIMEOUT: float = 3.0  # Timeout agressivo
    HEARTBEAT_INTERVAL: int = 45  # Maior para TV

    def __init__(self) -> None:
        self._clients: dict[str, WSClient] = {}
        self._heartbeat_task: asyncio.Task | None = None
        self._last_broadcast: datetime | None = None
        self._debounce_ms: int = 100

    @property
    def connection_count(self) -> int:
        return len(self._clients)

    @property
    def connections_by_type(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for c in self._clients.values():
            counts[c.tipo] = counts.get(c.tipo, 0) + 1
        return counts

    async def connect(
        self,
        ws: WebSocket,
        tipo: ClientType,
        client_id: str,
        metadata: dict | None = None,
    ) -> WSClient:
        """Aceita conexão."""
        await ws.accept()

        client = WSClient(ws=ws, tipo=tipo, id=client_id)
        self._clients[client_id] = client

        logger.info("WS+ | {} | {} | total={}", tipo, client_id, len(self._clients))

        # Confirmação mínima
        await self._send(client, EventType.CONECTADO, {"id": client_id})

        # Inicia heartbeat
        if not self._heartbeat_task or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        return client

    async def disconnect(self, client_id: str) -> None:
        """Remove cliente."""
        if client_id in self._clients:
            c = self._clients.pop(client_id)
            logger.info(
                "WS- | {} | {} | total={}", c.tipo, client_id, len(self._clients)
            )

    async def broadcast(
        self,
        event: EventType,
        data: dict[str, Any],
        tipos: list[ClientType] | None = None,
    ) -> None:
        """Broadcast com debounce."""
        # Debounce simples
        now = datetime.now(UTC)
        if self._last_broadcast:
            diff_ms = (now - self._last_broadcast).total_seconds() * 1000
            if diff_ms < self._debounce_ms:
                await asyncio.sleep(self._debounce_ms / 1000)

        self._last_broadcast = now

        msg = self._msg(event, data)
        dead: list[str] = []

        for cid, client in list(self._clients.items()):
            if tipos and client.tipo not in tipos:
                continue

            try:
                await asyncio.wait_for(
                    client.ws.send_json(msg),
                    timeout=self.SEND_TIMEOUT,
                )
            except Exception:
                dead.append(cid)

        for cid in dead:
            await self.disconnect(cid)

    async def broadcast_chamada(self, data: dict) -> None:
        """Broadcast de NOVA chamada para painéis (som 3x)."""
        payload = {
            "chamadas": [
                {
                    "id": c.get("id"),
                    "nome": c.get("nome_paciente", "")[:30],
                    "sala": c.get("sala"),
                    "status": c.get("status"),
                }
                for c in data.get("chamadas", [])
            ]
        }

        await self.broadcast(
            EventType.CHAMADA,
            payload,
            tipos=[ClientType.PAINEL, ClientType.ADMIN, ClientType.DEV],
        )

    async def broadcast_emitir_som(self, data: dict) -> None:
        """Broadcast de RECHAMADA para painéis (som diferente, 1x)."""
        payload = {
            "chamadas": [
                {
                    "id": c.get("id"),
                    "nome": c.get("nome_paciente", "")[:30],
                    "sala": c.get("sala"),
                    "status": c.get("status"),
                }
                for c in data.get("chamadas", [])
            ]
        }

        await self.broadcast(
            EventType.EMITIR_SOM,
            payload,
            tipos=[ClientType.PAINEL, ClientType.ADMIN, ClientType.DEV],
        )

    async def broadcast_atualizacao(self, data: dict) -> None:
        """Broadcast de atualização (sem som)."""
        payload = {
            "chamadas": [
                {
                    "id": c.get("id"),
                    "nome": c.get("nome_paciente", "")[:30],
                    "sala": c.get("sala"),
                    "status": c.get("status"),
                }
                for c in data.get("chamadas", [])
            ]
        }

        await self.broadcast(
            EventType.ATUALIZA,
            payload,
            tipos=[ClientType.PAINEL, ClientType.ADMIN, ClientType.DEV],
        )

    async def broadcast_triagem(self, data: dict) -> None:
        """Broadcast de triagem concluída."""
        payload = {
            "ag_id": data.get("agendamento_id"),
            "msg": "IMESC liberado",
        }

        await self.broadcast(
            EventType.TRIAGEM,
            payload,
            tipos=[
                ClientType.MEDICO,
                ClientType.PAINEL,
                ClientType.TRIAGEM,
                ClientType.ADMIN,
                ClientType.DEV,
            ],
        )

    async def broadcast_error(
        self, code: str, message: str, context: dict | None = None
    ) -> None:
        """Broadcast de erro para devs."""
        await self.broadcast(
            EventType.ERRO,
            {"code": code, "msg": message[:100]},
            tipos=[ClientType.DEV, ClientType.ADMIN],
        )

    def get_stats(self) -> dict:
        """Estatísticas."""
        return {
            "total": self.connection_count,
            "by_type": self.connections_by_type,
            "clients": [
                {"id": c.id, "tipo": c.tipo, "desde": c.conectado_em.isoformat()}
                for c in self._clients.values()
            ],
        }

    async def _send(self, client: WSClient, event: EventType, data: dict) -> bool:
        """Envia para cliente específico."""
        try:
            await asyncio.wait_for(
                client.ws.send_json(self._msg(event, data)),
                timeout=self.SEND_TIMEOUT,
            )
            return True
        except Exception:
            return False

    def _msg(self, event: EventType, data: dict) -> dict:
        """Monta mensagem compacta."""
        return {"e": event, "d": data, "t": int(datetime.now(UTC).timestamp())}

    async def _heartbeat_loop(self) -> None:
        """Loop de heartbeat."""
        while self._clients:
            await asyncio.sleep(self.HEARTBEAT_INTERVAL)

            dead: list[str] = []
            msg = self._msg(EventType.HEARTBEAT, {})

            for cid, client in list(self._clients.items()):
                try:
                    await asyncio.wait_for(
                        client.ws.send_json(msg),
                        timeout=self.SEND_TIMEOUT,
                    )
                    client.ultimo_ping = datetime.now(UTC)
                except Exception:
                    dead.append(cid)

            for cid in dead:
                await self.disconnect(cid)


# Singleton
manager = ConnectionManager()
