# app/control/expenses_controller.py
"""
Controller para despesas da clínica.

CRUD completo com validação robusta, filtros avançados e
marcação de pagamento em lote.

Princípios:
- DRY: helpers reutilizáveis (validators.py + locais)
- KISS: endpoints focados e claros
- SRP: cada endpoint com responsabilidade única
- Left-guard / early-return em toda validação
"""

from __future__ import annotations

import traceback
from datetime import date, datetime, time, timedelta
from typing import Any

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.companies_model import Empresas
from app.models.expenses_model import Despesas
from app.models.suppliers_model import Fornecedores
from app.utils.timezone import get_today_sao_paulo
from app.utils.validators import (
    normalize_float,
    normalize_string,
    only_digits,
    parse_bool,
    parse_date,
)

despesas_bp = Blueprint("despesas", __name__)


# ============================================
# Constantes de domínio
# ============================================

CATEGORIAS = frozenset(
    {
        "PESSOAL",
        "ALUGUEL_INFRAESTRUTURA",
        "MATERIAIS_INSUMOS",
        "EQUIPAMENTOS",
        "SERVICOS_TERCEIRIZADOS",
        "UTILIDADES",
        "IMPOSTOS_TAXAS",
        "MARKETING",
        "MANUTENCAO",
        "SEGUROS",
        "EDUCACAO_TREINAMENTO",
        "ADMINISTRATIVO",
        "OUTROS",
    }
)

TIPOS_CUSTO = frozenset({"FIXO", "VARIAVEL"})

CENTROS_CUSTO = frozenset(
    {
        "ADMINISTRATIVO",
        "CLINICO",
        "SERVICOS_TERCEIRIZADOS",
        "LABORATORIO",
        "FARMACIA",
        "IMAGEM",
        "RECEPCAO",
        "LIMPEZA",
        "TI",
        "GERAL",
    }
)

STATUS_VALIDOS = frozenset({"PENDENTE", "PAGA", "CANCELADA", "ATRASADA", "PARCIAL"})

RECORRENCIAS = frozenset({"UNICA", "MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"})

FORMAS_PAGAMENTO = frozenset(
    {
        "PIX",
        "BOLETO",
        "DEBITO_AUTOMATICO",
        "TRANSFERENCIA",
        "CARTAO_CREDITO",
        "CARTAO_DEBITO",
        "DINHEIRO",
        "CHEQUE",
    }
)

TIPOS_DOCUMENTO = frozenset(
    {"NOTA_FISCAL", "BOLETO", "RECIBO", "FATURA", "GUIA", "OUTROS"}
)

# ── Filtros intuitivos ──────────────────────────────────────────────
TIPOS_DATA = frozenset({"competencia", "vencimento", "pagamento", "criacao"})

SITUACOES = frozenset({"pagas", "pendentes", "atrasadas", "vencendo", "canceladas"})

REQUIRED_FIELDS_CREATE = {
    "descricao",
    "categoria",
    "valor",
    "data_vencimento",
    "data_competencia",
}


# ============================================
# Helpers gerais
# ============================================


def _coerce_int(value: Any) -> int | None:
    """Converte value em int; vazio → None; inválido → ValueError."""
    if value is None or value == "":
        return None
    return int(value)


def _normalize_upper(value: Any) -> str | None:
    """Strip + uppercase; vazio → None."""
    if value in (None, ""):
        return None
    return str(value).strip().upper()


def _get_month_range(mes: int, ano: int) -> tuple[date, date]:
    """Retorna [primeiro_dia_mes, primeiro_dia_proximo_mes)."""
    inicio = date(ano, mes, 1)
    fim = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)
    return inicio, fim


