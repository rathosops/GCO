"""
Serviço de triagem IMESC otimizado.

Cache para listagens frequentes.
"""

from datetime import UTC, datetime, date

from loguru import logger
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.cache import (
    CacheKeys,
    CacheTTL,
    cache_get,
    cache_set,
    invalidate_triagem,
)
from app.models.chamada import Chamada, StatusChamada, TipoChamada
from app.models.triagem import TriagemIMESC
from app.models.usuario import UsuarioChamadas


class TriagemService:
    """Serviço otimizado para triagem IMESC."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def concluir_triagem(
        self,
        agendamento_id: int,
        usuario: UsuarioChamadas,
        observacoes: str | None = None,
    ) -> TriagemIMESC:
        """Conclui triagem e finaliza chamada ativa."""
        agora = datetime.now(UTC)

        # Busca ou cria triagem
        triagem = self._db.execute(
            select(TriagemIMESC).where(TriagemIMESC.agendamento_id == agendamento_id)
        ).scalar_one_or_none()

        if triagem:
            if triagem.triagem_concluida:
                raise ValueError("Triagem já concluída")

            triagem.triagem_concluida = True
            triagem.triagem_em = agora
            triagem.realizada_por_id = usuario.id
            if observacoes:
                triagem.observacoes = observacoes
        else:
            # Valida agendamento existe
            ag = self._db.execute(
                text("SELECT id FROM agendamentos WHERE id = :id"),
                {"id": agendamento_id},
            ).first()

            if not ag:
                raise ValueError(f"Agendamento {agendamento_id} não encontrado")

            triagem = TriagemIMESC(
                agendamento_id=agendamento_id,
                triagem_concluida=True,
                triagem_em=agora,
                realizada_por_id=usuario.id,
                observacoes=observacoes,
            )
            self._db.add(triagem)

        # Finaliza chamada de triagem se existir
        chamada = self._db.execute(
            select(Chamada).where(
                Chamada.agendamento_id == agendamento_id,
                Chamada.tipo == TipoChamada.TRIAGEM,
                Chamada.status.in_((StatusChamada.CHAMANDO, StatusChamada.ATENDENDO)),
            )
        ).scalar_one_or_none()

        if chamada:
            chamada.status = StatusChamada.FINALIZADO
            chamada.finalizado_em = agora

        self._db.commit()
        self._db.refresh(triagem)

        invalidate_triagem()
        logger.info("TRIAGEM_OK | ag={} | user={}", agendamento_id, usuario.id)

        return triagem

    def verificar_triagem(self, agendamento_id: int) -> bool:
        """Verifica se triagem foi concluída."""
        result = self._db.execute(
            select(TriagemIMESC.id).where(
                TriagemIMESC.agendamento_id == agendamento_id,
                TriagemIMESC.triagem_concluida.is_(True),
            )
        ).scalar_one_or_none()

        return result is not None

    def listar_pendentes(self) -> list[dict]:
        """Lista IMESC pendentes de triagem (cached)."""
        hoje = date.today().isoformat()
        cache_key = CacheKeys.TRIAGEM_PENDENTES.format(dia=hoje)

        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        query = text(
            """
            SELECT
                a.id,
                a.nome_paciente,
                a.cpf_paciente,
                a.hora,
                a.procedimento,
                a.status,
                t.id as triagem_id,
                COALESCE(t.triagem_concluida, FALSE) as triagem_concluida,
                c.id as chamada_id,
                c.status as chamada_status
            FROM agendamentos a
            LEFT JOIN triagem_imesc t ON t.agendamento_id = a.id
            LEFT JOIN chamadas c ON c.agendamento_id = a.id
                AND c.status IN ('CHAMANDO', 'ATENDENDO')
            WHERE a.dia = CURRENT_DATE
              AND a.procedimento ILIKE '%%imesc%%'
              AND a.status IN ('AGENDADO', 'CONFIRMADO')
              AND (t.id IS NULL OR t.triagem_concluida = FALSE)
            ORDER BY a.hora
        """
        )

        result = self._db.execute(query)
        data = [
            {
                "id": row.id,
                "nome_paciente": row.nome_paciente,
                "cpf_paciente": row.cpf_paciente,
                "hora": row.hora.isoformat() if row.hora else None,
                "procedimento": row.procedimento,
                "status": row.status,
                "triagem_id": row.triagem_id,
                "triagem_iniciada": row.triagem_id is not None,
                "triagem_concluida": row.triagem_concluida,
                "chamada_id": row.chamada_id,
                "chamada_status": row.chamada_status,
            }
            for row in result
        ]

        cache_set(cache_key, data, CacheTTL.TRIAGEM)
        return data

    def listar_concluidas_hoje(self) -> list[dict]:
        """Lista triagens concluídas hoje."""
        query = text(
            """
            SELECT
                t.id,
                t.agendamento_id,
                t.triagem_em,
                t.observacoes,
                a.nome_paciente,
                a.procedimento,
                u.nome as realizada_por
            FROM triagem_imesc t
            JOIN agendamentos a ON a.id = t.agendamento_id
            LEFT JOIN usuarios_chamadas u ON u.id = t.realizada_por_id
            WHERE t.triagem_concluida = TRUE
              AND t.triagem_em::DATE = CURRENT_DATE
            ORDER BY t.triagem_em DESC
        """
        )

        result = self._db.execute(query)
        return [
            {
                "id": row.id,
                "agendamento_id": row.agendamento_id,
                "nome_paciente": row.nome_paciente,
                "procedimento": row.procedimento,
                "triagem_em": row.triagem_em.isoformat() if row.triagem_em else None,
                "realizada_por": row.realizada_por,
                "observacoes": row.observacoes,
            }
            for row in result
        ]
