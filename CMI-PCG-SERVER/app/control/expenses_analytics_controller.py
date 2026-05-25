# app/control/expenses_analytics_controller.py
"""
Controller para Analytics de Despesas.

Endpoints de KPIs, tendências, comparativos e DRE simplificado
para observabilidade financeira completa (receitas vs despesas).

Importante: todas as somas de despesa usam `valor_efetivo` (Despesas.valor_efetivo_sql()):
- PAGA com valor_pago → valor_pago (real)
- Caso contrário → valor + juros − desconto (estimativa)
Isso garante que valores cobertos por juros/desconto não distorçam relatórios.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func

from app.database import db
from app.models.expenses_model import Despesas
from app.models.payments_model import Pagamentos

expenses_analytics_bp = Blueprint(
    "expenses_analytics", __name__, url_prefix="/despesas/analytics"
)

DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y")


# =============================================================================
# Helpers
# =============================================================================


def _parse_date(value: Any) -> date | None:
    """Converte string para date."""
    if not value:
        return None
    if isinstance(value, date):
        return value
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_int(value: Any, default: int | None = None) -> int | None:
    """Converte para int com fallback."""
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _get_date_range(args) -> tuple[date | None, date | None]:
    """Extrai data_inicio e data_fim dos args."""
    return _parse_date(args.get("data_inicio")), _parse_date(args.get("data_fim"))


def _variation(current: float, previous: float) -> float | None:
    """Calcula variação percentual."""
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 2)


def _ve():
    """Atalho para a expressão SQL de valor efetivo."""
    return Despesas.valor_efetivo_sql()


# =============================================================================
# Endpoint: Resumo Geral de Despesas (KPIs)
# =============================================================================
@expenses_analytics_bp.route("/summary", methods=["GET"])
def get_expenses_summary():
    """
    KPIs principais de despesas no período.

    Query params:
    - data_inicio, data_fim (obrigatórios, baseados em data_competencia)
    - comparar_periodo_anterior (bool, default: true)

    Response:
    - total, total_pago, total_pendente, total_atrasado
    - quantidade, ticket_medio
    - variação vs período anterior
    """
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        ve = _ve()
        base_filter = (
            Despesas.data_competencia.between(data_inicio, data_fim),
            Despesas.status != "CANCELADA",
        )

        total = float(
            db.session.query(func.coalesce(func.sum(ve), 0))
            .filter(*base_filter)
            .scalar()
            or 0
        )

        total_pago = float(
            db.session.query(func.coalesce(func.sum(ve), 0))
            .filter(
                Despesas.data_competencia.between(data_inicio, data_fim),
                Despesas.status == "PAGA",
            )
            .scalar()
            or 0
        )

        total_pendente = float(
            db.session.query(func.coalesce(func.sum(ve), 0))
            .filter(
                Despesas.data_competencia.between(data_inicio, data_fim),
                Despesas.status == "PENDENTE",
            )
            .scalar()
            or 0
        )

        total_atrasado = float(
            db.session.query(func.coalesce(func.sum(ve), 0))
            .filter(
                Despesas.data_competencia.between(data_inicio, data_fim),
                Despesas.status == "ATRASADA",
            )
            .scalar()
            or 0
        )

        quantidade = (
            db.session.query(func.count(Despesas.id)).filter(*base_filter).scalar() or 0
        )
        ticket_medio = total / quantidade if quantidade > 0 else 0

        # Comparativo
        comparar = request.args.get("comparar_periodo_anterior", "true").lower()
        comparar = comparar in ("true", "1", "sim")

        variacao = None
        periodo_anterior = None
        if comparar:
            delta = (data_fim - data_inicio).days + 1
            prev_fim = data_inicio - timedelta(days=1)
            prev_inicio = prev_fim - timedelta(days=delta - 1)

            prev_total = float(
                db.session.query(func.coalesce(func.sum(ve), 0))
                .filter(
                    Despesas.data_competencia.between(prev_inicio, prev_fim),
                    Despesas.status != "CANCELADA",
                )
                .scalar()
                or 0
            )

            periodo_anterior = {
                "data_inicio": prev_inicio.isoformat(),
                "data_fim": prev_fim.isoformat(),
                "total": prev_total,
            }
            variacao = _variation(total, prev_total)

        return jsonify(
            {
                "periodo": {
                    "data_inicio": data_inicio.isoformat(),
                    "data_fim": data_fim.isoformat(),
                },
                "kpis": {
                    "total": total,
                    "total_pago": total_pago,
                    "total_pendente": total_pendente,
                    "total_atrasado": total_atrasado,
                    "quantidade": quantidade,
                    "ticket_medio": round(ticket_medio, 2),
                },
                "comparativo": (
                    {
                        "periodo_anterior": periodo_anterior,
                        "variacao_percentual": variacao,
                    }
                    if comparar
                    else None
                ),
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[DespesasAnalytics] Erro em summary: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao gerar resumo de despesas"}), 500


# =============================================================================
# Endpoint: Despesas por Categoria
# =============================================================================
@expenses_analytics_bp.route("/by-category", methods=["GET"])
def get_expenses_by_category():
    """Agrupa despesas por categoria com percentuais (usa valor_efetivo)."""
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        agrupar = (request.args.get("agrupar_por") or "categoria").lower()

        col_map = {
            "categoria": Despesas.categoria,
            "tipo_custo": Despesas.tipo_custo,
            "centro_custo": Despesas.centro_custo,
            "forma_pagamento": Despesas.forma_pagamento,
        }
        col = col_map.get(agrupar, Despesas.categoria)

        ve = _ve()

        resultados = (
            db.session.query(
                col.label("grupo"),
                func.sum(ve).label("total"),
                func.count(Despesas.id).label("quantidade"),
            )
            .filter(
                Despesas.data_competencia.between(data_inicio, data_fim),
                Despesas.status != "CANCELADA",
            )
            .group_by(col)
            .order_by(func.sum(ve).desc())
            .all()
        )

        total_geral = sum(float(r.total or 0) for r in resultados)

        dados = [
            {
                "grupo": r.grupo or "N/A",
                "total": float(r.total or 0),
                "quantidade": r.quantidade,
                "percentual": (
                    round(float(r.total or 0) / total_geral * 100, 2)
                    if total_geral > 0
                    else 0
                ),
            }
            for r in resultados
        ]

        return jsonify(
            {
                "agrupado_por": agrupar,
                "total_geral": total_geral,
                "dados": dados,
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[DespesasAnalytics] Erro em by-category: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao agrupar despesas"}), 500


# =============================================================================
# Endpoint: Tendências de Despesas
# =============================================================================
@expenses_analytics_bp.route("/trends", methods=["GET"])
def get_expenses_trends():
    """Evolução mensal de despesas (usa valor_efetivo)."""
    try:
        meses = _parse_int(request.args.get("meses"), 6)
        meses = min(max(meses, 1), 24)

        ve = _ve()
        hoje = date.today()
        dados = []

        for i in range(meses - 1, -1, -1):
            if i == 0:
                primeiro_dia = hoje.replace(day=1)
                ultimo_dia = hoje
            else:
                ref = hoje.replace(day=1) - timedelta(days=1)
                for _ in range(i - 1):
                    ref = ref.replace(day=1) - timedelta(days=1)
                primeiro_dia = ref.replace(day=1)
                if ref.month == 12:
                    ultimo_dia = ref.replace(day=31)
                else:
                    ultimo_dia = ref.replace(month=ref.month + 1, day=1) - timedelta(
                        days=1
                    )

            total = float(
                db.session.query(func.coalesce(func.sum(ve), 0))
                .filter(
                    Despesas.data_competencia.between(primeiro_dia, ultimo_dia),
                    Despesas.status != "CANCELADA",
                )
                .scalar()
                or 0
            )

            quantidade = (
                db.session.query(func.count(Despesas.id))
                .filter(
                    Despesas.data_competencia.between(primeiro_dia, ultimo_dia),
                    Despesas.status != "CANCELADA",
                )
                .scalar()
                or 0
            )

            dados.append(
                {
                    "mes": primeiro_dia.strftime("%Y-%m"),
                    "mes_nome": primeiro_dia.strftime("%b/%Y"),
                    "total": total,
                    "quantidade": quantidade,
                    "ticket_medio": (
                        round(total / quantidade, 2) if quantidade > 0 else 0
                    ),
                }
            )

        # Tendência média
        tendencia = 0.0
        if len(dados) >= 2:
            variacoes = []
            for i in range(1, len(dados)):
                if dados[i - 1]["total"] > 0:
                    var = (
                        (dados[i]["total"] - dados[i - 1]["total"])
                        / dados[i - 1]["total"]
                    ) * 100
                    variacoes.append(var)
            tendencia = sum(variacoes) / len(variacoes) if variacoes else 0

        return jsonify(
            {
                "meses_analisados": meses,
                "tendencia_media_percentual": round(tendencia, 2),
                "dados": dados,
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[DespesasAnalytics] Erro em trends: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao calcular tendências"}), 500


# =============================================================================
# Endpoint: Top Fornecedores
# =============================================================================
@expenses_analytics_bp.route("/top-suppliers", methods=["GET"])
def get_top_suppliers():
    """Ranking de fornecedores (usa valor_efetivo)."""
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        limite = _parse_int(request.args.get("limite"), 10)
        ve = _ve()

        resultados = (
            db.session.query(
                func.coalesce(Despesas.fornecedor_nome, "Sem fornecedor").label("nome"),
                Despesas.fornecedor_id,
                func.sum(ve).label("total"),
                func.count(Despesas.id).label("quantidade"),
            )
            .filter(
                Despesas.data_competencia.between(data_inicio, data_fim),
                Despesas.status != "CANCELADA",
            )
            .group_by(Despesas.fornecedor_nome, Despesas.fornecedor_id)
            .order_by(func.sum(ve).desc())
            .limit(limite)
            .all()
        )

        return jsonify(
            {
                "limite": limite,
                "dados": [
                    {
                        "posicao": i,
                        "fornecedor_nome": r.nome,
                        "fornecedor_id": r.fornecedor_id,
                        "total": float(r.total or 0),
                        "quantidade": r.quantidade,
                    }
                    for i, r in enumerate(resultados, 1)
                ],
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[DespesasAnalytics] Erro em top-suppliers: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar top fornecedores"}), 500


# =============================================================================
# Endpoint: DRE Simplificado (Receitas x Despesas)
# =============================================================================
@expenses_analytics_bp.route("/dre", methods=["GET"])
def get_dre_simplificado():
    """DRE simplificado (despesas usam valor_efetivo)."""
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        # Receitas
        receita_bruta = float(
            db.session.query(func.coalesce(func.sum(Pagamentos.valor), 0))
            .filter(Pagamentos.data.between(data_inicio, data_fim))
            .scalar()
            or 0
        )

        descontos_receita = float(
            db.session.query(
                func.coalesce(func.sum(func.coalesce(Pagamentos.valor_desconto, 0)), 0)
            )
            .filter(Pagamentos.data.between(data_inicio, data_fim))
            .scalar()
            or 0
        )

        receita_liquida = receita_bruta - descontos_receita

        # Despesas
        ve = _ve()
        base_filters = (
            Despesas.data_competencia.between(data_inicio, data_fim),
            Despesas.status != "CANCELADA",
        )

        despesa_total = float(
            db.session.query(func.coalesce(func.sum(ve), 0))
            .filter(*base_filters)
            .scalar()
            or 0
        )

        despesa_fixa = float(
            db.session.query(func.coalesce(func.sum(ve), 0))
            .filter(*base_filters, Despesas.tipo_custo == "FIXO")
            .scalar()
            or 0
        )

        despesa_variavel = float(
            db.session.query(func.coalesce(func.sum(ve), 0))
            .filter(*base_filters, Despesas.tipo_custo == "VARIAVEL")
            .scalar()
            or 0
        )

        # Resultado
        resultado = receita_liquida - despesa_total
        margem = (
            round(resultado / receita_liquida * 100, 2) if receita_liquida > 0 else 0
        )

        # Por categoria
        por_categoria = (
            db.session.query(
                Despesas.categoria,
                func.sum(ve).label("total"),
            )
            .filter(*base_filters)
            .group_by(Despesas.categoria)
            .order_by(func.sum(ve).desc())
            .all()
        )

        return jsonify(
            {
                "periodo": {
                    "data_inicio": data_inicio.isoformat(),
                    "data_fim": data_fim.isoformat(),
                },
                "receitas": {
                    "bruta": receita_bruta,
                    "descontos": descontos_receita,
                    "liquida": receita_liquida,
                },
                "despesas": {
                    "total": despesa_total,
                    "fixa": despesa_fixa,
                    "variavel": despesa_variavel,
                    "por_categoria": [
                        {
                            "categoria": c.categoria,
                            "total": float(c.total or 0),
                            "percentual": (
                                round(float(c.total or 0) / despesa_total * 100, 2)
                                if despesa_total > 0
                                else 0
                            ),
                        }
                        for c in por_categoria
                    ],
                },
                "resultado": {
                    "operacional": resultado,
                    "margem_operacional_pct": margem,
                },
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[DespesasAnalytics] Erro em DRE: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao gerar DRE"}), 500


# =============================================================================
# Endpoint: Contas a Pagar (vencimentos futuros)
# =============================================================================
@expenses_analytics_bp.route("/upcoming", methods=["GET"])
def get_upcoming_expenses():
    """Despesas com vencimento próximo. Totais usam valor_liquido (estimativa)."""
    try:
        from app.utils.timezone import get_today_sao_paulo

        dias = _parse_int(request.args.get("dias"), 30)
        dias = min(max(dias, 1), 90)
        incluir_atrasadas = request.args.get("incluir_atrasadas", "true").lower() in (
            "true",
            "1",
        )

        hoje = get_today_sao_paulo()
        limite = hoje + timedelta(days=dias)

        # Próximas a vencer
        proximas = (
            Despesas.query.filter(
                Despesas.data_vencimento.between(hoje, limite),
                Despesas.status.in_(["PENDENTE", "PARCIAL"]),
            )
            .order_by(Despesas.data_vencimento.asc())
            .all()
        )

        total_proximo = sum(d.valor_liquido for d in proximas)

        # Atrasadas
        atrasadas = []
        total_atrasado = 0.0
        if incluir_atrasadas:
            atrasadas = (
                Despesas.query.filter(
                    Despesas.data_vencimento < hoje,
                    Despesas.status.in_(["PENDENTE", "ATRASADA"]),
                )
                .order_by(Despesas.data_vencimento.asc())
                .all()
            )
            total_atrasado = sum(d.valor_liquido for d in atrasadas)

        return jsonify(
            {
                "hoje": hoje.isoformat(),
                "janela_dias": dias,
                "total_proximo": total_proximo,
                "total_atrasado": total_atrasado,
                "total_geral": total_proximo + total_atrasado,
                "quantidade_proximas": len(proximas),
                "quantidade_atrasadas": len(atrasadas),
                "atrasadas": [d.to_dict() for d in atrasadas],
                "proximas": [d.to_dict() for d in proximas],
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[DespesasAnalytics] Erro em upcoming: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar contas a pagar"}), 500