def _apply_month_year_filter(query, mes: int, ano: int, tipo_data: str):
    """
    Filtra a query pelo mês/ano sobre a coluna de data escolhida.

    tipo_data: 'competencia' (default) | 'vencimento' | 'pagamento' | 'criacao'
    """
    inicio, fim = _get_month_range(mes, ano)

    if tipo_data == "criacao":
        return query.filter(
            Despesas.created_at >= datetime.combine(inicio, time.min),
            Despesas.created_at < datetime.combine(fim, time.min),
        )

    date_columns = {
        "competencia": Despesas.data_competencia,
        "vencimento": Despesas.data_vencimento,
        "pagamento": Despesas.data_pagamento,
    }
    col = date_columns.get(tipo_data, Despesas.data_competencia)

    if tipo_data == "pagamento":
        # data_pagamento é nullable: ignorar despesas não pagas
        return query.filter(col.isnot(None), col >= inicio, col < fim)

    return query.filter(col >= inicio, col < fim)


def _apply_situacao_filter(query, situacao: str):
    """
    Aplica filtro intuitivo de situação.

    - pagas:       status == PAGA
    - pendentes:   PENDENTE com vencimento >= hoje (não atrasada)
    - atrasadas:   PENDENTE/ATRASADA com vencimento < hoje
    - vencendo:    PENDENTE com vencimento entre hoje e hoje+7
    - canceladas:  status == CANCELADA
    """
    sit = (situacao or "").strip().lower()
    if sit not in SITUACOES:
        return query

    hoje = get_today_sao_paulo()

    if sit == "pagas":
        return query.filter(Despesas.status == "PAGA")
    if sit == "pendentes":
        return query.filter(
            Despesas.status == "PENDENTE",
            Despesas.data_vencimento >= hoje,
        )
    if sit == "atrasadas":
        return query.filter(
            Despesas.status.in_(["PENDENTE", "ATRASADA"]),
            Despesas.data_vencimento < hoje,
        )
    if sit == "vencendo":
        return query.filter(
            Despesas.status == "PENDENTE",
            Despesas.data_vencimento >= hoje,
            Despesas.data_vencimento <= hoje + timedelta(days=7),
        )
    # canceladas
    return query.filter(Despesas.status == "CANCELADA")


def _apply_creation_date_range(query, dc_ini: date | None, dc_fim: date | None):
    """Filtra pela data de criação (cadastro)."""
    if dc_ini:
        query = query.filter(Despesas.created_at >= datetime.combine(dc_ini, time.min))
    if dc_fim:
        query = query.filter(
            Despesas.created_at < datetime.combine(dc_fim + timedelta(days=1), time.min)
        )
    return query


# ============================================
# Helpers de validação / aplicação de payload
# ============================================


