"""
Tasks assíncronas de relatórios.

Regra:
- Tasks não devem importar controllers.
- Preferir SQL direto/SQLAlchemy Core para performance e simplicidade.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import pandas as pd
from celery.utils.log import get_task_logger

from app.celery_app import celery
from app.database import db

logger = get_task_logger(__name__)


@dataclass(frozen=True)
class ExportResult:
    """Resultado padronizado de exportação."""

    filename: str
    path: str
    rows: int

    def to_dict(self) -> dict:
        return {"file": self.filename, "path": self.path, "rows": self.rows}


@celery.task(bind=True)
def export_faturamento_csv(self, data_inicio: str, data_fim: str) -> dict:
    """
    Exporta faturamento diário para CSV via pandas.

    Args:
        data_inicio: YYYY-MM-DD
        data_fim: YYYY-MM-DD

    Returns:
        dict com metadados do arquivo gerado.
    """
    logger.info("Gerando export faturamento CSV: %s -> %s", data_inicio, data_fim)

    query = """
        SELECT
            data::date AS dia,
            COALESCE(SUM(valor), 0) AS total
        FROM pagamentos
        WHERE data >= :data_inicio AND data <= :data_fim
        GROUP BY 1
        ORDER BY 1;
    """

    df = pd.read_sql_query(
        query,
        con=db.engine,
        params={"data_inicio": data_inicio, "data_fim": data_fim},
    )

    os.makedirs("/app/reports", exist_ok=True)
    filename = f"faturamento_{data_inicio}_a_{data_fim}.csv"
    path = f"/app/reports/{filename}"
    df.to_csv(path, index=False)

    logger.info("Export concluído: %s (rows=%s)", filename, int(df.shape[0]))
    return ExportResult(filename=filename, path=path, rows=int(df.shape[0])).to_dict()
