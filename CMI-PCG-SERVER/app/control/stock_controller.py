"""
Controller de controle de estoque.

Endpoints - Movimentações:
    POST   /estoque/entrada          → Registrar entrada
    POST   /estoque/dispensacao       → Dispensar a paciente (FEFO automático)
    POST   /estoque/dispensacao/lote  → Dispensar de lote específico
    POST   /estoque/ajuste            → Ajuste de inventário
    POST   /estoque/descarte          → Registrar descarte
    GET    /estoque/movimentacoes     → Histórico de movimentações

Endpoints - Consultas:
    GET    /estoque/alertas           → Alertas ativos
    GET    /estoque/dashboard         → Dashboard consolidado
    GET    /estoque/vencimentos       → Medicamentos por faixa de validade
    GET    /estoque/dispensacoes/paciente/<cpf> → Histórico de dispensação
"""

from __future__ import annotations

from dataclasses import asdict

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_

from app.database import db
from app.models.medication_batches_model import (
    COR_LARANJA,
    COR_VERDE,
    COR_VERMELHO,
    COR_VENCIDO,
    MedicamentoLotes,
)
from app.models.medications_model import Medicamentos
from app.models.stock_movements_model import (
    MOTIVOS_DESCARTE,
    TIPOS_MOVIMENTACAO,
    MovimentacoesEstoque,
)
from app.src.stock_service import (
    EstoqueError,
    EstoqueInsuficienteError,
    LoteInativoError,
    LoteVencidoError,
    MedicamentoControladoError,
    stock_service,
)
from app.utils.responses import get_pagination, json_error, json_success
from app.utils.timezone import get_today_sao_paulo

estoque_bp = Blueprint("estoque", __name__)


# ── Helpers locais ───────────────────────────────────────────────────────


def _normalize(value: str | None) -> str | None:
    """Normaliza string (strip + None se vazio)."""
    if not value:
        return None
    v = str(value).strip()
    return v if v else None


def _safe_int(value, *, default: int | None = None) -> int | None:
    """Converte para int com fallback."""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _only_digits(value: str | None) -> str:
    """Remove tudo que não é dígito."""
    if not value:
        return ""
    return "".join(c for c in str(value) if c.isdigit())


def _clean_cpf(cpf_raw: str) -> str:
    """Limpa e valida CPF (11 dígitos)."""
    digits = _only_digits(cpf_raw)
    if len(digits) != 11:
        raise ValueError("CPF deve ter 11 dígitos")
    return digits


def _parse_date(value: str | None):
    """Parse de data nos formatos YYYY-MM-DD ou DD/MM/YYYY."""
    if not value:
        return None
    from datetime import date as dt_date

    v = str(value).strip()
    try:
        return dt_date.fromisoformat(v)
    except ValueError:
        pass
    try:
        parts = v.split("/")
        if len(parts) == 3:
            return dt_date(int(parts[2]), int(parts[1]), int(parts[0]))
    except (ValueError, IndexError):
        pass
    return None


# ══════════════════════════════════════════════════════════════════════════
# MOVIMENTAÇÕES
# ══════════════════════════════════════════════════════════════════════════


@estoque_bp.route("/estoque/entrada", methods=["POST"])
def registrar_entrada():
    """Registra entrada de medicamentos no estoque."""
    try:
        data = request.json or {}

        lote_id = _safe_int(data.get("lote_id"))
        quantidade = _safe_int(data.get("quantidade"))

        if not lote_id:
            return json_error("lote_id é obrigatório")
        if not quantidade or quantidade <= 0:
            return json_error("quantidade deve ser maior que zero")

        mov = stock_service.registrar_entrada(
            lote_id=lote_id,
            quantidade=quantidade,
            fornecedor_id=_safe_int(data.get("fornecedor_id")),
            nota_fiscal=_normalize(data.get("nota_fiscal")),
            observacoes=_normalize(data.get("observacoes")),
        )

        return json_success(
            "Entrada registrada com sucesso",
            data=mov.to_dict(),
            status_code=201,
        )

    except EstoqueError as exc:
        return json_error(str(exc))
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao registrar entrada: %s", exc, exc_info=True)
        return json_error("Erro ao registrar entrada", 500)


@estoque_bp.route("/estoque/dispensacao", methods=["POST"])
def dispensar_fefo():
    """
    Dispensa medicamento usando FEFO automático.

    Seleciona os lotes com validade mais próxima automaticamente.
    """
    try:
        data = request.json or {}

        medicamento_id = _safe_int(data.get("medicamento_id"))
        quantidade = _safe_int(data.get("quantidade"))
        cpf_raw = data.get("cpf_paciente")

        if not medicamento_id:
            return json_error("medicamento_id é obrigatório")
        if not quantidade or quantidade <= 0:
            return json_error("quantidade deve ser maior que zero")
        if not cpf_raw:
            return json_error("cpf_paciente é obrigatório")

        try:
            cpf = _clean_cpf(cpf_raw)
        except ValueError as exc:
            return json_error(str(exc))

        movimentacoes = stock_service.dispensar_fefo(
            medicamento_id=medicamento_id,
            quantidade=quantidade,
            cpf_paciente=cpf,
            consulta_id=_safe_int(data.get("consulta_id")),
            crm_medico_prescritor=_safe_int(data.get("crm_medico_prescritor")),
            observacoes=_normalize(data.get("observacoes")),
        )

        return json_success(
            f"Dispensação registrada com sucesso ({len(movimentacoes)} lote(s))",
            data=[m.to_dict() for m in movimentacoes],
            status_code=201,
        )

    except MedicamentoControladoError as exc:
        return json_error(str(exc))
    except EstoqueInsuficienteError as exc:
        return json_error(str(exc))
    except EstoqueError as exc:
        return json_error(str(exc))
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro na dispensação FEFO: %s", exc, exc_info=True)
        return json_error("Erro ao dispensar medicamento", 500)


