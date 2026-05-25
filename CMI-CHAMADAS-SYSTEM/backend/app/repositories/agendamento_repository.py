"""
Repositório de acesso a agendamentos.

Centraliza consultas de leitura na tabela `agendamentos`,
evitando duplicação de SQL em vários serviços.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


class AgendamentoRepository:
    """Operações de leitura para agendamentos."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_id(self, agendamento_id: int) -> dict[str, Any] | None:
        """
        Retorna o agendamento como dict ou None.

        Args:
            agendamento_id: ID do agendamento.

        Returns:
            Dict com colunas do agendamento ou None se não existir.
        """
        query = text("SELECT * FROM agendamentos WHERE id = :id")
        result = self._db.execute(query, {"id": agendamento_id}).mappings().first()
        if result is None:
            return None
        return dict(result)
