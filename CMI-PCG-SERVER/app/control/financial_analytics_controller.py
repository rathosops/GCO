"""
Controller para Analytics Financeiro Avançado.

Endpoints de busca avançada, KPIs, agregações e análises para
observabilidade financeira detalhada.

Princípios:
- DRY: Funções auxiliares reutilizáveis
- KISS: Endpoints focados e claros
- SRP: Cada endpoint com responsabilidade única
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import and_, case, cast, desc, extract, func, or_
from sqlalchemy.types import Date as SADate

from app.database import db
from app.models.payments_model import Pagamentos
from app.models.patients_model import Pacientes
from app.models.companies_model import Empresas
from app.models.insurances_model import Convenios

financial_analytics_bp = Blueprint(
    "financial_analytics", __name__, url_prefix="/financeiro/analytics"
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


def _parse_float(value: Any) -> float | None:
    """Converte para float."""
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _parse_bool(value: Any) -> bool | None:
    """Converte para bool."""
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        return value
    v = str(value).strip().lower()
    if v in ("true", "1", "sim", "yes"):
        return True
    if v in ("false", "0", "nao", "não", "no"):
        return False
    return None


def _only_digits(value: Any) -> str:
    """Extrai apenas dígitos."""
    return "".join(c for c in str(value or "") if c.isdigit())


def _money_format(value: float) -> str:
    """Formata valor como moeda BR."""
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _get_date_range(args) -> tuple[date | None, date | None]:
    """Extrai data_inicio e data_fim dos args."""
    data_inicio = _parse_date(args.get("data_inicio"))
    data_fim = _parse_date(args.get("data_fim"))
    return data_inicio, data_fim


def _base_query_with_filters(args) -> Any:
    """
    Constrói query base com filtros comuns.

    Filtros suportados:
    - data_inicio, data_fim
    - origem, tipo
    - empresa_id, convenio_id
    - cpf
    - possui_desconto
    - vinculado_nota_fiscal
    - valor_min, valor_max
    """
    query = Pagamentos.query

    data_inicio, data_fim = _get_date_range(args)
    if data_inicio:
        query = query.filter(Pagamentos.data >= data_inicio)
    if data_fim:
        query = query.filter(Pagamentos.data <= data_fim)

    if origem := args.get("origem"):
        query = query.filter(Pagamentos.origem == origem.strip().upper())

    if tipo := args.get("tipo"):
        query = query.filter(Pagamentos.tipo == tipo.strip().upper())

    if empresa_id := _parse_int(args.get("empresa_id")):
        query = query.filter(Pagamentos.empresa_id == empresa_id)

    if convenio_id := _parse_int(args.get("convenio_id")):
        query = query.filter(Pagamentos.convenio_id == convenio_id)

    if cpf := args.get("cpf"):
        cpf_digits = _only_digits(cpf)
        if len(cpf_digits) == 11:
            query = query.filter(Pagamentos.cpf == cpf_digits)

    possui_desconto = _parse_bool(args.get("possui_desconto"))
    if possui_desconto is not None:
        if possui_desconto:
            query = query.filter(
                Pagamentos.valor_desconto.isnot(None), Pagamentos.valor_desconto > 0
            )
        else:
            query = query.filter(
                or_(Pagamentos.valor_desconto.is_(None), Pagamentos.valor_desconto <= 0)
            )

    vinculado_nf = _parse_bool(args.get("vinculado_nota_fiscal"))
    if vinculado_nf is not None:
        query = query.filter(Pagamentos.vinculado_nota_fiscal == vinculado_nf)

    valor_min = _parse_float(args.get("valor_min"))
    valor_max = _parse_float(args.get("valor_max"))
    if valor_min is not None:
        query = query.filter(Pagamentos.valor >= valor_min)
    if valor_max is not None:
        query = query.filter(Pagamentos.valor <= valor_max)

    return query


def _calculate_variation(current: float, previous: float) -> float | None:
    """Calcula variação percentual."""
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 2)


# =============================================================================
# Endpoint: Resumo Geral (KPIs principais)
# =============================================================================
@financial_analytics_bp.route("/summary", methods=["GET"])
def get_analytics_summary():
    """
    Retorna KPIs principais do período.

    Query params:
    - data_inicio, data_fim (obrigatórios)
    - comparar_periodo_anterior (bool, default: true)

    Response:
    - total_bruto, total_descontos, total_liquido
    - quantidade_pagamentos
    - ticket_medio
    - pacientes_unicos, empresas_unicas, convenios_unicos
    - variacao_periodo_anterior (se comparar_periodo_anterior=true)
    """
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        comparar = _parse_bool(request.args.get("comparar_periodo_anterior"))
        if comparar is None:
            comparar = True

        # Query período atual
        base = Pagamentos.query.filter(Pagamentos.data.between(data_inicio, data_fim))

        total_bruto = (
            db.session.query(func.coalesce(func.sum(Pagamentos.valor), 0))
            .filter(Pagamentos.data.between(data_inicio, data_fim))
            .scalar()
            or 0
        )

        total_descontos = (
            db.session.query(
                func.coalesce(func.sum(func.coalesce(Pagamentos.valor_desconto, 0)), 0)
            )
            .filter(Pagamentos.data.between(data_inicio, data_fim))
            .scalar()
            or 0
        )

        total_liquido = float(total_bruto) - float(total_descontos)
        quantidade = base.count()

        ticket_medio = total_liquido / quantidade if quantidade > 0 else 0

        # Contagens únicas
        pacientes_unicos = (
            db.session.query(func.count(func.distinct(Pagamentos.cpf)))
            .filter(
                Pagamentos.data.between(data_inicio, data_fim),
                Pagamentos.cpf.isnot(None),
            )
            .scalar()
            or 0
        )

        empresas_unicas = (
            db.session.query(func.count(func.distinct(Pagamentos.empresa_id)))
            .filter(
                Pagamentos.data.between(data_inicio, data_fim),
                Pagamentos.empresa_id.isnot(None),
            )
            .scalar()
            or 0
        )

        convenios_unicos = (
            db.session.query(func.count(func.distinct(Pagamentos.convenio_id)))
            .filter(
                Pagamentos.data.between(data_inicio, data_fim),
                Pagamentos.convenio_id.isnot(None),
            )
            .scalar()
            or 0
        )

        # Comparativo com período anterior
        variacao = None
        periodo_anterior = None
        if comparar:
            delta = (data_fim - data_inicio).days + 1
            prev_fim = data_inicio - timedelta(days=1)
            prev_inicio = prev_fim - timedelta(days=delta - 1)

            prev_bruto = (
                db.session.query(func.coalesce(func.sum(Pagamentos.valor), 0))
                .filter(Pagamentos.data.between(prev_inicio, prev_fim))
                .scalar()
                or 0
            )

            prev_descontos = (
                db.session.query(
                    func.coalesce(
                        func.sum(func.coalesce(Pagamentos.valor_desconto, 0)), 0
                    )
                )
                .filter(Pagamentos.data.between(prev_inicio, prev_fim))
                .scalar()
                or 0
            )

            prev_liquido = float(prev_bruto) - float(prev_descontos)

            periodo_anterior = {
                "data_inicio": prev_inicio.isoformat(),
                "data_fim": prev_fim.isoformat(),
                "total_liquido": prev_liquido,
            }
            variacao = _calculate_variation(total_liquido, prev_liquido)

        return jsonify(
            {
                "periodo": {
                    "data_inicio": data_inicio.isoformat(),
                    "data_fim": data_fim.isoformat(),
                    "dias": (data_fim - data_inicio).days + 1,
                },
                "kpis": {
                    "total_bruto": float(total_bruto),
                    "total_descontos": float(total_descontos),
                    "total_liquido": total_liquido,
                    "quantidade_pagamentos": quantidade,
                    "ticket_medio": round(ticket_medio, 2),
                    "pacientes_unicos": pacientes_unicos,
                    "empresas_unicas": empresas_unicas,
                    "convenios_unicos": convenios_unicos,
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
        current_app.logger.error("[Analytics] Erro em summary: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao gerar resumo"}), 500


# =============================================================================
# Endpoint: Agrupamento por Período (dia/semana/mês)
# =============================================================================
@financial_analytics_bp.route("/by-period", methods=["GET"])
def get_analytics_by_period():
    """
    Agrupa pagamentos por período (dia, semana, mês, ano).

    Query params:
    - data_inicio, data_fim (obrigatórios)
    - agrupamento: dia|semana|mes|ano (default: dia)
    - origem, tipo (filtros opcionais)

    Response:
    - dados: lista de { periodo, total_bruto, total_descontos, total_liquido, quantidade }
    """
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        agrupamento = (request.args.get("agrupamento") or "dia").lower()

        # Determinar expressão de agrupamento
        if agrupamento == "semana":
            # ISO week
            group_expr = func.date_trunc("week", Pagamentos.data)
            label_format = "semana"
        elif agrupamento == "mes":
            group_expr = func.date_trunc("month", Pagamentos.data)
            label_format = "mes"
        elif agrupamento == "ano":
            group_expr = func.date_trunc("year", Pagamentos.data)
            label_format = "ano"
        else:
            group_expr = Pagamentos.data
            label_format = "dia"

        query = db.session.query(
            group_expr.label("periodo"),
            func.sum(Pagamentos.valor).label("total_bruto"),
            func.sum(func.coalesce(Pagamentos.valor_desconto, 0)).label(
                "total_descontos"
            ),
            func.count(Pagamentos.id).label("quantidade"),
        ).filter(Pagamentos.data.between(data_inicio, data_fim))

        # Filtros opcionais
        if origem := request.args.get("origem"):
            query = query.filter(Pagamentos.origem == origem.strip().upper())
        if tipo := request.args.get("tipo"):
            query = query.filter(Pagamentos.tipo == tipo.strip().upper())

        query = query.group_by(group_expr).order_by(group_expr.asc())

        resultados = query.all()

        dados = []
        for r in resultados:
            bruto = float(r.total_bruto or 0)
            descontos = float(r.total_descontos or 0)

            # Formatar período
            if isinstance(r.periodo, date):
                periodo_str = r.periodo.isoformat()
            else:
                periodo_str = str(r.periodo)[:10] if r.periodo else None

            dados.append(
                {
                    "periodo": periodo_str,
                    "total_bruto": bruto,
                    "total_descontos": descontos,
                    "total_liquido": bruto - descontos,
                    "quantidade": r.quantidade,
                }
            )

        return jsonify(
            {
                "agrupamento": label_format,
                "total_registros": len(dados),
                "dados": dados,
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[Analytics] Erro em by-period: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao agrupar por período"}), 500


# =============================================================================
# Endpoint: Agrupamento por Origem/Tipo
# =============================================================================
@financial_analytics_bp.route("/by-category", methods=["GET"])
def get_analytics_by_category():
    """
    Agrupa pagamentos por origem ou tipo de pagamento.

    Query params:
    - data_inicio, data_fim (obrigatórios)
    - categoria: origem|tipo|tipo_pessoa_pix|conta_destinada_pix (default: origem)

    Response:
    - dados: lista ordenada por total_liquido desc
    """
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        categoria = (request.args.get("categoria") or "origem").lower()

        # Determinar coluna de agrupamento
        col_map = {
            "origem": Pagamentos.origem,
            "tipo": Pagamentos.tipo,
            "tipo_pessoa_pix": Pagamentos.tipo_pessoa_pix,
            "conta_destinada_pix": Pagamentos.conta_destinada_pix,
        }

        col = col_map.get(categoria, Pagamentos.origem)

        query = (
            db.session.query(
                col.label("categoria"),
                func.sum(Pagamentos.valor).label("total_bruto"),
                func.sum(func.coalesce(Pagamentos.valor_desconto, 0)).label(
                    "total_descontos"
                ),
                func.count(Pagamentos.id).label("quantidade"),
            )
            .filter(Pagamentos.data.between(data_inicio, data_fim))
            .group_by(col)
            .order_by(func.sum(Pagamentos.valor).desc())
        )

        resultados = query.all()

        # Calcular totais para percentuais
        total_geral = sum(
            float(r.total_bruto or 0) - float(r.total_descontos or 0)
            for r in resultados
        )

        dados = []
        for r in resultados:
            bruto = float(r.total_bruto or 0)
            descontos = float(r.total_descontos or 0)
            liquido = bruto - descontos

            dados.append(
                {
                    "categoria": r.categoria or "N/A",
                    "total_bruto": bruto,
                    "total_descontos": descontos,
                    "total_liquido": liquido,
                    "quantidade": r.quantidade,
                    "percentual": (
                        round((liquido / total_geral * 100), 2)
                        if total_geral > 0
                        else 0
                    ),
                }
            )

        return jsonify(
            {
                "tipo_categoria": categoria,
                "total_geral": total_geral,
                "dados": dados,
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[Analytics] Erro em by-category: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao agrupar por categoria"}), 500


# =============================================================================
# Endpoint: Top Entidades (empresas, convênios, pacientes)
# =============================================================================
@financial_analytics_bp.route("/top-entities", methods=["GET"])
def get_top_entities():
    """
    Retorna ranking das entidades que mais pagaram.

    Query params:
    - data_inicio, data_fim (obrigatórios)
    - entidade: empresa|convenio|paciente (default: empresa)
    - limite: int (default: 10)

    Response:
    - dados: lista ordenada por total_liquido desc
    """
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        entidade = (request.args.get("entidade") or "empresa").lower()
        limite = _parse_int(request.args.get("limite"), 10)

        if entidade == "convenio":
            query = (
                db.session.query(
                    Convenios.id,
                    Convenios.nome,
                    func.sum(Pagamentos.valor).label("total_bruto"),
                    func.sum(func.coalesce(Pagamentos.valor_desconto, 0)).label(
                        "total_descontos"
                    ),
                    func.count(Pagamentos.id).label("quantidade"),
                )
                .join(Pagamentos, Pagamentos.convenio_id == Convenios.id)
                .filter(Pagamentos.data.between(data_inicio, data_fim))
                .group_by(Convenios.id, Convenios.nome)
            )

        elif entidade == "paciente":
            query = (
                db.session.query(
                    Pacientes.id,
                    Pacientes.nome,
                    Pacientes.cpf,
                    func.sum(Pagamentos.valor).label("total_bruto"),
                    func.sum(func.coalesce(Pagamentos.valor_desconto, 0)).label(
                        "total_descontos"
                    ),
                    func.count(Pagamentos.id).label("quantidade"),
                )
                .join(Pagamentos, Pagamentos.cpf == Pacientes.cpf)
                .filter(Pagamentos.data.between(data_inicio, data_fim))
                .group_by(Pacientes.id, Pacientes.nome, Pacientes.cpf)
            )

        else:  # empresa
            query = (
                db.session.query(
                    Empresas.id,
                    Empresas.nome,
                    func.sum(Pagamentos.valor).label("total_bruto"),
                    func.sum(func.coalesce(Pagamentos.valor_desconto, 0)).label(
                        "total_descontos"
                    ),
                    func.count(Pagamentos.id).label("quantidade"),
                )
                .join(Pagamentos, Pagamentos.empresa_id == Empresas.id)
                .filter(Pagamentos.data.between(data_inicio, data_fim))
                .group_by(Empresas.id, Empresas.nome)
            )

        query = query.order_by(
            (
                func.sum(Pagamentos.valor)
                - func.sum(func.coalesce(Pagamentos.valor_desconto, 0))
            ).desc()
        ).limit(limite)

        resultados = query.all()

        dados = []
        for i, r in enumerate(resultados, 1):
            bruto = float(r.total_bruto or 0)
            descontos = float(r.total_descontos or 0)

            item = {
                "posicao": i,
                "id": r.id,
                "nome": r.nome,
                "total_bruto": bruto,
                "total_descontos": descontos,
                "total_liquido": bruto - descontos,
                "quantidade_pagamentos": r.quantidade,
            }

            if entidade == "paciente" and hasattr(r, "cpf"):
                item["cpf"] = r.cpf

            dados.append(item)

        return jsonify(
            {
                "entidade": entidade,
                "limite": limite,
                "dados": dados,
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[Analytics] Erro em top-entities: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar top entidades"}), 500


# =============================================================================
# Endpoint: Busca Avançada Flexível
# =============================================================================
@financial_analytics_bp.route("/search", methods=["GET"])
def advanced_search():
    """
    Busca avançada com múltiplos filtros combinados.

    Query params:
    - data_inicio, data_fim
    - origem, tipo
    - empresa_id, convenio_id
    - cpf, nome_paciente
    - valor_min, valor_max, valor_exato
    - possui_desconto
    - vinculado_nota_fiscal, numero_nota_fiscal
    - search (busca textual geral)
    - limit, offset
    - order: data_desc|data_asc|valor_desc|valor_asc

    Response:
    - total, pagamentos[], resumo
    """
    try:
        query = _base_query_with_filters(request.args)

        # Filtros adicionais
        if nome := request.args.get("nome_paciente"):
            query = query.filter(
                or_(
                    Pagamentos.nome_do_paciente.ilike(f"%{nome}%"),
                    Pagamentos.cpf.in_(
                        db.session.query(Pacientes.cpf).filter(
                            Pacientes.nome.ilike(f"%{nome}%")
                        )
                    ),
                )
            )

        if valor_exato := _parse_float(request.args.get("valor_exato")):
            query = query.filter(Pagamentos.valor == valor_exato)

        if numero_nf := request.args.get("numero_nota_fiscal"):
            query = query.filter(Pagamentos.numero_nota_fiscal.ilike(f"%{numero_nf}%"))

        if search := request.args.get("search"):
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Pagamentos.nome_do_paciente.ilike(s),
                    Pagamentos.nome_empresa.ilike(s),
                    Pagamentos.nome_convenio.ilike(s),
                    Pagamentos.descricao.ilike(s),
                    Pagamentos.numero_nota_fiscal.ilike(s),
                )
            )

        # Contar total antes de paginar
        total = query.count()

        # Calcular resumo
        resumo_query = query.with_entities(
            func.sum(Pagamentos.valor).label("total_bruto"),
            func.sum(func.coalesce(Pagamentos.valor_desconto, 0)).label(
                "total_descontos"
            ),
        )
        resumo_result = resumo_query.first()

        total_bruto = float(resumo_result.total_bruto or 0) if resumo_result else 0
        total_descontos = (
            float(resumo_result.total_descontos or 0) if resumo_result else 0
        )

        # Ordenação
        order = (request.args.get("order") or "data_desc").lower()
        order_map = {
            "data_asc": (Pagamentos.data.asc(), Pagamentos.id.asc()),
            "valor_desc": (Pagamentos.valor.desc(), Pagamentos.id.desc()),
            "valor_asc": (Pagamentos.valor.asc(), Pagamentos.id.asc()),
        }
        query = query.order_by(
            *order_map.get(order, (Pagamentos.data.desc(), Pagamentos.id.desc()))
        )

        # Paginação
        limit = _parse_int(request.args.get("limit"), 50)
        offset = _parse_int(request.args.get("offset"), 0)
        query = query.limit(limit).offset(offset)

        pagamentos = query.all()

        return jsonify(
            {
                "total": total,
                "limit": limit,
                "offset": offset,
                "resumo": {
                    "total_bruto": total_bruto,
                    "total_descontos": total_descontos,
                    "total_liquido": total_bruto - total_descontos,
                    "ticket_medio": (
                        round((total_bruto - total_descontos) / total, 2)
                        if total > 0
                        else 0
                    ),
                },
                "pagamentos": [_payment_to_dict(p) for p in pagamentos],
            }
        )

    except Exception as exc:
        current_app.logger.error("[Analytics] Erro em search: %s", exc, exc_info=True)
        return jsonify({"error": "Erro na busca avançada"}), 500


def _payment_to_dict(p: Pagamentos) -> dict:
    """Converte pagamento para dict (versão simplificada)."""
    return {
        "id": p.id,
        "data": p.data.isoformat() if p.data else None,
        "tipo": p.tipo,
        "origem": p.origem,
        "valor": float(p.valor or 0),
        "valor_desconto": float(p.valor_desconto or 0) if p.valor_desconto else None,
        "valor_liquido": float(p.valor or 0) - float(p.valor_desconto or 0),
        "nome_do_paciente": p.nome_do_paciente,
        "cpf": p.cpf,
        "nome_empresa": p.nome_empresa or (p.empresa.nome if p.empresa else None),
        "nome_convenio": p.nome_convenio or (p.convenio.nome if p.convenio else None),
        "empresa_id": p.empresa_id,
        "convenio_id": p.convenio_id,
        "descricao": p.descricao,
        "vinculado_nota_fiscal": p.vinculado_nota_fiscal or False,
        "numero_nota_fiscal": p.numero_nota_fiscal,
    }


# =============================================================================
# Endpoint: Pagamentos por Dia (análise de concentração)
# =============================================================================
@financial_analytics_bp.route("/by-day-detail", methods=["GET"])
def get_payments_by_day_detail():
    """
    Analisa pagamentos de um dia específico com detalhamento.

    Query params:
    - data (obrigatório): YYYY-MM-DD
    - agrupar_por: paciente|empresa|convenio|tipo (default: paciente)

    Response:
    - resumo do dia
    - agrupamentos
    - lista de pagamentos
    """
    try:
        data_str = request.args.get("data")
        data_obj = _parse_date(data_str)

        if not data_obj:
            return jsonify({"error": "data é obrigatória (formato YYYY-MM-DD)"}), 400

        agrupar = (request.args.get("agrupar_por") or "paciente").lower()

        # Buscar pagamentos do dia
        pagamentos = Pagamentos.query.filter(Pagamentos.data == data_obj).all()

        total_bruto = sum(float(p.valor or 0) for p in pagamentos)
        total_descontos = sum(float(p.valor_desconto or 0) for p in pagamentos)
        total_liquido = total_bruto - total_descontos

        # Agrupar
        grupos: dict[str, dict] = defaultdict(
            lambda: {
                "quantidade": 0,
                "total_bruto": 0,
                "total_descontos": 0,
                "pagamentos_ids": [],
            }
        )

        for p in pagamentos:
            if agrupar == "empresa":
                key = p.nome_empresa or (p.empresa.nome if p.empresa else "Sem empresa")
            elif agrupar == "convenio":
                key = p.nome_convenio or (
                    p.convenio.nome if p.convenio else "Sem convênio"
                )
            elif agrupar == "tipo":
                key = p.tipo or "N/A"
            else:  # paciente
                key = p.nome_do_paciente or (
                    p.paciente.nome if p.paciente else "Sem paciente"
                )

            grupos[key]["quantidade"] += 1
            grupos[key]["total_bruto"] += float(p.valor or 0)
            grupos[key]["total_descontos"] += float(p.valor_desconto or 0)
            grupos[key]["pagamentos_ids"].append(p.id)

        agrupamentos = [
            {
                "nome": k,
                "quantidade": v["quantidade"],
                "total_bruto": v["total_bruto"],
                "total_descontos": v["total_descontos"],
                "total_liquido": v["total_bruto"] - v["total_descontos"],
                "pagamentos_ids": v["pagamentos_ids"],
            }
            for k, v in sorted(
                grupos.items(), key=lambda x: x[1]["total_bruto"], reverse=True
            )
        ]

        return jsonify(
            {
                "data": data_obj.isoformat(),
                "resumo": {
                    "quantidade_pagamentos": len(pagamentos),
                    "total_bruto": total_bruto,
                    "total_descontos": total_descontos,
                    "total_liquido": total_liquido,
                },
                "agrupado_por": agrupar,
                "agrupamentos": agrupamentos,
                "pagamentos": [_payment_to_dict(p) for p in pagamentos],
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[Analytics] Erro em by-day-detail: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao analisar dia"}), 500


# =============================================================================
# Endpoint: Buscar pagamentos que somam valor específico
# =============================================================================
@financial_analytics_bp.route("/find-sum", methods=["GET"])
def find_payments_by_sum():
    """
    Encontra combinações de pagamentos que somam um valor específico.

    Query params:
    - valor_alvo (obrigatório): valor que a soma deve atingir
    - data (opcional): filtrar por dia específico
    - data_inicio, data_fim (opcional): filtrar por período
    - tolerancia (default: 0.01): margem de erro aceita
    - max_pagamentos (default: 5): máximo de pagamentos na combinação
    - cpf, empresa_id, convenio_id (filtros opcionais)

    Response:
    - combinacoes encontradas
    """
    try:
        valor_alvo = _parse_float(request.args.get("valor_alvo"))
        if valor_alvo is None:
            return jsonify({"error": "valor_alvo é obrigatório"}), 400

        tolerancia = _parse_float(request.args.get("tolerancia")) or 0.01
        max_pagamentos = _parse_int(request.args.get("max_pagamentos"), 5)
        max_pagamentos = min(
            max_pagamentos, 7
        )  # Limitar para evitar explosão combinatória

        # Construir query com filtros
        query = _base_query_with_filters(request.args)

        # Filtrar por data específica se informada
        if data_str := request.args.get("data"):
            data_obj = _parse_date(data_str)
            if data_obj:
                query = query.filter(Pagamentos.data == data_obj)

        # Buscar pagamentos candidatos (valor <= valor_alvo + tolerancia)
        query = query.filter(Pagamentos.valor <= valor_alvo + tolerancia)
        query = query.order_by(Pagamentos.valor.desc())
        query = query.limit(100)  # Limitar para performance

        pagamentos = query.all()

        if not pagamentos:
            return jsonify(
                {
                    "valor_alvo": valor_alvo,
                    "tolerancia": tolerancia,
                    "combinacoes_encontradas": 0,
                    "combinacoes": [],
                }
            )

        # Algoritmo de busca de combinações (subset sum aproximado)
        def find_combinations(items, target, tolerance, max_items):
            results = []
            n = len(items)

            # Verificar pagamentos individuais
            for i, p in enumerate(items):
                val = float(p.valor or 0)
                if abs(val - target) <= tolerance:
                    results.append([p])

            # Verificar pares
            if max_items >= 2:
                for i in range(n):
                    for j in range(i + 1, n):
                        val = float(items[i].valor or 0) + float(items[j].valor or 0)
                        if abs(val - target) <= tolerance:
                            results.append([items[i], items[j]])

            # Verificar trios
            if max_items >= 3 and n >= 3:
                for i in range(min(n, 30)):
                    for j in range(i + 1, min(n, 31)):
                        for k in range(j + 1, min(n, 32)):
                            val = (
                                float(items[i].valor or 0)
                                + float(items[j].valor or 0)
                                + float(items[k].valor or 0)
                            )
                            if abs(val - target) <= tolerance:
                                results.append([items[i], items[j], items[k]])

            return results[:20]  # Limitar resultados

        combinacoes_raw = find_combinations(
            pagamentos, valor_alvo, tolerancia, max_pagamentos
        )

        combinacoes = []
        for combo in combinacoes_raw:
            soma = sum(float(p.valor or 0) for p in combo)
            combinacoes.append(
                {
                    "soma": soma,
                    "diferenca": round(soma - valor_alvo, 2),
                    "quantidade_pagamentos": len(combo),
                    "pagamentos": [
                        {
                            "id": p.id,
                            "data": p.data.isoformat() if p.data else None,
                            "valor": float(p.valor or 0),
                            "nome": p.nome_do_paciente
                            or p.nome_empresa
                            or p.nome_convenio
                            or "N/A",
                            "tipo": p.tipo,
                        }
                        for p in combo
                    ],
                }
            )

        # Ordenar por menor diferença
        combinacoes.sort(key=lambda x: abs(x["diferenca"]))

        return jsonify(
            {
                "valor_alvo": valor_alvo,
                "tolerancia": tolerancia,
                "pagamentos_analisados": len(pagamentos),
                "combinacoes_encontradas": len(combinacoes),
                "combinacoes": combinacoes,
            }
        )

    except Exception as exc:
        current_app.logger.error("[Analytics] Erro em find-sum: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao buscar combinações"}), 500


# =============================================================================
# Endpoint: Análise de Tendências
# =============================================================================
@financial_analytics_bp.route("/trends", methods=["GET"])
def get_trends():
    """
    Análise de tendências comparando períodos.

    Query params:
    - meses (default: 6): quantidade de meses para analisar
    - metrica: receita|quantidade|ticket_medio (default: receita)

    Response:
    - dados mensais com tendência
    """
    try:
        meses = _parse_int(request.args.get("meses"), 6)
        meses = min(max(meses, 1), 24)  # Entre 1 e 24 meses

        metrica = (request.args.get("metrica") or "receita").lower()

        hoje = date.today()
        dados = []

        for i in range(meses - 1, -1, -1):
            # Calcular primeiro e último dia do mês
            if i == 0:
                mes_ref = hoje
                primeiro_dia = hoje.replace(day=1)
                ultimo_dia = hoje
            else:
                mes_ref = hoje.replace(day=1) - timedelta(days=1)
                for _ in range(i - 1):
                    mes_ref = mes_ref.replace(day=1) - timedelta(days=1)
                primeiro_dia = mes_ref.replace(day=1)
                # Último dia do mês
                if mes_ref.month == 12:
                    ultimo_dia = mes_ref.replace(day=31)
                else:
                    ultimo_dia = mes_ref.replace(
                        month=mes_ref.month + 1, day=1
                    ) - timedelta(days=1)

            # Query para o mês
            total_bruto = (
                db.session.query(func.coalesce(func.sum(Pagamentos.valor), 0))
                .filter(Pagamentos.data.between(primeiro_dia, ultimo_dia))
                .scalar()
                or 0
            )

            total_descontos = (
                db.session.query(
                    func.coalesce(
                        func.sum(func.coalesce(Pagamentos.valor_desconto, 0)), 0
                    )
                )
                .filter(Pagamentos.data.between(primeiro_dia, ultimo_dia))
                .scalar()
                or 0
            )

            quantidade = (
                db.session.query(func.count(Pagamentos.id))
                .filter(Pagamentos.data.between(primeiro_dia, ultimo_dia))
                .scalar()
                or 0
            )

            receita_liquida = float(total_bruto) - float(total_descontos)
            ticket_medio = receita_liquida / quantidade if quantidade > 0 else 0

            if metrica == "quantidade":
                valor = quantidade
            elif metrica == "ticket_medio":
                valor = round(ticket_medio, 2)
            else:
                valor = receita_liquida

            dados.append(
                {
                    "mes": primeiro_dia.strftime("%Y-%m"),
                    "mes_nome": primeiro_dia.strftime("%b/%Y"),
                    "valor": valor,
                    "receita_liquida": receita_liquida,
                    "quantidade": quantidade,
                    "ticket_medio": round(ticket_medio, 2),
                }
            )

        # Calcular tendência (variação média)
        if len(dados) >= 2:
            variacoes = []
            for i in range(1, len(dados)):
                if dados[i - 1]["valor"] > 0:
                    var = (
                        (dados[i]["valor"] - dados[i - 1]["valor"])
                        / dados[i - 1]["valor"]
                    ) * 100
                    variacoes.append(var)

            tendencia_media = sum(variacoes) / len(variacoes) if variacoes else 0
        else:
            tendencia_media = 0

        return jsonify(
            {
                "metrica": metrica,
                "meses_analisados": meses,
                "tendencia_media_percentual": round(tendencia_media, 2),
                "dados": dados,
            }
        )

    except Exception as exc:
        current_app.logger.error("[Analytics] Erro em trends: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao calcular tendências"}), 500


# =============================================================================
# Endpoint: Estatísticas por Entidade
# =============================================================================
@financial_analytics_bp.route(
    "/entity-stats/<entidade>/<int:entity_id>", methods=["GET"]
)
def get_entity_stats(entidade: str, entity_id: int):
    """
    Estatísticas detalhadas de uma entidade específica.

    Path params:
    - entidade: empresa|convenio|paciente
    - entity_id: ID da entidade

    Query params:
    - data_inicio, data_fim (opcional, default: últimos 12 meses)

    Response:
    - info da entidade
    - resumo financeiro
    - histórico mensal
    - distribuição por tipo de pagamento
    """
    try:
        entidade = entidade.lower()

        # Validar entidade e buscar info
        if entidade == "empresa":
            entity = Empresas.query.get(entity_id)
            if not entity:
                return jsonify({"error": "Empresa não encontrada"}), 404
            filter_col = Pagamentos.empresa_id == entity_id
            entity_info = {"id": entity.id, "nome": entity.nome, "cnpj": entity.cnpj}

        elif entidade == "convenio":
            entity = Convenios.query.get(entity_id)
            if not entity:
                return jsonify({"error": "Convênio não encontrado"}), 404
            filter_col = Pagamentos.convenio_id == entity_id
            entity_info = {"id": entity.id, "nome": entity.nome, "cnpj": entity.cnpj}

        elif entidade == "paciente":
            entity = Pacientes.query.get(entity_id)
            if not entity:
                return jsonify({"error": "Paciente não encontrado"}), 404
            filter_col = Pagamentos.cpf == entity.cpf
            entity_info = {"id": entity.id, "nome": entity.nome, "cpf": entity.cpf}

        else:
            return (
                jsonify(
                    {"error": "Entidade inválida. Use: empresa, convenio ou paciente"}
                ),
                400,
            )

        # Período
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio:
            data_inicio = date.today() - timedelta(days=365)
        if not data_fim:
            data_fim = date.today()

        # Query base
        base = Pagamentos.query.filter(
            filter_col, Pagamentos.data.between(data_inicio, data_fim)
        )

        # Resumo
        total_bruto = (
            db.session.query(func.coalesce(func.sum(Pagamentos.valor), 0))
            .filter(filter_col, Pagamentos.data.between(data_inicio, data_fim))
            .scalar()
            or 0
        )

        total_descontos = (
            db.session.query(
                func.coalesce(func.sum(func.coalesce(Pagamentos.valor_desconto, 0)), 0)
            )
            .filter(filter_col, Pagamentos.data.between(data_inicio, data_fim))
            .scalar()
            or 0
        )

        quantidade = base.count()

        # Por tipo de pagamento
        por_tipo = (
            db.session.query(
                Pagamentos.tipo,
                func.sum(Pagamentos.valor).label("total"),
                func.count(Pagamentos.id).label("quantidade"),
            )
            .filter(filter_col, Pagamentos.data.between(data_inicio, data_fim))
            .group_by(Pagamentos.tipo)
            .all()
        )

        # Histórico mensal (últimos 12 meses)
        historico = (
            db.session.query(
                func.date_trunc("month", Pagamentos.data).label("mes"),
                func.sum(Pagamentos.valor).label("total"),
                func.count(Pagamentos.id).label("quantidade"),
            )
            .filter(filter_col, Pagamentos.data.between(data_inicio, data_fim))
            .group_by(func.date_trunc("month", Pagamentos.data))
            .order_by(func.date_trunc("month", Pagamentos.data).asc())
            .all()
        )

        return jsonify(
            {
                "entidade": entidade,
                "info": entity_info,
                "periodo": {
                    "data_inicio": data_inicio.isoformat(),
                    "data_fim": data_fim.isoformat(),
                },
                "resumo": {
                    "total_bruto": float(total_bruto),
                    "total_descontos": float(total_descontos),
                    "total_liquido": float(total_bruto) - float(total_descontos),
                    "quantidade_pagamentos": quantidade,
                    "ticket_medio": (
                        round(
                            (float(total_bruto) - float(total_descontos)) / quantidade,
                            2,
                        )
                        if quantidade > 0
                        else 0
                    ),
                },
                "por_tipo": [
                    {
                        "tipo": t.tipo or "N/A",
                        "total": float(t.total or 0),
                        "quantidade": t.quantidade,
                    }
                    for t in por_tipo
                ],
                "historico_mensal": [
                    {
                        "mes": h.mes.strftime("%Y-%m") if h.mes else None,
                        "total": float(h.total or 0),
                        "quantidade": h.quantidade,
                    }
                    for h in historico
                ],
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[Analytics] Erro em entity-stats: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar estatísticas da entidade"}), 500


# =============================================================================
# Endpoint: Exportar dados para análise
# =============================================================================
@financial_analytics_bp.route("/export", methods=["GET"])
def export_analytics_data():
    """
    Exporta dados agregados para análise externa.

    Query params:
    - data_inicio, data_fim (obrigatórios)
    - formato: json|csv (default: json)
    - agrupar: dia|semana|mes (default: dia)

    Response:
    - dados agregados
    """
    try:
        data_inicio, data_fim = _get_date_range(request.args)
        if not data_inicio or not data_fim:
            return jsonify({"error": "data_inicio e data_fim são obrigatórios"}), 400

        agrupar = (request.args.get("agrupar") or "dia").lower()

        # Determinar expressão de agrupamento
        if agrupar == "semana":
            group_expr = func.date_trunc("week", Pagamentos.data)
        elif agrupar == "mes":
            group_expr = func.date_trunc("month", Pagamentos.data)
        else:
            group_expr = Pagamentos.data

        query = (
            db.session.query(
                group_expr.label("periodo"),
                Pagamentos.tipo,
                Pagamentos.origem,
                func.sum(Pagamentos.valor).label("total_bruto"),
                func.sum(func.coalesce(Pagamentos.valor_desconto, 0)).label(
                    "total_descontos"
                ),
                func.count(Pagamentos.id).label("quantidade"),
                func.count(func.distinct(Pagamentos.cpf)).label("pacientes_unicos"),
                func.count(func.distinct(Pagamentos.empresa_id)).label(
                    "empresas_unicas"
                ),
                func.count(func.distinct(Pagamentos.convenio_id)).label(
                    "convenios_unicos"
                ),
            )
            .filter(Pagamentos.data.between(data_inicio, data_fim))
            .group_by(group_expr, Pagamentos.tipo, Pagamentos.origem)
            .order_by(group_expr.asc())
        )

        resultados = query.all()

        dados = []
        for r in resultados:
            periodo_str = (
                r.periodo.isoformat()
                if isinstance(r.periodo, date)
                else str(r.periodo)[:10]
            )
            bruto = float(r.total_bruto or 0)
            descontos = float(r.total_descontos or 0)

            dados.append(
                {
                    "periodo": periodo_str,
                    "tipo": r.tipo,
                    "origem": r.origem,
                    "total_bruto": bruto,
                    "total_descontos": descontos,
                    "total_liquido": bruto - descontos,
                    "quantidade": r.quantidade,
                    "pacientes_unicos": r.pacientes_unicos,
                    "empresas_unicas": r.empresas_unicas,
                    "convenios_unicos": r.convenios_unicos,
                }
            )

        return jsonify(
            {
                "periodo": {
                    "data_inicio": data_inicio.isoformat(),
                    "data_fim": data_fim.isoformat(),
                },
                "agrupamento": agrupar,
                "total_registros": len(dados),
                "dados": dados,
            }
        )

    except Exception as exc:
        current_app.logger.error("[Analytics] Erro em export: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao exportar dados"}), 500
