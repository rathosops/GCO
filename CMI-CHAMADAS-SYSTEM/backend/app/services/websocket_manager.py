"""
WebSocket Manager
Sistema de Chamadas - CMI
"""

from fastapi import WebSocket
from typing import Dict, List, Optional
from datetime import datetime
from loguru import logger
import json

from app.utils.redis_client import redis_client


class WebSocketManager:
    """
    Gerenciador de conexões WebSocket
    """

    def __init__(self):
        # Armazena conexões ativas
        # { client_id: { "websocket": WebSocket, "type": str, "connected_at": datetime } }
        self.active_connections: Dict[str, dict] = {}

        # Organiza conexões por tipo
        # { "display": [id1, id2], "painel": [id3, id4] }
        self.connections_by_type: Dict[str, List[str]] = {
            "display": [],
            "painel": [],
            "monitor": [],
        }

    async def connect(self, websocket: WebSocket, client_type: str, client_id: str):
        """
        Conecta um novo cliente WebSocket
        """
        await websocket.accept()

        self.active_connections[client_id] = {
            "websocket": websocket,
            "type": client_type,
            "connected_at": datetime.now(),
        }

        if client_type in self.connections_by_type:
            self.connections_by_type[client_type].append(client_id)

        logger.info(
            f"🔌 Cliente conectado: {client_type}/{client_id} "
            f"(Total: {len(self.active_connections)})"
        )

        # Enviar mensagem de boas-vindas
        await self.send_personal_message(
            {
                "type": "connected",
                "message": "Conectado ao servidor de chamadas",
                "timestamp": datetime.now().isoformat(),
            },
            client_id,
        )

    async def disconnect(self, client_id: str):
        """
        Desconecta um cliente WebSocket
        """
        if client_id in self.active_connections:
            client_info = self.active_connections[client_id]
            client_type = client_info["type"]

            # Remover da lista de conexões
            del self.active_connections[client_id]

            # Remover da lista por tipo
            if client_type in self.connections_by_type:
                if client_id in self.connections_by_type[client_type]:
                    self.connections_by_type[client_type].remove(client_id)

            logger.info(
                f"🔌 Cliente desconectado: {client_type}/{client_id} "
                f"(Total: {len(self.active_connections)})"
            )

    async def disconnect_all(self):
        """
        Desconecta todos os clientes
        """
        for client_id in list(self.active_connections.keys()):
            await self.disconnect(client_id)

    async def send_personal_message(self, message: dict, client_id: str):
        """
        Envia mensagem para um cliente específico
        """
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]["websocket"]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Erro ao enviar mensagem para {client_id}: {e}")
                await self.disconnect(client_id)

    async def broadcast(self, message: dict, client_type: Optional[str] = None):
        """
        Envia mensagem para todos os clientes ou de um tipo específico
        """
        if client_type:
            # Broadcast para tipo específico
            client_ids = self.connections_by_type.get(client_type, [])
        else:
            # Broadcast para todos
            client_ids = list(self.active_connections.keys())

        for client_id in client_ids:
            await self.send_personal_message(message, client_id)

    async def broadcast_chamada(self, chamada_data: dict):
        """
        Broadcast de nova chamada para displays
        """
        message = {
            "type": "nova_chamada",
            "data": chamada_data,
            "timestamp": datetime.now().isoformat(),
        }

        # Enviar para displays
        await self.broadcast(message, client_type="display")

        # Publicar no Redis para sincronização entre instâncias
        await redis_client.publish("chamadas:nova", message)

        logger.info(f"📢 Chamada broadcast: {chamada_data.get('numero_senha')}")

    async def broadcast_atualizacao_fila(self, fila_data: list):
        """
        Broadcast de atualização da fila para painéis
        """
        message = {
            "type": "atualizacao_fila",
            "data": fila_data,
            "timestamp": datetime.now().isoformat(),
        }

        # Enviar para painéis
        await self.broadcast(message, client_type="painel")

        logger.info(f"📋 Fila atualizada: {len(fila_data)} pacientes")

    async def handle_message(self, data: dict, client_id: str, client_type: str):
        """
        Processa mensagens recebidas dos clientes
        """
        message_type = data.get("type")

        logger.debug(f"📨 Mensagem recebida: {message_type} de {client_id}")

        # Heartbeat/ping
        if message_type == "ping":
            await self.send_personal_message(
                {"type": "pong", "timestamp": datetime.now().isoformat()}, client_id
            )

        # Outras mensagens podem ser tratadas aqui
        # Ex: requisição de estado atual, confirmação de recebimento, etc.

    def get_connection_stats(self) -> dict:
        """
        Retorna estatísticas das conexões
        """
        return {
            "total": len(self.active_connections),
            "by_type": {
                client_type: len(clients)
                for client_type, clients in self.connections_by_type.items()
            },
            "clients": [
                {
                    "id": client_id,
                    "type": info["type"],
                    "connected_at": info["connected_at"].isoformat(),
                }
                for client_id, info in self.active_connections.items()
            ],
        }


# Instância global do WebSocket Manager
ws_manager = WebSocketManager()
