"""Controller para autocomplete - busca rápida para seletores.

Endpoints otimizados para busca em tempo real com debounce no frontend.
Retorna dados mínimos necessários para seleção, ordenados por relevância.
"""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_, func

from app.database import db
from app.models.companies_model import Empresas
from app.models.insurances_model import Convenios
from app.models.patients_model import Pacientes
from app.utils.search import build_relevance_score, build_smart_search_filter
from app.utils.validators import format_cnpj, format_cpf, only_digits

autocomplete_bp = Blueprint("autocomplete", __name__)

# ── Constantes ───────────────────────────────────────────────────────────
_DEFAULT_LIMIT = 30
_MAX_LIMIT = 100
_MIN_QUERY_LEN = 2


# ── Helpers ──────────────────────────────────────────────────────────────


def _parse_limit(default: int = _DEFAULT_LIMIT) -> int:
    return min(request.args.get("limit", default, type=int), _MAX_LIMIT)


def _apply_smart_filter(query, columns: list, q: str, primary_col):
    """Aplica busca inteligente e ordena por relevância."""
    smart_filter = build_smart_search_filter(columns, q)
    if smart_filter is not None:
        query = query.filter(smart_filter)
        query = query.order_by(build_relevance_score(primary_col, q))
    return query


def _apply_digits_filter(query, col, digits: str, min_len: int = 3):
    """Aplica filtro por dígitos (CPF/CNPJ parcial) se suficiente."""
    if len(digits) >= min_len:
        return query.filter(func.cast(col, db.String).like(f"%{digits}%"))
    return query


# ── Pacientes ─────────────────────────────────────────────────────────────


@autocomplete_bp.route("/autocomplete/pacientes", methods=["GET"])
def autocomplete_pacientes():
    """
    Busca pacientes para autocomplete.

    Query params:
        q          : termo de busca (nome ou CPF, mín. 2 chars)
        empresa_id : filtra por empresa (opcional)
        convenio_id: filtra por convênio (opcional)
        limit      : máx. resultados (default 30, máx 100)
    """
    try:
        q = (request.args.get("q") or "").strip()
        empresa_id = request.args.get("empresa_id", type=int)
        convenio_id = request.args.get("convenio_id", type=int)
        limit = _parse_limit()

        query = Pacientes.query

        if len(q) >= _MIN_QUERY_LEN:
            digits = only_digits(q)
            if digits and len(digits) >= 3:
                # Busca por CPF (dígitos) OU nome inteligente
                smart_filter = build_smart_search_filter([Pacientes.nome], q)
                cpf_filter = func.cast(Pacientes.cpf, db.String).like(f"%{digits}%")
                if smart_filter is not None:
                    query = query.filter(or_(smart_filter, cpf_filter))
                else:
                    query = query.filter(cpf_filter)
            else:
                query = _apply_smart_filter(query, [Pacientes.nome], q, Pacientes.nome)
            query = query.order_by(build_relevance_score(Pacientes.nome, q))
        else:
            query = query.order_by(Pacientes.nome.asc())

        if empresa_id:
            empresa = Empresas.query.get(empresa_id)
            if empresa:
                query = query.filter(Pacientes.cnpj_empresa == empresa.cnpj)

        if convenio_id:
            convenio = Convenios.query.get(convenio_id)
            if convenio:
                query = query.filter(Pacientes.cnpj_convenio == convenio.cnpj)

        pacientes = query.limit(limit).all()

        result = []
        for p in pacientes:
            item = {
                "id": p.id,
                "nome": p.nome,
                "cpf": format_cpf(p.cpf),
                "cpf_raw": p.cpf,
            }

            # Adiciona nome da empresa se vinculado
            if p.empresa:
                item["empresa_nome"] = p.empresa.nome
                item["empresa_id"] = p.empresa.id

            # Adiciona nome do convênio se vinculado
            if p.convenio:
                item["convenio_nome"] = p.convenio.nome
                item["convenio_id"] = p.convenio.id
            result.append(item)

        return jsonify(result)

    except Exception as exc:
        current_app.logger.exception("[Autocomplete] Erro pacientes")
        return jsonify({"error": "Erro na busca"}), 500


# ── Empresas ──────────────────────────────────────────────────────────────


@autocomplete_bp.route("/autocomplete/empresas", methods=["GET"])
def autocomplete_empresas():
    """
    Busca empresas para autocomplete.

    Query params:
        q    : termo de busca (nome ou CNPJ, mín. 2 chars)
        limit: máx. resultados (default 30, máx 100)
    """
    try:
        q = (request.args.get("q") or "").strip()
        limit = _parse_limit()

        query = Empresas.query

        if len(q) >= _MIN_QUERY_LEN:
            digits = only_digits(q)
            if digits and len(digits) >= 3:
                smart_filter = build_smart_search_filter([Empresas.nome], q)
                cnpj_filter = func.cast(Empresas.cnpj, db.String).like(f"%{digits}%")
                if smart_filter is not None:
                    query = query.filter(or_(smart_filter, cnpj_filter))
                else:
                    query = query.filter(cnpj_filter)
            else:
                query = _apply_smart_filter(query, [Empresas.nome], q, Empresas.nome)
            query = query.order_by(build_relevance_score(Empresas.nome, q))
        else:
            query = query.order_by(Empresas.nome.asc())

        empresas = query.limit(limit).all()

        return jsonify(
            [
                {
                    "id": e.id,
                    "nome": e.nome,
                    "cnpj": format_cnpj(e.cnpj),
                    "cnpj_raw": e.cnpj,
                    "total_pacientes": (
                        len(e.pacientes) if hasattr(e, "pacientes") else 0
                    ),
                    "email": e.email,
                }
                for e in empresas
            ]
        )

    except Exception as exc:
        current_app.logger.exception("[Autocomplete] Erro empresas")
        return jsonify({"error": "Erro na busca"}), 500


