"""
Controller de medicamentos e lotes.

Endpoints - Medicamentos (catálogo):
    GET    /medicamentos               → Listar (com filtros)
    GET    /medicamentos/<id>          → Buscar por ID (com lotes)
    POST   /medicamentos               → Criar
    PUT    /medicamentos/<id>          → Atualizar
    DELETE /medicamentos/<id>          → Desativar (soft delete)

Endpoints - Lotes:
    GET    /medicamentos/<id>/lotes    → Listar lotes de um medicamento
    POST   /medicamentos/<id>/lotes    → Criar novo lote
    PUT    /lotes/<id>                 → Atualizar lote
    GET    /lotes/barcode/<codigo>     → Buscar lote por código de barras

Endpoints auxiliares:
    GET    /medicamentos/classificacoes → Lista classificações ANVISA
    GET    /medicamentos/autocomplete   → Busca rápida
"""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.medication_batches_model import MedicamentoLotes
from app.models.medications_model import (
    CLASSIFICACOES_ANVISA,
    FORMAS_FARMACEUTICAS,
    UNIDADES_MEDIDA,
    Medicamentos,
)
from app.models.suppliers_model import Fornecedores
from app.utils.responses import get_pagination, json_error, json_success

medicamentos_bp = Blueprint("medicamentos", __name__)


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


def _safe_float(value) -> float | None:
    """Converte para float com fallback None."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _parse_bool(value) -> bool | None:
    """Converte para bool (True/False/None)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in ("true", "1", "sim", "yes"):
        return True
    if s in ("false", "0", "nao", "no"):
        return False
    return None


def _parse_date(value: str | None):
    """Parse de data nos formatos YYYY-MM-DD ou DD/MM/YYYY."""
    if not value:
        return None
    from datetime import date as dt_date

    v = str(value).strip()
    # ISO
    try:
        return dt_date.fromisoformat(v)
    except ValueError:
        pass
    # BR
    try:
        parts = v.split("/")
        if len(parts) == 3:
            return dt_date(int(parts[2]), int(parts[1]), int(parts[0]))
    except (ValueError, IndexError):
        pass
    return None


# ── Helpers ──────────────────────────────────────────────────────────────


_LISTAS_CONTROLADAS = frozenset({"A1", "A2", "A3", "B1", "B2", "C1", "C2", "C3", "C4", "C5"})


def _set_requer_receita(med: Medicamentos) -> None:
    """Define requer_receita_especial com base na classificação."""
    med.requer_receita_especial = med.classificacao_anvisa in _LISTAS_CONTROLADAS


def _medicamento_from_data(data: dict, med: Medicamentos | None = None) -> Medicamentos:
    """Constrói ou atualiza medicamento a partir do payload."""
    if med is None:
        med = Medicamentos()

    med.nome_comercial = _normalize(data.get("nome_comercial")) or med.nome_comercial
    med.principio_ativo = _normalize(data.get("principio_ativo")) or med.principio_ativo
    med.apresentacao = _normalize(data.get("apresentacao"))
    med.forma_farmaceutica = _normalize(data.get("forma_farmaceutica"))
    med.concentracao = _normalize(data.get("concentracao"))
    med.fabricante = _normalize(data.get("fabricante"))
    med.registro_anvisa = _normalize(data.get("registro_anvisa"))
    med.observacoes = _normalize(data.get("observacoes"))

    if "unidade_medida" in data:
        med.unidade_medida = _normalize(data["unidade_medida"]) or "UN"

    if "classificacao_anvisa" in data:
        cls_anvisa = _normalize(data["classificacao_anvisa"]) or "LIVRE"
        med.classificacao_anvisa = cls_anvisa.upper()

    _set_requer_receita(med)

    if "estoque_minimo" in data:
        med.estoque_minimo = _safe_int(data["estoque_minimo"], default=5)
    if "estoque_maximo" in data:
        med.estoque_maximo = _safe_int(data["estoque_maximo"], default=100)

    if "ativo" in data:
        ativo = _parse_bool(data["ativo"])
        if ativo is not None:
            med.ativo = ativo

    return med


# ══════════════════════════════════════════════════════════════════════════
# MEDICAMENTOS (CATÁLOGO)
# ══════════════════════════════════════════════════════════════════════════