def _validate_payload(
    data: dict,
    *,
    is_update: bool = False,
    despesa: Despesas | None = None,
) -> tuple[bool, str | None, int | None]:
    """Valida payload de create/update. Retorna (ok, msg, status_code)."""
    if not isinstance(data, dict):
        return False, "JSON inválido", 400

    if not is_update:
        missing = [f for f in REQUIRED_FIELDS_CREATE if data.get(f) in (None, "")]
        if missing:
            return (
                False,
                f"Campos obrigatórios faltando: {', '.join(missing)}",
                400,
            )

    if cat := _normalize_upper(data.get("categoria")):
        if cat not in CATEGORIAS:
            return (
                False,
                f"Categoria inválida. Use: {', '.join(sorted(CATEGORIAS))}",
                400,
            )

    if tc := _normalize_upper(data.get("tipo_custo")):
        if tc not in TIPOS_CUSTO:
            return False, "tipo_custo inválido. Use: FIXO ou VARIAVEL", 400

    if cc := _normalize_upper(data.get("centro_custo")):
        if cc not in CENTROS_CUSTO:
            return (
                False,
                f"centro_custo inválido. Use: {', '.join(sorted(CENTROS_CUSTO))}",
                400,
            )

    if "valor" in data and data.get("valor") is not None:
        try:
            v = float(data["valor"])
            if v <= 0:
                return False, "Valor deve ser maior que 0", 400
        except (ValueError, TypeError):
            return False, "Valor inválido", 400

    for campo_num in ("valor_desconto", "valor_juros_multa", "valor_pago"):
        if campo_num in data and data.get(campo_num) not in (None, ""):
            v = normalize_float(data[campo_num])
            if v is None or v < 0:
                return False, f"{campo_num} inválido", 400

    for campo in ("data_vencimento", "data_competencia", "data_pagamento"):
        if data.get(campo) and not parse_date(data[campo]):
            return (
                False,
                f"{campo}: formato inválido. Use AAAA-MM-DD ou DD/MM/AAAA",
                400,
            )

    if st := _normalize_upper(data.get("status")):
        if st not in STATUS_VALIDOS:
            return (
                False,
                f"Status inválido. Use: {', '.join(sorted(STATUS_VALIDOS))}",
                400,
            )

    if rec := _normalize_upper(data.get("recorrencia")):
        if rec not in RECORRENCIAS:
            return (
                False,
                f"Recorrência inválida. Use: {', '.join(sorted(RECORRENCIAS))}",
                400,
            )

    if fp := _normalize_upper(data.get("forma_pagamento")):
        if fp not in FORMAS_PAGAMENTO:
            return (
                False,
                (
                    "Forma de pagamento inválida. Use: "
                    f"{', '.join(sorted(FORMAS_PAGAMENTO))}"
                ),
                400,
            )

    if td := _normalize_upper(data.get("tipo_documento")):
        if td not in TIPOS_DOCUMENTO:
            return (
                False,
                (
                    "Tipo de documento inválido. Use: "
                    f"{', '.join(sorted(TIPOS_DOCUMENTO))}"
                ),
                400,
            )

    for campo_id, model, label in (
        ("fornecedor_id", Fornecedores, "Fornecedor"),
        ("empresa_id", Empresas, "Empresa"),
        ("despesa_pai_id", Despesas, "Despesa pai"),
    ):
        if campo_id in data and data.get(campo_id) not in (None, ""):
            try:
                vid = _coerce_int(data[campo_id])
            except (ValueError, TypeError):
                return False, f"{campo_id} inválido", 400
            if vid and not model.query.get(vid):
                return False, f"{label} não encontrado(a)", 404

    return True, None, None


def _apply_despesa_fields(d: Despesas, data: dict, *, is_create: bool = False) -> None:
    """Aplica campos do payload na instância de Despesas."""
    if is_create or "descricao" in data:
        d.descricao = normalize_string(data.get("descricao")) or d.descricao

    if is_create or "observacoes" in data:
        d.observacoes = normalize_string(data.get("observacoes"))

    if is_create or "categoria" in data:
        d.categoria = _normalize_upper(data.get("categoria")) or d.categoria

    if is_create or "tipo_custo" in data:
        if tc := _normalize_upper(data.get("tipo_custo")):
            d.tipo_custo = tc

    if "centro_custo" in data:
        d.centro_custo = _normalize_upper(data.get("centro_custo"))

    if is_create or "valor" in data:
        if (v := normalize_float(data.get("valor"))) is not None:
            d.valor = v

    if "valor_desconto" in data:
        d.valor_desconto = normalize_float(data.get("valor_desconto"))

    if "valor_juros_multa" in data:
        d.valor_juros_multa = normalize_float(data.get("valor_juros_multa"))

    if "valor_pago" in data:
        d.valor_pago = normalize_float(data.get("valor_pago"))

    if is_create or "data_competencia" in data:
        if dt := parse_date(data.get("data_competencia")):
            d.data_competencia = dt

    if is_create or "data_vencimento" in data:
        if dt := parse_date(data.get("data_vencimento")):
            d.data_vencimento = dt

    if "data_pagamento" in data:
        d.data_pagamento = parse_date(data.get("data_pagamento"))

    if "status" in data:
        if st := _normalize_upper(data.get("status")):
            d.status = st

    if is_create or "recorrencia" in data:
        if rec := _normalize_upper(data.get("recorrencia")):
            d.recorrencia = rec

    if "despesa_pai_id" in data:
        d.despesa_pai_id = _coerce_int(data.get("despesa_pai_id"))

    if "forma_pagamento" in data:
        d.forma_pagamento = _normalize_upper(data.get("forma_pagamento"))

    if "conta_saida" in data:
        d.conta_saida = normalize_string(data.get("conta_saida"))

    if "fornecedor_id" in data:
        d.fornecedor_id = _coerce_int(data.get("fornecedor_id"))

    if "fornecedor_nome" in data:
        d.fornecedor_nome = normalize_string(data.get("fornecedor_nome"))

    if "fornecedor_cnpj_cpf" in data:
        d.fornecedor_cnpj_cpf = only_digits(data.get("fornecedor_cnpj_cpf")) or None

    if "numero_documento" in data:
        d.numero_documento = normalize_string(data.get("numero_documento"))

    if "tipo_documento" in data:
        d.tipo_documento = _normalize_upper(data.get("tipo_documento"))

    if "empresa_id" in data:
        d.empresa_id = _coerce_int(data.get("empresa_id"))


