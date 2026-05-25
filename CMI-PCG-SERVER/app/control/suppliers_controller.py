"""
Controller de fornecedores de medicamentos.

Endpoints:
    GET    /fornecedores           → Listar (com filtros)
    GET    /fornecedores/<id>      → Buscar por ID
    POST   /fornecedores           → Criar
    PUT    /fornecedores/<id>      → Atualizar
    DELETE /fornecedores/<id>      → Desativar (soft delete)
"""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.suppliers_model import Fornecedores
from app.utils.responses import get_pagination, json_error, json_success

fornecedores_bp = Blueprint("fornecedores", __name__)


# ── Helpers locais ───────────────────────────────────────────────────────


def _normalize(value: str | None) -> str | None:
    """Normaliza string (strip + None se vazio)."""
    if not value:
        return None
    v = str(value).strip()
    return v if v else None


def _only_digits(value: str | None) -> str:
    """Remove tudo que não é dígito."""
    if not value:
        return ""
    return "".join(c for c in str(value) if c.isdigit())


def _clean_cnpj(cnpj_raw: str) -> str:
    """Limpa e valida CNPJ (14 dígitos)."""
    digits = _only_digits(cnpj_raw)
    if len(digits) != 14:
        raise ValueError("CNPJ deve ter 14 dígitos")
    return digits


def _fornecedor_from_data(data: dict, fornecedor: Fornecedores | None = None) -> Fornecedores:
    """Constrói ou atualiza fornecedor a partir do payload."""
    if fornecedor is None:
        fornecedor = Fornecedores()

    fornecedor.nome = _normalize(data.get("nome")) or fornecedor.nome
    fornecedor.razao_social = _normalize(data.get("razao_social"))
    fornecedor.telefone = _normalize(data.get("telefone"))
    fornecedor.email = _normalize(data.get("email"))
    fornecedor.contato_responsavel = _normalize(data.get("contato_responsavel"))
    fornecedor.cep = _only_digits(data.get("cep")) or None
    fornecedor.logradouro = _normalize(data.get("logradouro"))
    fornecedor.numero = _normalize(data.get("numero"))
    fornecedor.complemento = _normalize(data.get("complemento"))
    fornecedor.bairro = _normalize(data.get("bairro"))
    fornecedor.cidade = _normalize(data.get("cidade"))
    fornecedor.uf = (_normalize(data.get("uf")) or "").upper() or None
    fornecedor.observacoes = _normalize(data.get("observacoes"))

    if "ativo" in data:
        fornecedor.ativo = bool(data["ativo"])

    return fornecedor


# ── GET - Listar ─────────────────────────────────────────────────────────


@fornecedores_bp.route("/fornecedores", methods=["GET"])
def get_fornecedores():
    """Lista fornecedores com filtros opcionais."""
    try:
        query = Fornecedores.query

        if search := request.args.get("search"):
            s = f"%{search}%"
            query = query.filter(
                or_(
                    Fornecedores.nome.ilike(s),
                    Fornecedores.cnpj.ilike(s),
                    Fornecedores.razao_social.ilike(s),
                )
            )

        if ativo := request.args.get("ativo"):
            query = query.filter(Fornecedores.ativo.is_(ativo.lower() == "true"))

        query = query.order_by(Fornecedores.nome.asc())

        limit, offset = get_pagination()
        fornecedores = query.limit(limit).offset(offset).all()

        return jsonify([f.to_dict() for f in fornecedores])

    except Exception as exc:
        current_app.logger.error("Erro ao listar fornecedores: %s", exc, exc_info=True)
        return json_error("Erro ao listar fornecedores", 500)


# ── GET - Buscar por ID ─────────────────────────────────────────────────


@fornecedores_bp.route("/fornecedores/<int:fornecedor_id>", methods=["GET"])
def get_fornecedor_by_id(fornecedor_id: int):
    """Busca fornecedor por ID."""
    try:
        fornecedor = Fornecedores.query.get(fornecedor_id)
        if not fornecedor:
            return json_error("Fornecedor não encontrado", 404)
        return jsonify(fornecedor.to_dict())

    except Exception as exc:
        current_app.logger.error("Erro ao buscar fornecedor: %s", exc, exc_info=True)
        return json_error("Erro ao buscar fornecedor", 500)


# ── POST - Criar ─────────────────────────────────────────────────────────


@fornecedores_bp.route("/fornecedores", methods=["POST"])
def create_fornecedor():
    """Cria novo fornecedor."""
    try:
        data = request.json or {}

        if not data.get("nome"):
            return json_error("Nome é obrigatório")
        if not data.get("cnpj"):
            return json_error("CNPJ é obrigatório")

        try:
            cnpj = _clean_cnpj(data["cnpj"])
        except ValueError as exc:
            return json_error(str(exc))

        if Fornecedores.query.filter(Fornecedores.cnpj == cnpj).first():
            return json_error("Fornecedor com este CNPJ já cadastrado", 409)

        fornecedor = _fornecedor_from_data(data)
        fornecedor.cnpj = cnpj

        db.session.add(fornecedor)
        db.session.commit()

        return json_success(
            "Fornecedor criado com sucesso",
            data=fornecedor.to_dict(),
            status_code=201,
        )

    except IntegrityError:
        db.session.rollback()
        return json_error("Fornecedor com este CNPJ já cadastrado", 409)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao criar fornecedor: %s", exc, exc_info=True)
        return json_error("Erro ao criar fornecedor", 500)


# ── PUT - Atualizar ──────────────────────────────────────────────────────


@fornecedores_bp.route("/fornecedores/<int:fornecedor_id>", methods=["PUT"])
def update_fornecedor(fornecedor_id: int):
    """Atualiza fornecedor existente."""
    try:
        fornecedor = Fornecedores.query.get(fornecedor_id)
        if not fornecedor:
            return json_error("Fornecedor não encontrado", 404)

        data = request.json or {}

        if "cnpj" in data and data.get("cnpj"):
            try:
                cnpj = _clean_cnpj(data["cnpj"])
            except ValueError as exc:
                return json_error(str(exc))

            existente = Fornecedores.query.filter(
                Fornecedores.cnpj == cnpj,
                Fornecedores.id != fornecedor_id,
            ).first()
            if existente:
                return json_error("CNPJ já cadastrado para outro fornecedor", 409)
            fornecedor.cnpj = cnpj

        _fornecedor_from_data(data, fornecedor)
        db.session.commit()

        return json_success(
            "Fornecedor atualizado com sucesso",
            data=fornecedor.to_dict(),
        )

    except IntegrityError:
        db.session.rollback()
        return json_error("Erro de integridade ao atualizar fornecedor", 409)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao atualizar fornecedor: %s", exc, exc_info=True)
        return json_error("Erro ao atualizar fornecedor", 500)


# ── DELETE - Desativar (soft delete) ─────────────────────────────────────


@fornecedores_bp.route("/fornecedores/<int:fornecedor_id>", methods=["DELETE"])
def delete_fornecedor(fornecedor_id: int):
    """Desativa fornecedor (soft delete)."""
    try:
        fornecedor = Fornecedores.query.get(fornecedor_id)
        if not fornecedor:
            return json_error("Fornecedor não encontrado", 404)

        fornecedor.ativo = False
        db.session.commit()

        return json_success(f"Fornecedor '{fornecedor.nome}' desativado com sucesso")

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao desativar fornecedor: %s", exc, exc_info=True)
        return json_error("Erro ao desativar fornecedor", 500)