@medicamentos_bp.route("/medicamentos", methods=["GET"])
def get_medicamentos():
    """Lista medicamentos com filtros."""
    try:
        query = Medicamentos.query

        if search := request.args.get("search"):
            s = f"%{search}%"
            query = query.filter(
                or_(
                    Medicamentos.nome_comercial.ilike(s),
                    Medicamentos.principio_ativo.ilike(s),
                    Medicamentos.fabricante.ilike(s),
                )
            )

        if classificacao := request.args.get("classificacao_anvisa"):
            query = query.filter(
                Medicamentos.classificacao_anvisa == classificacao.strip().upper()
            )

        if forma := request.args.get("forma_farmaceutica"):
            query = query.filter(Medicamentos.forma_farmaceutica == forma.strip().upper())

        ativo = _parse_bool(request.args.get("ativo"))
        if ativo is not None:
            query = query.filter(Medicamentos.ativo.is_(ativo))
        else:
            # Padrão: só ativos
            query = query.filter(Medicamentos.ativo.is_(True))

        controlado = _parse_bool(request.args.get("controlado"))
        if controlado is True:
            query = query.filter(Medicamentos.classificacao_anvisa.in_(_LISTAS_CONTROLADAS))
        elif controlado is False:
            query = query.filter(Medicamentos.classificacao_anvisa.notin_(_LISTAS_CONTROLADAS))

        query = query.order_by(Medicamentos.nome_comercial.asc())

        limit, offset = get_pagination()
        medicamentos = query.limit(limit).offset(offset).all()

        include_estoque = _parse_bool(request.args.get("include_estoque")) is not False
        return jsonify([m.to_dict(include_estoque=include_estoque) for m in medicamentos])

    except Exception as exc:
        current_app.logger.error("Erro ao listar medicamentos: %s", exc, exc_info=True)
        return json_error("Erro ao listar medicamentos", 500)


@medicamentos_bp.route("/medicamentos/<int:med_id>", methods=["GET"])
def get_medicamento_by_id(med_id: int):
    """Busca medicamento por ID com lotes."""
    try:
        med = Medicamentos.query.get(med_id)
        if not med:
            return json_error("Medicamento não encontrado", 404)

        result = med.to_dict()

        # Inclui lotes ativos
        lotes = (
            MedicamentoLotes.query
            .filter(MedicamentoLotes.medicamento_id == med_id)
            .order_by(MedicamentoLotes.data_validade.asc())
            .all()
        )
        result["lotes"] = [l.to_dict() for l in lotes]

        return jsonify(result)

    except Exception as exc:
        current_app.logger.error("Erro ao buscar medicamento: %s", exc, exc_info=True)
        return json_error("Erro ao buscar medicamento", 500)


@medicamentos_bp.route("/medicamentos", methods=["POST"])
def create_medicamento():
    """Cria novo medicamento no catálogo."""
    try:
        data = request.json or {}

        if not data.get("nome_comercial"):
            return json_error("Nome comercial é obrigatório")
        if not data.get("principio_ativo"):
            return json_error("Princípio ativo é obrigatório")

        classificacao = (_normalize(data.get("classificacao_anvisa")) or "LIVRE").upper()
        if classificacao not in CLASSIFICACOES_ANVISA:
            return json_error(
                f"Classificação ANVISA inválida. Válidas: {', '.join(CLASSIFICACOES_ANVISA.keys())}"
            )

        med = _medicamento_from_data(data)
        db.session.add(med)
        db.session.commit()

        return json_success(
            "Medicamento criado com sucesso",
            data=med.to_dict(),
            status_code=201,
        )

    except IntegrityError:
        db.session.rollback()
        return json_error("Erro de integridade ao criar medicamento", 409)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao criar medicamento: %s", exc, exc_info=True)
        return json_error("Erro ao criar medicamento", 500)


@medicamentos_bp.route("/medicamentos/<int:med_id>", methods=["PUT"])
def update_medicamento(med_id: int):
    """Atualiza medicamento existente."""
    try:
        med = Medicamentos.query.get(med_id)
        if not med:
            return json_error("Medicamento não encontrado", 404)

        data = request.json or {}
        _medicamento_from_data(data, med)
        db.session.commit()

        return json_success(
            "Medicamento atualizado com sucesso",
            data=med.to_dict(),
        )

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao atualizar medicamento: %s", exc, exc_info=True)
        return json_error("Erro ao atualizar medicamento", 500)