def _despesa_to_dict(d: Despesas) -> dict:
    """Wrapper para serialização consistente."""
    return d.to_dict()


# ============================================
# GET - Listar despesas com filtros + paginação
# ============================================
@despesas_bp.route("/despesas", methods=["GET"])
def get_despesas():
    """
    Lista despesas com filtros avançados.

    Query params principais:
      - search: busca textual (descricao/fornecedor/documento/observacoes)
      - mes (1-12), ano (yyyy), tipo_data (competencia|vencimento|pagamento|criacao)
      - situacao (pagas|pendentes|atrasadas|vencendo|canceladas)
      - categoria, tipo_custo, centro_custo, status
      - recorrencia, forma_pagamento
      - data_vencimento_inicio/fim, data_competencia_inicio/fim
      - data_pagamento_inicio/fim, data_criacao_inicio/fim
      - fornecedor_id, empresa_id, valor_min, valor_max
      - vencidas (legado): apenas PENDENTE com vencimento < hoje
      - limit, offset, order
    """
    try:
        query = Despesas.query

        # Busca textual
        if search := request.args.get("search"):
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Despesas.descricao.ilike(s),
                    Despesas.fornecedor_nome.ilike(s),
                    Despesas.numero_documento.ilike(s),
                    Despesas.observacoes.ilike(s),
                )
            )

        # ── NOVO: filtro mês/ano por tipo de data ─────────────────
        mes = request.args.get("mes", type=int)
        ano = request.args.get("ano", type=int)
        tipo_data = (request.args.get("tipo_data") or "competencia").strip().lower()
        if mes and ano and 1 <= mes <= 12 and tipo_data in TIPOS_DATA:
            query = _apply_month_year_filter(query, mes, ano, tipo_data)

        # ── NOVO: filtro intuitivo de situação ────────────────────
        if sit := request.args.get("situacao"):
            query = _apply_situacao_filter(query, sit)

        # Classificação
        if cat := request.args.get("categoria"):
            query = query.filter(Despesas.categoria == cat.strip().upper())
        if tc := request.args.get("tipo_custo"):
            query = query.filter(Despesas.tipo_custo == tc.strip().upper())
        if cc := request.args.get("centro_custo"):
            query = query.filter(Despesas.centro_custo == cc.strip().upper())
        if st := request.args.get("status"):
            query = query.filter(Despesas.status == st.strip().upper())
        if rec := request.args.get("recorrencia"):
            query = query.filter(Despesas.recorrencia == rec.strip().upper())
        if fp := request.args.get("forma_pagamento"):
            query = query.filter(Despesas.forma_pagamento == fp.strip().upper())

        # Datas - vencimento
        if dv_ini := parse_date(request.args.get("data_vencimento_inicio")):
            query = query.filter(Despesas.data_vencimento >= dv_ini)
        if dv_fim := parse_date(request.args.get("data_vencimento_fim")):
            query = query.filter(Despesas.data_vencimento <= dv_fim)

        # Datas - competência
        if dc_ini := parse_date(request.args.get("data_competencia_inicio")):
            query = query.filter(Despesas.data_competencia >= dc_ini)
        if dc_fim := parse_date(request.args.get("data_competencia_fim")):
            query = query.filter(Despesas.data_competencia <= dc_fim)

        # Datas - pagamento
        if dp_ini := parse_date(request.args.get("data_pagamento_inicio")):
            query = query.filter(Despesas.data_pagamento >= dp_ini)
        if dp_fim := parse_date(request.args.get("data_pagamento_fim")):
            query = query.filter(Despesas.data_pagamento <= dp_fim)

        # ── NOVO: datas - cadastro (created_at) ───────────────────
        query = _apply_creation_date_range(
            query,
            parse_date(request.args.get("data_criacao_inicio")),
            parse_date(request.args.get("data_criacao_fim")),
        )

        # Entidades
        if fid := request.args.get("fornecedor_id"):
            query = query.filter(Despesas.fornecedor_id == int(fid))
        if eid := request.args.get("empresa_id"):
            query = query.filter(Despesas.empresa_id == int(eid))

        # Valor
        if vmin := normalize_float(request.args.get("valor_min")):
            query = query.filter(Despesas.valor >= vmin)
        if vmax := normalize_float(request.args.get("valor_max")):
            query = query.filter(Despesas.valor <= vmax)

        # Vencidas (legado - mantido por compatibilidade)
        if parse_bool(request.args.get("vencidas")):
            hoje = get_today_sao_paulo()
            query = query.filter(
                Despesas.status == "PENDENTE",
                Despesas.data_vencimento < hoje,
            )

        # Ordenação
        order = (request.args.get("order") or "vencimento_desc").lower()
        order_map = {
            "vencimento_asc": (Despesas.data_vencimento.asc(), Despesas.id.asc()),
            "valor_desc": (Despesas.valor.desc(), Despesas.id.desc()),
            "valor_asc": (Despesas.valor.asc(), Despesas.id.asc()),
            "competencia_desc": (
                Despesas.data_competencia.desc(),
                Despesas.id.desc(),
            ),
            "competencia_asc": (
                Despesas.data_competencia.asc(),
                Despesas.id.asc(),
            ),
            "criacao_desc": (Despesas.created_at.desc(), Despesas.id.desc()),
            "criacao_asc": (Despesas.created_at.asc(), Despesas.id.asc()),
        }
        query = query.order_by(
            *order_map.get(
                order,
                (Despesas.data_vencimento.desc(), Despesas.id.desc()),
            )
        )

        # Paginação
        limit = request.args.get("limit", type=int)
        offset = request.args.get("offset", type=int)
        if offset is not None and offset >= 0:
            query = query.offset(offset)
        if limit is not None and limit > 0:
            query = query.limit(limit)

        despesas = query.all()
        return jsonify([_despesa_to_dict(d) for d in despesas])

    except Exception as exc:
        current_app.logger.error(
            "[Despesas] Erro ao listar: %s\n%s", exc, traceback.format_exc()
        )
        return jsonify({"error": "Erro ao listar despesas"}), 500