@estoque_bp.route("/estoque/dispensacao/lote", methods=["POST"])
def dispensar_lote_especifico():
    """Dispensa de um lote específico (bypass FEFO)."""
    try:
        data = request.json or {}

        lote_id = _safe_int(data.get("lote_id"))
        quantidade = _safe_int(data.get("quantidade"))
        cpf_raw = data.get("cpf_paciente")

        if not lote_id:
            return json_error("lote_id é obrigatório")
        if not quantidade or quantidade <= 0:
            return json_error("quantidade deve ser maior que zero")
        if not cpf_raw:
            return json_error("cpf_paciente é obrigatório")

        try:
            cpf = _clean_cpf(cpf_raw)
        except ValueError as exc:
            return json_error(str(exc))

        mov = stock_service.registrar_dispensacao(
            lote_id=lote_id,
            quantidade=quantidade,
            cpf_paciente=cpf,
            consulta_id=_safe_int(data.get("consulta_id")),
            crm_medico_prescritor=_safe_int(data.get("crm_medico_prescritor")),
            observacoes=_normalize(data.get("observacoes")),
        )

        return json_success(
            "Dispensação registrada com sucesso",
            data=mov.to_dict(),
            status_code=201,
        )

    except (
        MedicamentoControladoError,
        LoteVencidoError,
        EstoqueInsuficienteError,
        LoteInativoError,
    ) as exc:
        return json_error(str(exc))
    except EstoqueError as exc:
        return json_error(str(exc))
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro na dispensação: %s", exc, exc_info=True)
        return json_error("Erro ao dispensar medicamento", 500)


@estoque_bp.route("/estoque/ajuste", methods=["POST"])
def registrar_ajuste():
    """Registra ajuste de inventário."""
    try:
        data = request.json or {}

        lote_id = _safe_int(data.get("lote_id"))
        quantidade = _safe_int(data.get("quantidade"))
        positivo = data.get("positivo", True)

        if not lote_id:
            return json_error("lote_id é obrigatório")
        if not quantidade or quantidade <= 0:
            return json_error("quantidade deve ser maior que zero")

        mov = stock_service.registrar_ajuste(
            lote_id=lote_id,
            quantidade=quantidade,
            positivo=bool(positivo),
            observacoes=_normalize(data.get("observacoes")),
        )

        return json_success(
            "Ajuste registrado com sucesso",
            data=mov.to_dict(),
            status_code=201,
        )

    except EstoqueError as exc:
        return json_error(str(exc))
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao registrar ajuste: %s", exc, exc_info=True)
        return json_error("Erro ao registrar ajuste", 500)


@estoque_bp.route("/estoque/descarte", methods=["POST"])
def registrar_descarte():
    """Registra descarte de medicamentos."""
    try:
        data = request.json or {}

        lote_id = _safe_int(data.get("lote_id"))
        quantidade = _safe_int(data.get("quantidade"))
        motivo = _normalize(data.get("motivo"))

        if not lote_id:
            return json_error("lote_id é obrigatório")
        if not quantidade or quantidade <= 0:
            return json_error("quantidade deve ser maior que zero")
        if not motivo or motivo.upper() not in MOTIVOS_DESCARTE:
            return json_error(
                f"Motivo de descarte obrigatório. Válidos: {', '.join(MOTIVOS_DESCARTE)}"
            )

        mov = stock_service.registrar_descarte(
            lote_id=lote_id,
            quantidade=quantidade,
            motivo=motivo.upper(),
            observacoes=_normalize(data.get("observacoes")),
        )

        return json_success(
            "Descarte registrado com sucesso",
            data=mov.to_dict(),
            status_code=201,
        )

    except EstoqueError as exc:
        return json_error(str(exc))
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao registrar descarte: %s", exc, exc_info=True)
        return json_error("Erro ao registrar descarte", 500)


# ══════════════════════════════════════════════════════════════════════════
# HISTÓRICO DE MOVIMENTAÇÕES
# ══════════════════════════════════════════════════════════════════════════


