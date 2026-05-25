"""
Serviço de chamadas otimizado.

Melhorias:
- Cache Redis para painel (TTL curto + invalidação)
- Queries com projeção mínima
- Batch operations quando possível
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
    invalidate_chamadas,
)
from app.models.chamada import Chamada, StatusChamada, TipoChamada
from app.models.triagem import TriagemIMESC
from app.models.usuario import UsuarioChamadas


class ChamadaService:
    """Serviço otimizado para chamadas de pacientes."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def criar_chamada(
        self,
        agendamento_id: int,
        sala: str,
        tipo: TipoChamada,
        usuario: UsuarioChamadas,
        observacoes: str | None = None,
    ) -> Chamada:
        """Cria nova chamada com invalidação de cache."""
        # Validação: agendamento existe
        ag = self._get_agendamento_basico(agendamento_id)
        if not ag:
            raise ValueError(f"Agendamento {agendamento_id} não encontrado")

        # Validação: IMESC precisa triagem
        if tipo == TipoChamada.MEDICO and ag.get("is_imesc"):
            if not self._triagem_ok(agendamento_id):
                raise ValueError("Paciente IMESC precisa passar pela triagem")

        # Validação: sem chamada ativa do mesmo tipo
        if self._tem_chamada_ativa(agendamento_id, tipo):
            raise ValueError("Já existe chamada ativa para este agendamento")

        chamada = Chamada(
            agendamento_id=agendamento_id,
            sala=sala,
            tipo=tipo,
            chamado_por_id=usuario.id,
            chamado_por_nome=usuario.nome,
            status=StatusChamada.CHAMANDO,
            observacoes=observacoes,
        )

        self._db.add(chamada)
        self._db.commit()
        self._db.refresh(chamada)

        invalidate_chamadas()
        logger.info(
            "CHAMADA_CRIADA | id={} | ag={} | tipo={}", chamada.id, agendamento_id, tipo
        )

        return chamada

    def iniciar_atendimento(self, chamada_id: int) -> Chamada:
        """Marca como em atendimento."""
        chamada = self._get_chamada(chamada_id)

        if chamada.status != StatusChamada.CHAMANDO:
            raise ValueError(f"Status inválido: {chamada.status}")

        chamada.status = StatusChamada.ATENDENDO
        chamada.atendido_em = datetime.now(UTC)

        self._db.commit()
        self._db.refresh(chamada)

        invalidate_chamadas()
        return chamada

    def finalizar_atendimento(
        self,
        chamada_id: int,
        paciente_compareceu: bool = True,
        observacoes: str | None = None,
    ) -> Chamada:
        """
        Finaliza atendimento.

        IMPORTANTE: Só atualiza paciente_compareceu/status do agendamento
        se for chamada de MÉDICO. Triagem não marca comparecimento final.
        """
        chamada = self._get_chamada(chamada_id)

        if chamada.status not in (StatusChamada.CHAMANDO, StatusChamada.ATENDENDO):
            raise ValueError(f"Não pode finalizar: {chamada.status}")

        chamada.status = (
            StatusChamada.FINALIZADO
            if paciente_compareceu
            else StatusChamada.NAO_COMPARECEU
        )
        chamada.finalizado_em = datetime.now(UTC)

        if observacoes:
            chamada.observacoes = observacoes

        # CORREÇÃO: Só atualiza comparecimento do agendamento se for chamada de MÉDICO
        # Triagem não marca comparecimento - paciente ainda precisa passar pelo médico
        if chamada.tipo == TipoChamada.MEDICO:
            self._atualizar_comparecimento(chamada.agendamento_id, paciente_compareceu)

        self._db.commit()
        self._db.refresh(chamada)

        invalidate_chamadas()
        logger.info(
            "CHAMADA_FINALIZADA | id={} | tipo={} | compareceu={}",
            chamada_id,
            chamada.tipo,
            paciente_compareceu,
        )

        return chamada

    def cancelar_chamada(self, chamada_id: int) -> Chamada:
        """Cancela chamada."""
        chamada = self._get_chamada(chamada_id)

        if chamada.status not in (StatusChamada.CHAMANDO, StatusChamada.ATENDENDO):
            raise ValueError(f"Não pode cancelar: {chamada.status}")

        chamada.status = StatusChamada.CANCELADO
        chamada.finalizado_em = datetime.now(UTC)

        self._db.commit()
        self._db.refresh(chamada)

        invalidate_chamadas()
        return chamada

    def resetar_chamadas_ativas(self) -> int:
        """Reseta todas chamadas ativas."""
        result = self._db.execute(
            text(
                """
                UPDATE chamadas
                SET status = 'CANCELADO',
                    finalizado_em = NOW(),
                    observacoes = COALESCE(observacoes, '') || ' | Reset sistema'
                WHERE status IN ('CHAMANDO', 'ATENDENDO')
                RETURNING id
            """
            )
        )

        count = len(result.fetchall())
        self._db.commit()

        if count:
            invalidate_chamadas()
            logger.info("CHAMADAS_RESET | count={}", count)

        return count

    def listar_chamadas_painel(self, limite: int = 5) -> list[dict]:
        """Lista chamadas ativas para painel com cache."""
        cache_key = CacheKeys.CHAMADAS_PAINEL

        cached = cache_get(cache_key)
        if cached is not None:
            return cached[:limite]

        # Query otimizada - apenas campos do painel
        query = text(
            """
            SELECT
                c.id,
                c.agendamento_id,
                c.sala,
                c.tipo,
                c.chamado_por_nome,
                c.status,
                c.chamado_em,
                a.nome_paciente
            FROM chamadas c
            JOIN agendamentos a ON a.id = c.agendamento_id
            WHERE c.status IN ('CHAMANDO', 'ATENDENDO')
            ORDER BY c.chamado_em DESC
            LIMIT :limite
        """
        )

        result = self._db.execute(query, {"limite": limite})
        data = [
            {
                "id": row.id,
                "agendamento_id": row.agendamento_id,
                "nome_paciente": row.nome_paciente,
                "sala": row.sala,
                "tipo": row.tipo,
                "chamado_por_nome": row.chamado_por_nome,
                "status": row.status,
                "chamado_em": row.chamado_em.isoformat() if row.chamado_em else None,
            }
            for row in result
        ]

        cache_set(cache_key, data, CacheTTL.CHAMADAS_PAINEL)
        return data

    def listar_historico_hoje(self, limite: int = 20) -> list[dict]:
        """Histórico de hoje com cache."""
        hoje = date.today().isoformat()
        cache_key = CacheKeys.CHAMADAS_HISTORICO.format(dia=hoje)

        cached = cache_get(cache_key)
        if cached is not None:
            return cached[:limite]

        query = text(
            """
            SELECT
                c.id,
                c.agendamento_id,
                c.sala,
                c.tipo,
                c.chamado_por_nome,
                c.status,
                c.chamado_em,
                c.atendido_em,
                c.finalizado_em,
                a.nome_paciente
            FROM chamadas c
            JOIN agendamentos a ON a.id = c.agendamento_id
            WHERE c.status IN ('FINALIZADO', 'NAO_COMPARECEU', 'CANCELADO')
              AND c.chamado_em::DATE = CURRENT_DATE
            ORDER BY c.finalizado_em DESC
            LIMIT :limite
        """
        )

        result = self._db.execute(query, {"limite": limite})
        data = [
            {
                "id": row.id,
                "agendamento_id": row.agendamento_id,
                "nome_paciente": row.nome_paciente,
                "sala": row.sala,
                "tipo": row.tipo,
                "chamado_por_nome": row.chamado_por_nome,
                "status": row.status,
                "chamado_em": row.chamado_em.isoformat() if row.chamado_em else None,
                "atendido_em": row.atendido_em.isoformat() if row.atendido_em else None,
                "finalizado_em": (
                    row.finalizado_em.isoformat() if row.finalizado_em else None
                ),
            }
            for row in result
        ]

        cache_set(cache_key, data, CacheTTL.CHAMADAS_HISTORICO)
        return data

    def listar_historico(self, limite: int = 100) -> list[Chamada]:
        """Histórico geral (sem cache - admin)."""
        return list(
            self._db.execute(
                select(Chamada).order_by(Chamada.chamado_em.desc()).limit(limite)
            )
            .scalars()
            .all()
        )

    # === Helpers privados ===

    def _get_chamada(self, chamada_id: int) -> Chamada:
        chamada = self._db.get(Chamada, chamada_id)
        if not chamada:
            raise ValueError(f"Chamada {chamada_id} não encontrada")
        return chamada

    def _get_agendamento_basico(self, agendamento_id: int) -> dict | None:
        """Busca mínima - apenas o necessário para validação."""
        result = self._db.execute(
            text(
                """
                SELECT id, procedimento, (procedimento ILIKE '%%imesc%%') as is_imesc
                FROM agendamentos WHERE id = :id
            """
            ),
            {"id": agendamento_id},
        ).first()

        if not result:
            return None

        return {
            "id": result.id,
            "procedimento": result.procedimento,
            "is_imesc": result.is_imesc,
        }

    def _triagem_ok(self, agendamento_id: int) -> bool:
        return (
            self._db.execute(
                select(TriagemIMESC).where(
                    TriagemIMESC.agendamento_id == agendamento_id,
                    TriagemIMESC.triagem_concluida.is_(True),
                )
            ).scalar_one_or_none()
            is not None
        )

    def _tem_chamada_ativa(
        self, agendamento_id: int, tipo: TipoChamada | None = None
    ) -> bool:
        """
        Verifica se há chamada ativa.

        Se tipo for especificado, verifica apenas chamadas daquele tipo.
        """
        query = select(Chamada.id).where(
            Chamada.agendamento_id == agendamento_id,
            Chamada.status.in_((StatusChamada.CHAMANDO, StatusChamada.ATENDENDO)),
        )

        if tipo:
            query = query.where(Chamada.tipo == tipo)

        return self._db.execute(query).scalar_one_or_none() is not None

    def _atualizar_comparecimento(self, agendamento_id: int, compareceu: bool) -> None:
        """Atualiza status de comparecimento do agendamento (só para MÉDICO)."""
        status = "REALIZADO" if compareceu else "FALTOU"
        self._db.execute(
            text(
                """
                UPDATE agendamentos
                SET paciente_compareceu = :compareceu, status = :status
                WHERE id = :id
            """
            ),
            {"id": agendamento_id, "compareceu": compareceu, "status": status},
        )