# ============================================
# GET - Buscar despesa por ID
# ============================================
@despesas_bp.route("/despesas/<int:id>", methods=["GET"])
def get_despesa_by_id(id: int):
    """Retorna uma despesa específica pelo ID."""
    try:
        d = Despesas.query.get(id)
        if not d:
            return jsonify({"error": "Despesa não encontrada"}), 404
        return jsonify(_despesa_to_dict(d))
    except Exception as exc:
        current_app.logger.error(
            "[Despesas] Erro ao buscar %s: %s", id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar despesa"}), 500


# ============================================
# POST - Criar despesa
# ============================================
@despesas_bp.route("/despesas", methods=["POST"])
def create_despesa():
    """Cria uma nova despesa."""
    try:
        data = request.json or {}

        ok, msg, status = _validate_payload(data, is_update=False)
        if not ok:
            return jsonify({"error": msg}), status

        nova = Despesas()
        _apply_despesa_fields(nova, data, is_create=True)

        if not data.get("status"):
            hoje = get_today_sao_paulo()
            nova.status = (
                "ATRASADA"
                if nova.data_vencimento and nova.data_vencimento < hoje
                else "PENDENTE"
            )

        db.session.add(nova)
        db.session.commit()

        return (
            jsonify({"message": "Despesa criada", "despesa": _despesa_to_dict(nova)}),
            201,
        )

    except IntegrityError as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Despesas] Integridade: %s", getattr(exc, "orig", exc), exc_info=True
        )
        return jsonify({"error": "Erro de integridade no banco de dados"}), 409
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Despesas] Erro ao criar: %s\n%s", exc, traceback.format_exc()
        )
        return jsonify({"error": "Erro interno no servidor"}), 500