# ── Convênios ─────────────────────────────────────────────────────────────


@autocomplete_bp.route("/autocomplete/convenios", methods=["GET"])
def autocomplete_convenios():
    """
    Busca convênios para autocomplete.

    Query params:
        q    : termo de busca (nome ou CNPJ, mín. 2 chars)
        limit: máx. resultados (default 30, máx 100)
    """
    try:
        q = (request.args.get("q") or "").strip()
        limit = _parse_limit()

        query = Convenios.query

        if len(q) >= _MIN_QUERY_LEN:
            digits = only_digits(q)
            if digits and len(digits) >= 3:
                smart_filter = build_smart_search_filter([Convenios.nome], q)
                cnpj_filter = func.cast(Convenios.cnpj, db.String).like(f"%{digits}%")
                if smart_filter is not None:
                    query = query.filter(or_(smart_filter, cnpj_filter))
                else:
                    query = query.filter(cnpj_filter)
            else:
                query = _apply_smart_filter(query, [Convenios.nome], q, Convenios.nome)
            query = query.order_by(build_relevance_score(Convenios.nome, q))
        else:
            query = query.order_by(Convenios.nome.asc())

        convenios = query.limit(limit).all()

        return jsonify(
            [
                {
                    "id": c.id,
                    "nome": c.nome,
                    "cnpj": format_cnpj(c.cnpj),
                    "cnpj_raw": c.cnpj,
                    "emite_guia": getattr(c, "emite_guia", False),
                    "total_pacientes": (
                        len(c.pacientes) if hasattr(c, "pacientes") else 0
                    ),
                    "email": c.email,
                }
                for c in convenios
            ]
        )

    except Exception as exc:
        current_app.logger.exception("[Autocomplete] Erro convênios")
        return jsonify({"error": "Erro na busca"}), 500


# ── Busca unificada ────────────────────────────────────────────────────────


@autocomplete_bp.route("/autocomplete/all", methods=["GET"])
def autocomplete_all():
    """
    Busca unificada em pacientes, empresas e convênios.

    Query params:
        q    : termo de busca (mín. 2 chars)
        types: tipos separados por vírgula (default: pacientes,empresas,convenios)
        limit: máx. por tipo (default 10, máx 30)
    """
    try:
        q = (request.args.get("q") or "").strip()
        types = [
            t.strip()
            for t in (
                request.args.get("types") or "pacientes,empresas,convenios"
            ).split(",")
        ]
        limit = min(request.args.get("limit", 10, type=int), 30)

        result: dict = {t: [] for t in types}

        if len(q) < _MIN_QUERY_LEN:
            return jsonify(result)

        digits = only_digits(q)

        def _search(base_query, name_col, id_col, digit_col=None):
            """Aplica busca inteligente + fallback por dígitos."""
            smart_filter = build_smart_search_filter([name_col], q)
            if digit_col and digits and len(digits) >= 3:
                digit_filter = func.cast(digit_col, db.String).like(f"%{digits}%")
                combined = (
                    or_(smart_filter, digit_filter)
                    if smart_filter is not None
                    else digit_filter
                )
                base_query = base_query.filter(combined)
            elif smart_filter is not None:
                base_query = base_query.filter(smart_filter)
            return base_query.order_by(build_relevance_score(name_col, q)).limit(limit)

        if "pacientes" in types:
            rows = _search(
                Pacientes.query, Pacientes.nome, Pacientes.id, Pacientes.cpf
            ).all()
            result["pacientes"] = [
                {
                    "id": p.id,
                    "nome": p.nome,
                    "cpf": format_cpf(p.cpf),
                    "cpf_raw": p.cpf,
                    "empresa_nome": p.empresa.nome if p.empresa else None,
                    "convenio_nome": p.convenio.nome if p.convenio else None,
                }
                for p in rows
            ]

        if "empresas" in types:
            rows = _search(
                Empresas.query, Empresas.nome, Empresas.id, Empresas.cnpj
            ).all()
            result["empresas"] = [
                {
                    "id": e.id,
                    "nome": e.nome,
                    "cnpj": format_cnpj(e.cnpj),
                    "cnpj_raw": e.cnpj,
                }
                for e in rows
            ]

        if "convenios" in types:
            rows = _search(
                Convenios.query, Convenios.nome, Convenios.id, Convenios.cnpj
            ).all()
            result["convenios"] = [
                {
                    "id": c.id,
                    "nome": c.nome,
                    "cnpj": format_cnpj(c.cnpj),
                    "cnpj_raw": c.cnpj,
                }
                for c in rows
            ]

        return jsonify(result)

    except Exception as exc:
        current_app.logger.exception("[Autocomplete] Erro busca unificada")
        return jsonify({"error": "Erro na busca"}), 500
