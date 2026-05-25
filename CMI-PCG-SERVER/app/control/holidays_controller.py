"""
Controller de Feriados.

Rotas para gerenciamento de feriados customizados e consulta
de feriados oficiais brasileiros.

Rotas:
- GET    /feriados                    Lista feriados (oficiais + customizados)
- GET    /feriados/verificar          Verifica se data é feriado
- GET    /feriados/mes                Lista feriados do mês
- GET    /feriados/customizados       Lista apenas customizados
- GET    /feriados/customizados/<id>  Busca customizado por ID
- POST   /feriados/customizados       Cria feriado customizado
- PUT    /feriados/customizados/<id>  Atualiza feriado customizado
- DELETE /feriados/customizados/<id>  Remove (soft delete) customizado
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import date, datetime, timedelta
from typing import Any

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.holidays_model import FeriadoCustomizado, FeriadoTipo
from app.src.holidays_service import (
    BrazilianHolidaysService,
    get_holidays_in_month,
    is_blocked_for_scheduling,
    is_holiday,
)
from app.utils.timezone import get_today_sao_paulo

LOGGER = logging.getLogger(__name__)

feriados_bp = Blueprint("feriados", __name__)


# =============================================================================
# Helpers
# =============================================================================


def _bad_request(message: str, code: int = 400):
    return jsonify({"error": message}), code


def _not_found(message: str = "Feriado não encontrado"):
    return jsonify({"error": message}), 404


def _parse_date(value: Any) -> tuple[date | None, str | None]:
    """
    Parseia data de string.

    Aceita:
    - YYYY-MM-DD
    - hoje
    - amanha
    """
    if value is None:
        return None, "Data não informada."

    s = str(value).strip().lower()

    if s == "hoje":
        return get_today_sao_paulo(), None
    if s == "amanha":
        return get_today_sao_paulo() + timedelta(days=1), None

    try:
        return datetime.strptime(s, "%Y-%m-%d").date(), None
    except ValueError:
        return None, "Formato de data inválido. Use YYYY-MM-DD."


def _normalize_text(value: Any) -> str | None:
    """Normaliza texto (trim, None se vazio)."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _normalize_bool(value: Any) -> bool | None:
    """Normaliza valor booleano."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in {"true", "1", "sim", "yes"}:
        return True
    if s in {"false", "0", "nao", "não", "no"}:
        return False
    return None


def _validate_tipo(value: Any) -> str | None:
    """Valida tipo de feriado."""
    if value is None:
        return None
    s = str(value).strip().upper()
    return s if s in FeriadoTipo.ALL else None


# =============================================================================
# Rotas de Consulta (Feriados Oficiais + Customizados)
# =============================================================================


@feriados_bp.route("/feriados", methods=["GET"])
def list_holidays():
    """
    Lista feriados em um período.

    Query params:
    - data_inicio: Data inicial (YYYY-MM-DD ou 'hoje')
    - data_fim: Data final (YYYY-MM-DD)
    - include_weekends: true/false (inclui sábados/domingos)
    """
    start_raw = request.args.get("data_inicio")
    end_raw = request.args.get("data_fim")
    include_weekends = _normalize_bool(request.args.get("include_weekends")) or False

    # Default: mês atual
    today = get_today_sao_paulo()
    if not start_raw:
        start_date = date(today.year, today.month, 1)
    else:
        start_date, err = _parse_date(start_raw)
        if err:
            return _bad_request(err)

    if not end_raw:
        # Último dia do mês
        if today.month == 12:
            end_date = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(today.year, today.month + 1, 1) - timedelta(days=1)
    else:
        end_date, err = _parse_date(end_raw)
        if err:
            return _bad_request(err)

    if start_date > end_date:
        return _bad_request("Data inicial deve ser menor ou igual à data final.")

    # Limita período máximo (1 ano)
    max_days = 366
    if (end_date - start_date).days > max_days:
        return _bad_request(f"Período máximo de consulta: {max_days} dias.")

    service = BrazilianHolidaysService()
    holidays = service.get_holidays_in_period(start_date, end_date, include_weekends)

    return jsonify({
        "periodo": {
            "inicio": start_date.isoformat(),
            "fim": end_date.isoformat(),
        },
        "total": len(holidays),
        "feriados": [
            {
                "data": h.data.isoformat(),
                "nome": h.nome,
                "tipo": h.tipo,
                "fonte": h.fonte,
                "bloqueia_agendamento": h.bloqueia_agendamento,
            }
            for h in holidays
        ],
    }), 200


@feriados_bp.route("/feriados/verificar", methods=["GET"])
def check_holiday():
    """
    Verifica se uma data específica é feriado.

    Query params:
    - data: Data a verificar (YYYY-MM-DD ou 'hoje')
    """
    data_raw = request.args.get("data")
    if not data_raw:
        return _bad_request("Parâmetro 'data' é obrigatório.")

    check_date, err = _parse_date(data_raw)
    if err:
        return _bad_request(err)

    holiday = is_holiday(check_date)
    blocked, motivo = is_blocked_for_scheduling(check_date)

    # Verifica se é fim de semana
    is_weekend = check_date.weekday() in (5, 6)
    day_name = None
    if is_weekend:
        day_name = "Sábado" if check_date.weekday() == 5 else "Domingo"

    return jsonify({
        "data": check_date.isoformat(),
        "dia_semana": check_date.strftime("%A"),
        "is_feriado": holiday is not None,
        "is_fim_de_semana": is_weekend,
        "bloqueia_agendamento": blocked or is_weekend,
        "feriado": {
            "nome": holiday.nome,
            "tipo": holiday.tipo,
            "fonte": holiday.fonte,
        } if holiday else None,
        "motivo_bloqueio": motivo or day_name if (blocked or is_weekend) else None,
    }), 200


@feriados_bp.route("/feriados/mes", methods=["GET"])
def list_holidays_month():
    """
    Lista feriados de um mês específico.

    Query params:
    - ano: Ano (default: atual)
    - mes: Mês 1-12 (default: atual)
    - include_weekends: true/false
    """
    today = get_today_sao_paulo()

    try:
        year = int(request.args.get("ano", today.year))
        month = int(request.args.get("mes", today.month))
    except ValueError:
        return _bad_request("Ano e mês devem ser números inteiros.")

    if not (1 <= month <= 12):
        return _bad_request("Mês deve estar entre 1 e 12.")

    if not (1900 <= year <= 2100):
        return _bad_request("Ano deve estar entre 1900 e 2100.")

    include_weekends = _normalize_bool(request.args.get("include_weekends")) or False

    holidays = get_holidays_in_month(year, month, include_weekends)

    return jsonify({
        "ano": year,
        "mes": month,
        "total": len(holidays),
        "feriados": [
            {
                "data": h.data.isoformat(),
                "dia": h.data.day,
                "nome": h.nome,
                "tipo": h.tipo,
                "fonte": h.fonte,
                "bloqueia_agendamento": h.bloqueia_agendamento,
            }
            for h in holidays
        ],
    }), 200


@feriados_bp.route("/feriados/dias-uteis", methods=["GET"])
def count_business_days():
    """
    Conta dias úteis entre duas datas.

    Query params:
    - data_inicio: Data inicial
    - data_fim: Data final
    """
    start_raw = request.args.get("data_inicio")
    end_raw = request.args.get("data_fim")

    if not start_raw or not end_raw:
        return _bad_request("Parâmetros 'data_inicio' e 'data_fim' são obrigatórios.")

    start_date, err = _parse_date(start_raw)
    if err:
        return _bad_request(err)

    end_date, err = _parse_date(end_raw)
    if err:
        return _bad_request(err)

    service = BrazilianHolidaysService()
    count = service.count_business_days(start_date, end_date)

    return jsonify({
        "data_inicio": start_date.isoformat(),
        "data_fim": end_date.isoformat(),
        "dias_uteis": count,
    }), 200


# =============================================================================
# Rotas CRUD de Feriados Customizados
# =============================================================================


@feriados_bp.route("/feriados/customizados", methods=["GET"])
def list_custom_holidays():
    """
    Lista feriados customizados.

    Query params:
    - ano: Filtrar por ano
    - ativo: true/false (default: true)
    - tipo: Filtrar por tipo
    """
    ano = request.args.get("ano")
    ativo = _normalize_bool(request.args.get("ativo", "true"))
    tipo = _validate_tipo(request.args.get("tipo"))

    query = FeriadoCustomizado.query

    if ativo is not None:
        query = query.filter(FeriadoCustomizado.ativo == ativo)

    if ano:
        try:
            year = int(ano)
            # Filtra por ano considerando recorrentes
            from sqlalchemy import extract, or_

            query = query.filter(
                or_(
                    extract("year", FeriadoCustomizado.data) == year,
                    FeriadoCustomizado.recorrente.is_(True),
                )
            )
        except ValueError:
            return _bad_request("Ano deve ser número inteiro.")

    if tipo:
        query = query.filter(FeriadoCustomizado.tipo == tipo)

    feriados = query.order_by(FeriadoCustomizado.data.asc()).all()

    return jsonify({
        "total": len(feriados),
        "feriados": [f.to_dict() for f in feriados],
    }), 200


@feriados_bp.route("/feriados/customizados/<int:feriado_id>", methods=["GET"])
def get_custom_holiday(feriado_id: int):
    """Busca feriado customizado por ID."""
    feriado = FeriadoCustomizado.query.get(feriado_id)
    if not feriado:
        return _not_found()

    return jsonify(feriado.to_dict()), 200


@feriados_bp.route("/feriados/customizados", methods=["POST"])
def create_custom_holiday():
    """
    Cria feriado customizado.

    Body JSON:
    - data: Data do feriado (YYYY-MM-DD) - obrigatório
    - nome: Nome do feriado - obrigatório
    - tipo: Tipo (CLINICA, PONTO_FACULTATIVO, etc)
    - bloqueia_agendamento: true/false (default: true)
    - recorrente: true/false (default: false)
    - observacoes: Texto opcional
    """
    payload = request.json or {}

    # Validações obrigatórias
    data_raw = payload.get("data")
    nome = _normalize_text(payload.get("nome"))

    if not data_raw:
        return _bad_request("Campo 'data' é obrigatório.")
    if not nome:
        return _bad_request("Campo 'nome' é obrigatório.")

    data, err = _parse_date(data_raw)
    if err:
        return _bad_request(err)

    # Validações opcionais
    tipo = _validate_tipo(payload.get("tipo")) or FeriadoTipo.CLINICA
    bloqueia = _normalize_bool(payload.get("bloqueia_agendamento"))
    if bloqueia is None:
        bloqueia = True

    recorrente = _normalize_bool(payload.get("recorrente")) or False
    observacoes = _normalize_text(payload.get("observacoes"))

    feriado = FeriadoCustomizado(
        data=data,
        nome=nome,
        tipo=tipo,
        bloqueia_agendamento=bloqueia,
        recorrente=recorrente,
        observacoes=observacoes,
        ativo=True,
    )

    try:
        db.session.add(feriado)
        db.session.commit()
        return jsonify({
            "message": "Feriado criado com sucesso",
            "feriado": feriado.to_dict(),
        }), 201
    except IntegrityError:
        db.session.rollback()
        return _bad_request("Já existe um feriado com essa data e nome.")
    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao criar feriado customizado")
        return jsonify({"error": str(exc)}), 500


@feriados_bp.route("/feriados/customizados/<int:feriado_id>", methods=["PUT"])
def update_custom_holiday(feriado_id: int):
    """
    Atualiza feriado customizado.

    Body JSON: campos a atualizar
    """
    feriado = FeriadoCustomizado.query.get(feriado_id)
    if not feriado:
        return _not_found()

    payload = request.json or {}

    if "data" in payload:
        data, err = _parse_date(payload.get("data"))
        if err:
            return _bad_request(err)
        feriado.data = data

    if "nome" in payload:
        nome = _normalize_text(payload.get("nome"))
        if not nome:
            return _bad_request("Nome não pode ser vazio.")
        feriado.nome = nome

    if "tipo" in payload:
        tipo = _validate_tipo(payload.get("tipo"))
        if payload.get("tipo") and not tipo:
            return _bad_request(f"Tipo inválido. Use: {', '.join(FeriadoTipo.ALL)}")
        if tipo:
            feriado.tipo = tipo

    if "bloqueia_agendamento" in payload:
        bloqueia = _normalize_bool(payload.get("bloqueia_agendamento"))
        if bloqueia is not None:
            feriado.bloqueia_agendamento = bloqueia

    if "recorrente" in payload:
        recorrente = _normalize_bool(payload.get("recorrente"))
        if recorrente is not None:
            feriado.recorrente = recorrente

    if "observacoes" in payload:
        feriado.observacoes = _normalize_text(payload.get("observacoes"))

    if "ativo" in payload:
        ativo = _normalize_bool(payload.get("ativo"))
        if ativo is not None:
            feriado.ativo = ativo

    try:
        db.session.commit()
        return jsonify({
            "message": "Feriado atualizado com sucesso",
            "feriado": feriado.to_dict(),
        }), 200
    except IntegrityError:
        db.session.rollback()
        return _bad_request("Já existe um feriado com essa data e nome.")
    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao atualizar feriado customizado")
        return jsonify({"error": str(exc)}), 500


@feriados_bp.route("/feriados/customizados/<int:feriado_id>", methods=["DELETE"])
def delete_custom_holiday(feriado_id: int):
    """
    Remove feriado customizado (soft delete).

    Query param:
    - hard: true para deletar permanentemente
    """
    feriado = FeriadoCustomizado.query.get(feriado_id)
    if not feriado:
        return _not_found()

    hard_delete = _normalize_bool(request.args.get("hard")) or False

    try:
        if hard_delete:
            db.session.delete(feriado)
            msg = "Feriado removido permanentemente"
        else:
            feriado.ativo = False
            msg = "Feriado desativado com sucesso"

        db.session.commit()
        return jsonify({"message": msg}), 200
    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao remover feriado customizado")
        return jsonify({"error": str(exc)}), 500


# =============================================================================
# Rota de utilidade: próximo dia útil
# =============================================================================


@feriados_bp.route("/feriados/proximo-dia-util", methods=["GET"])
def next_business_day():
    """
    Retorna o próximo dia útil a partir de uma data.

    Query params:
    - data: Data de referência (default: hoje)
    """
    data_raw = request.args.get("data", "hoje")
    from_date, err = _parse_date(data_raw)
    if err:
        return _bad_request(err)

    service = BrazilianHolidaysService()
    next_day = service.get_next_business_day(from_date)

    return jsonify({
        "data_referencia": from_date.isoformat(),
        "proximo_dia_util": next_day.isoformat(),
        "dias_ate": (next_day - from_date).days,
    }), 200