# ============================================
# PUT - Atualizar despesa
# ============================================
@despesas_bp.route("/despesas/<int:id>", methods=["PUT"])
def update_despesa(id: int):
    """Atualiza uma despesa existente."""
    try:
        d = Despesas.query.get(id)
        if not d:
            return jsonify({"error": "Despesa não encontrada"}), 404

        data = request.json or {}

        ok, msg, status = _validate_payload(data, is_update=True, despesa=d)
        if not ok:
            return jsonify({"error": msg}), status

        _apply_despesa_fields(d, data, is_create=False)
        db.session.commit()

        return jsonify(
            {"message": "Despesa atualizada", "despesa": _despesa_to_dict(d)}
        )

    except IntegrityError as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Despesas] Integridade update: %s",
            getattr(exc, "orig", exc),
            exc_info=True,
        )
        return jsonify({"error": "Erro de integridade no banco de dados"}), 409
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Despesas] Erro ao atualizar %s: %s\n%s",
            id,
            exc,
            traceback.format_exc(),
        )
        return jsonify({"error": "Erro ao atualizar despesa"}), 500


# ============================================
# DELETE - Excluir despesa
# ============================================
@despesas_bp.route("/despesas/<int:id>", methods=["DELETE"])
def delete_despesa(id: int):
    """Exclui uma despesa pelo ID."""
    try:
        d = Despesas.query.get(id)
        if not d:
            return jsonify({"error": "Despesa não encontrada"}), 404
        db.session.delete(d)
        db.session.commit()
        return jsonify({"message": "Despesa excluída com sucesso"})
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Despesas] Erro ao excluir %s: %s\n%s",
            id,
            exc,
            traceback.format_exc(),
        )
        return jsonify({"error": "Erro ao excluir despesa"}), 500


# ============================================
# PATCH - Marcar despesa como paga
# ============================================
@despesas_bp.route("/despesas/<int:id>/pagar", methods=["PATCH"])
def marcar_como_paga(id: int):
    """Marca despesa como paga."""
    try:
        d = Despesas.query.get(id)
        if not d:
            return jsonify({"error": "Despesa não encontrada"}), 404
        if d.status == "PAGA":
            return jsonify({"error": "Despesa já está paga"}), 409
        if d.status == "CANCELADA":
            return jsonify({"error": "Não é possível pagar despesa cancelada"}), 409

        data = request.json or {}
        hoje = get_today_sao_paulo()

        if "valor_juros_multa" in data:
            d.valor_juros_multa = normalize_float(data["valor_juros_multa"])
        if "valor_desconto" in data:
            d.valor_desconto = normalize_float(data["valor_desconto"])

        d.data_pagamento = parse_date(data.get("data_pagamento")) or hoje
        d.valor_pago = normalize_float(data.get("valor_pago")) or d.valor_liquido
        d.status = "PAGA"

        if fp := _normalize_upper(data.get("forma_pagamento")):
            d.forma_pagamento = fp
        if cs := normalize_string(data.get("conta_saida")):
            d.conta_saida = cs

        db.session.commit()

        return jsonify(
            {"message": "Despesa marcada como paga", "despesa": _despesa_to_dict(d)}
        )

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Despesas] Erro ao pagar %s: %s", id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao marcar despesa como paga"}), 500


