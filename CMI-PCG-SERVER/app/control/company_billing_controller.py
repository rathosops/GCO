"""
Controller para faturamento posterior de empresas conveniadas.

Rotas:
  GET    /faturamento-posterior/empresas
         Lista empresas com faturamento posterior ativo

  GET    /faturamento-posterior/empresas/<id>/pacientes
         Pacientes da empresa com histórico (consultas, ASOs, questionários)

  GET    /faturamento-posterior/empresas/<id>/resumo
         Resumo financeiro consolidado do período

  PUT    /faturamento-posterior/empresas/<id>/config
         Atualiza configuração de faturamento (valores, dia, flag)

Query params comuns: data_inicio, data_fim (YYYY-MM-DD).
"""

from __future__ import annotations

import logging
from typing import Any

from flask import Blueprint, jsonify, request

from app.database import db
from app.models.companies_model import Empresas
from app.src.company_billing_service import company_billing_service
from app.utils.validators import parse_bool, parse_date

LOGGER = logging.getLogger(__name__)

faturamento_posterior_bp = Blueprint("faturamento_posterior", __name__)


# =========================================================================
# Helpers
# =========================================================================


def _json_error(msg: str, status: int = 400):
    """Retorno padronizado de erro."""
    return jsonify({"error": msg}), status


def _safe_int(value: Any, *, default: int | None = None) -> int | None:
    """Converte para int de forma segura."""
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any) -> float | None:
    """Converte para float de forma segura."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_periodo() -> tuple:
    """
    Extrai data_inicio e data_fim dos query params.

    Returns:
        (data_inicio, data_fim, error_response)
        Se error_response != None, retorne-o imediatamente.
    """
    data_inicio = parse_date(request.args.get("data_inicio"))
    data_fim = parse_date(request.args.get("data_fim"))

    if not data_inicio or not data_fim:
        return None, None, _json_error("Informe data_inicio e data_fim (YYYY-MM-DD).")

    if data_inicio > data_fim:
        return None, None, _json_error("data_inicio não pode ser posterior a data_fim.")

    return data_inicio, data_fim, None


# =========================================================================
# ROTAS
# =========================================================================


@faturamento_posterior_bp.route("/faturamento-posterior/empresas", methods=["GET"])
def listar_empresas_faturamento():
    """
    Lista empresas com faturamento posterior.

    Query params:
      - search: busca por nome/razão social
      - ativo: true/false (default: true)
      - limit, offset: paginação
    """
    try:
        search = request.args.get("search")
        ativo = parse_bool(request.args.get("ativo", "true"))
        limit = _safe_int(request.args.get("limit"), default=50) or 50
        offset = _safe_int(request.args.get("offset"), default=0) or 0

        resultado = company_billing_service.listar_empresas(
            search=search,
            ativo=ativo,
            limit=limit,
            offset=offset,
        )

        return jsonify(resultado)

    except Exception as exc:
        LOGGER.exception("Erro ao listar empresas faturamento posterior")
        return _json_error(f"Erro ao listar empresas: {exc}", 500)


@faturamento_posterior_bp.route(
    "/faturamento-posterior/empresas/<int:empresa_id>/pacientes",
    methods=["GET"],
)
def get_pacientes_historico(empresa_id: int):
    """
    Pacientes da empresa com histórico no período.

    Query params:
      - data_inicio (YYYY-MM-DD, obrigatório)
      - data_fim (YYYY-MM-DD, obrigatório)
    """
    data_inicio, data_fim, error = _extract_periodo()
    if error:
        return error

    try:
        resultado = company_billing_service.get_pacientes_com_historico(
            empresa_id,
            data_inicio,
            data_fim,
        )
        if not resultado:
            return _json_error("Empresa não encontrada.", 404)

        return jsonify(resultado)

    except Exception as exc:
        LOGGER.exception(
            "Erro ao buscar pacientes faturamento empresa %d",
            empresa_id,
        )
        return _json_error(f"Erro ao buscar pacientes: {exc}", 500)


@faturamento_posterior_bp.route(
    "/faturamento-posterior/empresas/<int:empresa_id>/resumo",
    methods=["GET"],
)
def get_resumo_faturamento(empresa_id: int):
    """
    Resumo financeiro consolidado do período.

    Query params:
      - data_inicio (YYYY-MM-DD, obrigatório)
      - data_fim (YYYY-MM-DD, obrigatório)
    """
    data_inicio, data_fim, error = _extract_periodo()
    if error:
        return error

    try:
        resultado = company_billing_service.get_resumo_faturamento(
            empresa_id,
            data_inicio,
            data_fim,
        )
        if not resultado:
            return _json_error(
                "Empresa não encontrada ou não possui faturamento posterior.",
                404,
            )

        return jsonify(resultado)

    except Exception as exc:
        LOGGER.exception(
            "Erro ao gerar resumo faturamento empresa %d",
            empresa_id,
        )
        return _json_error(f"Erro ao gerar resumo: {exc}", 500)


@faturamento_posterior_bp.route(
    "/faturamento-posterior/empresas/<int:empresa_id>/config",
    methods=["PUT"],
)
def update_config_faturamento(empresa_id: int):
    """
    Atualiza configuração de faturamento posterior da empresa.

    Body JSON (todos opcionais):
      - faturamento_posterior: bool
      - dia_faturamento: int (1-31) ou null
      - valor_por_consulta: float ou null
      - valor_por_aso: float ou null  (mantido por compatibilidade; ignorado quando aso_embutido_na_consulta=True)
      - aso_embutido_na_consulta: bool (default: True — ASO sempre incluso na consulta)
      - observacoes_faturamento: string ou null
    """
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    try:
        if "faturamento_posterior" in data:
            flag = parse_bool(data["faturamento_posterior"])
            if flag is None:
                return _json_error("faturamento_posterior deve ser true/false.")
            empresa.faturamento_posterior = flag

            # Se desativando, limpa campos dependentes opcionalmente
            if not flag:
                LOGGER.info(
                    "Faturamento posterior desativado para empresa %d",
                    empresa_id,
                )

        if "dia_faturamento" in data:
            dia = _safe_int(data["dia_faturamento"])
            if dia is not None and not (1 <= dia <= 31):
                return _json_error("dia_faturamento deve ser entre 1 e 31.")
            empresa.dia_faturamento = dia

        if "valor_por_consulta" in data:
            valor = _safe_float(data["valor_por_consulta"])
            if valor is not None and valor < 0:
                return _json_error("valor_por_consulta não pode ser negativo.")
            empresa.valor_por_consulta = valor

        if "valor_por_aso" in data:
            valor = _safe_float(data["valor_por_aso"])
            if valor is not None and valor < 0:
                return _json_error("valor_por_aso não pode ser negativo.")
            empresa.valor_por_aso = valor

        if "aso_embutido_na_consulta" in data:
            flag_aso = parse_bool(data["aso_embutido_na_consulta"])
            if flag_aso is None:
                return _json_error("aso_embutido_na_consulta deve ser true/false.")
            empresa.aso_embutido_na_consulta = flag_aso

        if "observacoes_faturamento" in data:
            obs = data["observacoes_faturamento"]
            empresa.observacoes_faturamento = str(obs).strip() if obs else None

        db.session.commit()

        return jsonify(
            {
                "message": "Configuração de faturamento atualizada.",
                "empresa": empresa.to_dict(),
            }
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception(
            "Erro ao atualizar config faturamento empresa %d",
            empresa_id,
        )
        return _json_error(f"Erro ao atualizar: {exc}", 500)