@estoque_bp.route("/estoque/movimentacoes", methods=["GET"])
def get_movimentacoes():
    """Histórico de movimentações com filtros."""
    try:
        query = MovimentacoesEstoque.query

        if tipo := request.args.get("tipo"):
            query = query.filter(MovimentacoesEstoque.tipo == tipo.strip().upper())

        if lote_id := _safe_int(request.args.get("lote_id")):
            query = query.filter(MovimentacoesEstoque.lote_id == lote_id)

        if medicamento_id := _safe_int(request.args.get("medicamento_id")):
            query = query.join(MedicamentoLotes).filter(
                MedicamentoLotes.medicamento_id == medicamento_id
            )

        if cpf := request.args.get("cpf_paciente"):
            cpf_digits = _only_digits(cpf).zfill(11)
            query = query.filter(MovimentacoesEstoque.cpf_paciente == cpf_digits)

        if data_inicio := _parse_date(request.args.get("data_inicio")):
            query = query.filter(MovimentacoesEstoque.data_movimentacao >= data_inicio)

        if data_fim := _parse_date(request.args.get("data_fim")):
            query = query.filter(MovimentacoesEstoque.data_movimentacao <= data_fim)

        query = query.order_by(MovimentacoesEstoque.id.desc())

        limit, offset = get_pagination()
        movimentacoes = query.limit(limit).offset(offset).all()

        return jsonify([m.to_dict() for m in movimentacoes])

    except Exception as exc:
        current_app.logger.error("Erro ao listar movimentações: %s", exc, exc_info=True)
        return json_error("Erro ao listar movimentações", 500)


# ══════════════════════════════════════════════════════════════════════════
# ALERTAS E DASHBOARD
# ══════════════════════════════════════════════════════════════════════════


@estoque_bp.route("/estoque/alertas", methods=["GET"])
def get_alertas():
    """Retorna alertas ativos do estoque."""
    try:
        alertas = stock_service.get_alertas()

        # Filtro opcional por tipo
        tipo_alerta = request.args.get("tipo")
        if tipo_alerta:
            alertas = [a for a in alertas if a.tipo_alerta == tipo_alerta.upper()]

        return jsonify(
            {
                "alertas": [asdict(a) for a in alertas],
                "total": len(alertas),
            }
        )

    except Exception as exc:
        current_app.logger.error("Erro ao gerar alertas: %s", exc, exc_info=True)
        return json_error("Erro ao gerar alertas", 500)


@estoque_bp.route("/estoque/dashboard", methods=["GET"])
def get_dashboard():
    """Dashboard consolidado do estoque."""
    try:
        dashboard = stock_service.get_dashboard()
        return jsonify(dashboard)

    except Exception as exc:
        current_app.logger.error("Erro ao gerar dashboard: %s", exc, exc_info=True)
        return json_error("Erro ao gerar dashboard", 500)


@estoque_bp.route("/estoque/vencimentos", methods=["GET"])
def get_vencimentos():
    """Lista medicamentos agrupados por faixa de validade (cor)."""
    try:
        lotes = (
            MedicamentoLotes.query.join(Medicamentos)
            .filter(
                MedicamentoLotes.ativo.is_(True),
                MedicamentoLotes.quantidade_atual > 0,
            )
            .order_by(MedicamentoLotes.data_validade.asc())
            .all()
        )

        resultado = {
            COR_VENCIDO: [],
            COR_VERMELHO: [],
            COR_LARANJA: [],
            COR_VERDE: [],
        }

        for lote in lotes:
            cor = lote.cor_validade
            resultado[cor].append(lote.to_dict())

        # Filtro por cor
        if cor_filtro := request.args.get("cor"):
            cor_upper = cor_filtro.strip().upper()
            if cor_upper in resultado:
                return jsonify(
                    {
                        "cor": cor_upper,
                        "lotes": resultado[cor_upper],
                        "total": len(resultado[cor_upper]),
                    }
                )

        return jsonify(
            {
                "por_cor": {
                    cor: {"lotes": lotes_list, "total": len(lotes_list)}
                    for cor, lotes_list in resultado.items()
                },
                "resumo": {
                    cor: len(lotes_list) for cor, lotes_list in resultado.items()
                },
            }
        )

    except Exception as exc:
        current_app.logger.error("Erro ao listar vencimentos: %s", exc, exc_info=True)
        return json_error("Erro ao listar vencimentos", 500)


@estoque_bp.route("/estoque/dispensacoes/paciente/<cpf>", methods=["GET"])
def get_dispensacoes_paciente(cpf: str):
    """Histórico de dispensações de um paciente."""
    try:

        cpf_digits = _only_digits(cpf).zfill(11)
        if len(cpf_digits) != 11:
            return json_error("CPF inválido")

        query = MovimentacoesEstoque.query.filter(
            MovimentacoesEstoque.tipo == "DISPENSACAO",
            MovimentacoesEstoque.cpf_paciente == cpf_digits,
        ).order_by(MovimentacoesEstoque.data_movimentacao.desc())

        limit, offset = get_pagination()
        movimentacoes = query.limit(limit).offset(offset).all()

        return jsonify(
            {
                "cpf_paciente": cpf_digits,
                "dispensacoes": [m.to_dict() for m in movimentacoes],
                "total": len(movimentacoes),
            }
        )

    except Exception as exc:
        current_app.logger.error("Erro ao listar dispensações: %s", exc, exc_info=True)
        return json_error("Erro ao listar dispensações", 500)