# ============================================
# PATCH - Marcar despesas como paga em lote
# ============================================
@despesas_bp.route("/despesas/pagar-lote", methods=["PATCH"])
def marcar_como_paga_lote():
    """Marca múltiplas despesas como pagas."""
    try:
        data = request.json or {}
        ids = data.get("ids")

        if not ids or not isinstance(ids, list):
            return jsonify({"error": "Informe uma lista de IDs"}), 400

        hoje = get_today_sao_paulo()
        dt_pagamento = parse_date(data.get("data_pagamento")) or hoje
        fp = _normalize_upper(data.get("forma_pagamento"))
        cs = normalize_string(data.get("conta_saida"))

        resultados = {"pagos": [], "erros": []}

        for despesa_id in ids:
            d = Despesas.query.get(despesa_id)
            if not d:
                resultados["erros"].append({"id": despesa_id, "erro": "Não encontrada"})
                continue
            if d.status in ("PAGA", "CANCELADA"):
                resultados["erros"].append(
                    {"id": despesa_id, "erro": f"Status atual: {d.status}"}
                )
                continue

            d.data_pagamento = dt_pagamento
            d.valor_pago = d.valor_liquido
            d.status = "PAGA"
            if fp:
                d.forma_pagamento = fp
            if cs:
                d.conta_saida = cs

            resultados["pagos"].append(despesa_id)

        db.session.commit()

        return jsonify(
            {
                "message": (
                    f"{len(resultados['pagos'])} despesa(s) marcada(s) como paga(s)"
                ),
                "resultados": resultados,
            }
        )

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Despesas] Erro em pagar-lote: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao processar pagamento em lote"}), 500


# ============================================
# PATCH - Cancelar despesa
# ============================================
@despesas_bp.route("/despesas/<int:id>/cancelar", methods=["PATCH"])
def cancelar_despesa(id: int):
    """Cancela uma despesa."""
    try:
        d = Despesas.query.get(id)
        if not d:
            return jsonify({"error": "Despesa não encontrada"}), 404
        if d.status == "CANCELADA":
            return jsonify({"error": "Despesa já está cancelada"}), 409
        if d.status == "PAGA":
            return (
                jsonify(
                    {
                        "error": (
                            "Não é possível cancelar despesa já paga. "
                            "Estorne primeiro."
                        )
                    }
                ),
                409,
            )

        motivo = normalize_string((request.json or {}).get("motivo"))
        if motivo:
            obs_atual = d.observacoes or ""
            d.observacoes = f"{obs_atual}\n[CANCELADA] {motivo}".strip()

        d.status = "CANCELADA"
        db.session.commit()

        return jsonify({"message": "Despesa cancelada", "despesa": _despesa_to_dict(d)})

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Despesas] Erro ao cancelar %s: %s", id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao cancelar despesa"}), 500


