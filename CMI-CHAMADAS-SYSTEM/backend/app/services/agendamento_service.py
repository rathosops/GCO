"""
Serviço de agendamentos otimizado com cache Redis.

Queries otimizadas com:
- Cache de resultados frequentes
- Projeção específica (sem SELECT *)
- Índices utilizados
"""

from datetime import date

from loguru import logger
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.cache import (
    CacheKeys,
    CacheTTL,
    cache_get,
    cache_set,
)


class AgendamentoService:
    """Serviço otimizado para consulta de agendamentos."""

    # Query base otimizada - apenas campos necessários
    _BASE_QUERY = """
        SELECT
            a.id,
            a.dia,
            a.hora,
            a.cpf_paciente,
            a.nome_paciente,
            a.procedimento,
            a.numero_de_contato,
            a.status,
            a.observacoes,
            a.paciente_compareceu,
            (a.procedimento ILIKE '%%imesc%%') as is_imesc,
            t.id as triagem_id,
            COALESCE(t.triagem_concluida, FALSE) as triagem_concluida,
            c.id as chamada_ativa_id,
            c.status as chamada_status
        FROM agendamentos a
        LEFT JOIN triagem_imesc t ON t.agendamento_id = a.id
        LEFT JOIN chamadas c ON c.agendamento_id = a.id
            AND c.status IN ('CHAMANDO', 'ATENDENDO')
    """

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_hoje(self) -> list[dict]:
        """Lista agendamentos de hoje com cache."""
        hoje = date.today().isoformat()
        cache_key = CacheKeys.AGENDAMENTOS_HOJE.format(dia=hoje)

        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        query = text(f"""
            {self._BASE_QUERY}
            WHERE a.dia = CURRENT_DATE
            ORDER BY a.hora
        """)

        result = self._db.execute(query)
        data = [self._row_to_dict(row) for row in result]

        cache_set(cache_key, data, CacheTTL.AGENDAMENTOS)
        logger.debug("AGENDAMENTOS_HOJE | count={}", len(data))

        return data

    def get_aguardando(self) -> list[dict]:
        """Lista pacientes aguardando chamada com cache."""
        hoje = date.today().isoformat()
        cache_key = CacheKeys.AGENDAMENTOS_AGUARDANDO.format(dia=hoje)

        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        query = text(f"""
            {self._BASE_QUERY}
            WHERE a.dia = CURRENT_DATE
              AND a.status IN ('AGENDADO', 'CONFIRMADO')
              AND a.paciente_compareceu IS NULL
              AND c.id IS NULL
            ORDER BY a.hora
        """)

        result = self._db.execute(query)
        data = []

        for row in result:
            item = self._row_to_dict(row)
            is_imesc = item.get("is_imesc", False)
            triagem_ok = item.get("triagem_concluida", False)
            item["pode_chamar"] = triagem_ok if is_imesc else True
            data.append(item)

        cache_set(cache_key, data, CacheTTL.AGENDAMENTOS)
        logger.debug("AGENDAMENTOS_AGUARDANDO | count={}", len(data))

        return data

    def get_confirmados(self) -> list[dict]:
        """Lista pacientes confirmados com cache."""
        hoje = date.today().isoformat()
        cache_key = CacheKeys.AGENDAMENTOS_CONFIRMADOS.format(dia=hoje)

        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        query = text(f"""
            SELECT
                a.id,
                a.hora,
                a.nome_paciente,
                a.procedimento,
                a.cpf_paciente,
                a.numero_de_contato,
                (a.procedimento ILIKE '%%imesc%%') as is_imesc,
                t.triagem_concluida,
                c.id as chamada_ativa_id,
                c.status as chamada_status
            FROM agendamentos a
            LEFT JOIN triagem_imesc t ON t.agendamento_id = a.id
            LEFT JOIN chamadas c ON c.agendamento_id = a.id
                AND c.status IN ('CHAMANDO', 'ATENDENDO')
            WHERE a.dia = CURRENT_DATE
              AND a.status = 'CONFIRMADO'
            ORDER BY a.hora
        """)

        result = self._db.execute(query)
        data = [
            {
                "id": row.id,
                "hora": row.hora.isoformat() if row.hora else None,
                "nome_paciente": row.nome_paciente,
                "procedimento": row.procedimento,
                "cpf_paciente": row.cpf_paciente,
                "numero_de_contato": row.numero_de_contato,
                "is_imesc": row.is_imesc,
                "triagem_concluida": row.triagem_concluida,
                "chamada_ativa_id": row.chamada_ativa_id,
                "chamada_status": row.chamada_status,
            }
            for row in result
        ]

        cache_set(cache_key, data, CacheTTL.AGENDAMENTOS)
        logger.debug("AGENDAMENTOS_CONFIRMADOS | count={}", len(data))

        return data

    def get_by_id(self, agendamento_id: int) -> dict | None:
        """Busca agendamento por ID (sem cache - usado pontualmente)."""
        query = text("""
            SELECT
                a.*,
                (a.procedimento ILIKE '%%imesc%%') as is_imesc,
                t.id as triagem_id,
                t.triagem_concluida
            FROM agendamentos a
            LEFT JOIN triagem_imesc t ON t.agendamento_id = a.id
            WHERE a.id = :id
        """)

        result = self._db.execute(query, {"id": agendamento_id}).mappings().first()
        return dict(result) if result else None

    @staticmethod
    def _row_to_dict(row) -> dict:
        """Converte row para dict de forma eficiente."""
        return {
            "id": row.id,
            "dia": row.dia.isoformat() if row.dia else None,
            "hora": row.hora.isoformat() if row.hora else None,
            "cpf_paciente": row.cpf_paciente,
            "nome_paciente": row.nome_paciente,
            "procedimento": row.procedimento,
            "numero_de_contato": row.numero_de_contato,
            "status": row.status,
            "observacoes": row.observacoes,
            "paciente_compareceu": row.paciente_compareceu,
            "is_imesc": row.is_imesc,
            "triagem_id": row.triagem_id,
            "triagem_concluida": row.triagem_concluida,
            "chamada_ativa_id": row.chamada_ativa_id,
            "chamada_status": row.chamada_status,
        }