@medicamentos_bp.route("/medicamentos/<int:med_id>", methods=["DELETE"])
def delete_medicamento(med_id: int):
    """Desativa medicamento (soft delete)."""
    try:
        med = Medicamentos.query.get(med_id)
        if not med:
            return json_error("Medicamento não encontrado", 404)

        med.ativo = False
        db.session.commit()

        return json_success(f"Medicamento '{med.nome_comercial}' desativado com sucesso")

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao desativar medicamento: %s", exc, exc_info=True)
        return json_error("Erro ao desativar medicamento", 500)


# ══════════════════════════════════════════════════════════════════════════
# LOTES
# ══════════════════════════════════════════════════════════════════════════


@medicamentos_bp.route("/medicamentos/<int:med_id>/lotes", methods=["GET"])
def get_lotes_by_medicamento(med_id: int):
    """Lista lotes de um medicamento."""
    try:
        med = Medicamentos.query.get(med_id)
        if not med:
            return json_error("Medicamento não encontrado", 404)

        query = MedicamentoLotes.query.filter(
            MedicamentoLotes.medicamento_id == med_id,
        )

        ativo = _parse_bool(request.args.get("ativo"))
        if ativo is not None:
            query = query.filter(MedicamentoLotes.ativo.is_(ativo))

        disponivel = _parse_bool(request.args.get("disponivel"))
        if disponivel is True:
            from app.utils.timezone import get_today_sao_paulo

            hoje = get_today_sao_paulo()
            query = query.filter(
                MedicamentoLotes.ativo.is_(True),
                MedicamentoLotes.quantidade_atual > 0,
                MedicamentoLotes.data_validade > hoje,
            )

        query = query.order_by(MedicamentoLotes.data_validade.asc())
        lotes = query.all()

        return jsonify({
            "medicamento": med.to_dict(include_estoque=True),
            "lotes": [l.to_dict() for l in lotes],
            "total_lotes": len(lotes),
        })

    except Exception as exc:
        current_app.logger.error("Erro ao listar lotes: %s", exc, exc_info=True)
        return json_error("Erro ao listar lotes", 500)


@medicamentos_bp.route("/medicamentos/<int:med_id>/lotes", methods=["POST"])
def create_lote(med_id: int):
    """Cria novo lote para um medicamento."""
    try:
        med = Medicamentos.query.get(med_id)
        if not med:
            return json_error("Medicamento não encontrado", 404)

        data = request.json or {}

        if not data.get("numero_lote"):
            return json_error("Número do lote é obrigatório")
        if not data.get("data_validade"):
            return json_error("Data de validade é obrigatória")
        if not data.get("quantidade_inicial"):
            return json_error("Quantidade inicial é obrigatória")

        data_validade = _parse_date(data["data_validade"])
        if not data_validade:
            return json_error("Data de validade inválida. Use YYYY-MM-DD ou DD/MM/YYYY")

        quantidade = _safe_int(data["quantidade_inicial"], default=0)
        if not quantidade or quantidade <= 0:
            return json_error("Quantidade inicial deve ser maior que zero")

        data_fabricacao = _parse_date(data.get("data_fabricacao")) if data.get("data_fabricacao") else None

        # Validar fornecedor se informado
        fornecedor_id = _safe_int(data.get("fornecedor_id"))
        if fornecedor_id:
            if not Fornecedores.query.get(fornecedor_id):
                return json_error("Fornecedor não encontrado", 404)

        lote = MedicamentoLotes(
            medicamento_id=med_id,
            numero_lote=_normalize(data["numero_lote"]),
            codigo_barras=_normalize(data.get("codigo_barras")),
            data_validade=data_validade,
            data_fabricacao=data_fabricacao,
            quantidade_inicial=quantidade,
            quantidade_atual=quantidade,
            preco_unitario=_safe_float(data.get("preco_unitario")),
            fornecedor_id=fornecedor_id,
            nota_fiscal_entrada=_normalize(data.get("nota_fiscal_entrada")),
            localizacao=_normalize(data.get("localizacao")),
        )

        db.session.add(lote)
        db.session.commit()

        return json_success(
            "Lote criado com sucesso",
            data=lote.to_dict(),
            status_code=201,
        )

    except IntegrityError:
        db.session.rollback()
        return json_error("Erro de integridade ao criar lote", 409)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao criar lote: %s", exc, exc_info=True)
        return json_error("Erro ao criar lote", 500)