# ============================================
# GET - Resumo mensal de despesas
# ============================================
@despesas_bp.route("/despesas/resumo", methods=["GET"])
def get_resumo_despesas():
    """
    Resumo mensal para dashboards.

    Query params:
      - mes (1-12), ano (yyyy)  → obrigatórios
      - tipo_data: competencia (default) | vencimento | pagamento | criacao

    Importante:
      Todas as somas usam `valor_efetivo`, isto é:
        - PAGA com valor_pago: usa valor_pago (real, inclui juros/desconto)
        - Caso contrário: valor + juros − desconto (líquido estimado)
      Isso garante que totais reflitam o que de fato saiu do caixa.
    """
    try:
        mes = request.args.get("mes", type=int)
        ano = request.args.get("ano", type=int)
        tipo_data = (request.args.get("tipo_data") or "competencia").strip().lower()

        if not mes or not (1 <= mes <= 12) or not ano:
            return jsonify({"error": "Informe mes (1-12) e ano"}), 400
        if tipo_data not in TIPOS_DATA:
            return (
                jsonify(
                    {
                        "error": (
                            "tipo_data inválido. "
                            f"Use: {', '.join(sorted(TIPOS_DATA))}"
                        )
                    }
                ),
                400,
            )

        ve = Despesas.valor_efetivo_sql()

        base = _apply_month_year_filter(
            Despesas.query.filter(Despesas.status != "CANCELADA"),
            mes,
            ano,
            tipo_data,
        )

        # Base completa (com CANCELADA) só para "por_status"
        base_total = _apply_month_year_filter(Despesas.query, mes, ano, tipo_data)

        # Totais (tudo com valor_efetivo)
        total = float(base.with_entities(func.coalesce(func.sum(ve), 0)).scalar() or 0)
        total_pago = float(
            base.filter(Despesas.status == "PAGA")
            .with_entities(func.coalesce(func.sum(ve), 0))
            .scalar()
            or 0
        )
        total_pendente = float(
            base.filter(Despesas.status == "PENDENTE")
            .with_entities(func.coalesce(func.sum(ve), 0))
            .scalar()
            or 0
        )
        total_atrasado = float(
            base.filter(Despesas.status == "ATRASADA")
            .with_entities(func.coalesce(func.sum(ve), 0))
            .scalar()
            or 0
        )

        # PENDENTE com vencimento já vencido vira "atrasada real"
        if tipo_data in ("competencia", "criacao"):
            hoje = get_today_sao_paulo()
            atrasadas_real = float(
                base.filter(
                    Despesas.status == "PENDENTE",
                    Despesas.data_vencimento < hoje,
                )
                .with_entities(func.coalesce(func.sum(ve), 0))
                .scalar()
                or 0
            )
            total_atrasado += atrasadas_real
            total_pendente = max(0.0, total_pendente - atrasadas_real)

        # Por categoria
        por_categoria = (
            base.with_entities(
                Despesas.categoria,
                func.sum(ve).label("total"),
                func.count(Despesas.id).label("quantidade"),
            )
            .group_by(Despesas.categoria)
            .order_by(func.sum(ve).desc())
            .all()
        )

        # Por tipo de custo
        por_tipo_custo = (
            base.with_entities(
                Despesas.tipo_custo,
                func.sum(ve).label("total"),
            )
            .group_by(Despesas.tipo_custo)
            .all()
        )

        # Por centro de custo
        por_centro_custo = (
            base.filter(Despesas.centro_custo.isnot(None))
            .with_entities(
                Despesas.centro_custo,
                func.sum(ve).label("total"),
                func.count(Despesas.id).label("quantidade"),
            )
            .group_by(Despesas.centro_custo)
            .order_by(func.sum(ve).desc())
            .all()
        )

        # Por status (inclui canceladas)
        por_status = (
            base_total.with_entities(
                Despesas.status,
                func.sum(ve).label("total"),
                func.count(Despesas.id).label("quantidade"),
            )
            .group_by(Despesas.status)
            .all()
        )

        return jsonify(
            {
                "mes": mes,
                "ano": ano,
                "tipo_data": tipo_data,
                "total": total,
                "total_pago": total_pago,
                "total_pendente": total_pendente,
                "total_atrasado": total_atrasado,
                "por_categoria": [
                    {
                        "categoria": c.categoria,
                        "total": float(c.total or 0),
                        "quantidade": c.quantidade,
                    }
                    for c in por_categoria
                ],
                "por_tipo_custo": [
                    {"tipo_custo": t.tipo_custo, "total": float(t.total or 0)}
                    for t in por_tipo_custo
                ],
                "por_centro_custo": [
                    {
                        "centro_custo": cc.centro_custo,
                        "total": float(cc.total or 0),
                        "quantidade": cc.quantidade,
                    }
                    for cc in por_centro_custo
                ],
                "por_status": [
                    {
                        "status": s.status,
                        "total": float(s.total or 0),
                        "quantidade": s.quantidade,
                    }
                    for s in por_status
                ],
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[Despesas] Erro resumo: %s\n%s", exc, traceback.format_exc()
        )
        return jsonify({"error": "Erro ao gerar resumo"}), 500


# ============================================
# GET - Enums disponíveis (para selects do frontend)
# ============================================
@despesas_bp.route("/despesas/enums", methods=["GET"])
def get_despesa_enums():
    """Retorna listas de valores válidos para selects do frontend."""
    return jsonify(
        {
            "categorias": sorted(CATEGORIAS),
            "tipos_custo": sorted(TIPOS_CUSTO),
            "centros_custo": sorted(CENTROS_CUSTO),
            "status": sorted(STATUS_VALIDOS),
            "recorrencias": sorted(RECORRENCIAS),
            "formas_pagamento": sorted(FORMAS_PAGAMENTO),
            "tipos_documento": sorted(TIPOS_DOCUMENTO),
            "tipos_data": sorted(TIPOS_DATA),
            "situacoes": sorted(SITUACOES),
        }
    )