@medicamentos_bp.route("/lotes/<int:lote_id>", methods=["PUT"])
def update_lote(lote_id: int):
    """Atualiza dados do lote (não altera quantidade — usar movimentações)."""
    try:
        lote = MedicamentoLotes.query.get(lote_id)
        if not lote:
            return json_error("Lote não encontrado", 404)

        data = request.json or {}

        if "numero_lote" in data:
            lote.numero_lote = _normalize(data["numero_lote"]) or lote.numero_lote
        if "codigo_barras" in data:
            lote.codigo_barras = _normalize(data["codigo_barras"])
        if "data_validade" in data:
            dv = _parse_date(data["data_validade"])
            if dv:
                lote.data_validade = dv
        if "data_fabricacao" in data:
            lote.data_fabricacao = _parse_date(data["data_fabricacao"])
        if "preco_unitario" in data:
            lote.preco_unitario = _safe_float(data["preco_unitario"])
        if "localizacao" in data:
            lote.localizacao = _normalize(data["localizacao"])
        if "nota_fiscal_entrada" in data:
            lote.nota_fiscal_entrada = _normalize(data["nota_fiscal_entrada"])
        if "fornecedor_id" in data:
            fid = _safe_int(data["fornecedor_id"])
            if fid and not Fornecedores.query.get(fid):
                return json_error("Fornecedor não encontrado", 404)
            lote.fornecedor_id = fid
        if "ativo" in data:
            ativo = _parse_bool(data["ativo"])
            if ativo is not None:
                lote.ativo = ativo

        db.session.commit()

        return json_success("Lote atualizado com sucesso", data=lote.to_dict())

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao atualizar lote: %s", exc, exc_info=True)
        return json_error("Erro ao atualizar lote", 500)


@medicamentos_bp.route("/lotes/barcode/<codigo>", methods=["GET"])
def get_lote_by_barcode(codigo: str):
    """Busca lote por código de barras."""
    try:
        lotes = (
            MedicamentoLotes.query
            .filter(MedicamentoLotes.codigo_barras == codigo.strip())
            .order_by(MedicamentoLotes.data_validade.asc())
            .all()
        )

        if not lotes:
            return json_error("Nenhum lote encontrado para este código de barras", 404)

        return jsonify({
            "codigo_barras": codigo.strip(),
            "lotes": [l.to_dict() for l in lotes],
            "total": len(lotes),
        })

    except Exception as exc:
        current_app.logger.error("Erro ao buscar por código de barras: %s", exc, exc_info=True)
        return json_error("Erro ao buscar por código de barras", 500)


# ══════════════════════════════════════════════════════════════════════════
# AUXILIARES
# ══════════════════════════════════════════════════════════════════════════


@medicamentos_bp.route("/medicamentos/classificacoes", methods=["GET"])
def get_classificacoes():
    """Lista classificações ANVISA disponíveis."""
    return jsonify({
        "classificacoes": [
            {"codigo": k, "descricao": v}
            for k, v in CLASSIFICACOES_ANVISA.items()
        ],
        "formas_farmaceuticas": list(FORMAS_FARMACEUTICAS),
        "unidades_medida": list(UNIDADES_MEDIDA),
    })


@medicamentos_bp.route("/medicamentos/autocomplete", methods=["GET"])
def autocomplete_medicamentos():
    """Busca rápida para autocomplete."""
    try:
        q = (request.args.get("q") or "").strip()
        limit = _safe_int(request.args.get("limit"), default=10) or 10

        if len(q) < 2:
            return jsonify([])

        s = f"%{q}%"
        medicamentos = (
            Medicamentos.query
            .filter(
                Medicamentos.ativo.is_(True),
                or_(
                    Medicamentos.nome_comercial.ilike(s),
                    Medicamentos.principio_ativo.ilike(s),
                ),
            )
            .order_by(Medicamentos.nome_comercial)
            .limit(limit)
            .all()
        )

        return jsonify([
            {
                "id": m.id,
                "nome_comercial": m.nome_comercial,
                "principio_ativo": m.principio_ativo,
                "concentracao": m.concentracao,
                "classificacao_anvisa": m.classificacao_anvisa,
                "estoque_total": m.estoque_total,
            }
            for m in medicamentos
        ])

    except Exception as exc:
        current_app.logger.error("Erro no autocomplete: %s", exc, exc_info=True)
        return jsonify([])