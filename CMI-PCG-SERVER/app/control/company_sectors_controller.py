"""
Controller para setores de empresa — Módulo Ocupacional.

Rotas:
  GET    /empresas/<eid>/setores           Listar setores da empresa
  GET    /empresas/<eid>/setores/<id>      Detalhe de um setor
  POST   /empresas/<eid>/setores           Criar setor
  PUT    /empresas/<eid>/setores/<id>      Atualizar setor
  DELETE /empresas/<eid>/setores/<id>      Excluir/inativar setor
"""

from __future__ import annotations

import logging

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.companies_model import Empresas
from app.models.company_sectors_model import SetoresEmpresa

LOGGER = logging.getLogger(__name__)

empresa_setores_bp = Blueprint("empresa_setores", __name__)


# ============================================================================
# Helpers
# ============================================================================


def _json_error(msg: str, status: int = 400):
    return jsonify({"error": msg}), status


def _strip_or_none(value) -> str | None:
    if not value:
        return None
    s = str(value).strip()
    return s if s else None


def _parse_bool(value) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    v = str(value).strip().lower()
    if v in {"true", "1", "sim"}:
        return True
    if v in {"false", "0", "nao", "não"}:
        return False
    return None


def _get_empresa_or_404(empresa_id: int):
    """Retorna empresa ou resposta 404."""
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return None, _json_error("Empresa não encontrada.", 404)
    return empresa, None


# ============================================================================
# ROTAS
# ============================================================================


@empresa_setores_bp.route(
    "/empresas/<int:empresa_id>/setores",
    methods=["GET"],
)
def listar_setores(empresa_id: int):
    """
    Lista setores de uma empresa.

    Query params:
      - ativo: true/false (default: true)
      - search: busca por nome
    """
    empresa, err = _get_empresa_or_404(empresa_id)
    if err:
        return err

    query = SetoresEmpresa.query.filter(
        SetoresEmpresa.empresa_id == empresa_id,
    )

    ativo = _parse_bool(request.args.get("ativo", "true"))
    if ativo is not None:
        query = query.filter(SetoresEmpresa.ativo.is_(ativo))

    if search := request.args.get("search"):
        query = query.filter(SetoresEmpresa.nome.ilike(f"%{search}%"))

    query = query.order_by(SetoresEmpresa.nome.asc())
    setores = query.all()

    return jsonify(
        {
            "empresa_id": empresa_id,
            "total": len(setores),
            "setores": [s.to_dict() for s in setores],
        }
    )


@empresa_setores_bp.route(
    "/empresas/<int:empresa_id>/setores/<int:setor_id>",
    methods=["GET"],
)
def detalhe_setor(empresa_id: int, setor_id: int):
    """Detalhe de um setor."""
    setor = SetoresEmpresa.query.filter_by(
        id=setor_id,
        empresa_id=empresa_id,
    ).first()

    if not setor:
        return _json_error("Setor não encontrado.", 404)

    result = setor.to_dict()

    # Inclui cargos vinculados ao setor
    cargos = setor.cargos.filter_by(ativo=True).all()
    result["cargos"] = [c.to_dict() for c in cargos]
    result["total_cargos"] = len(cargos)

    return jsonify(result)


@empresa_setores_bp.route(
    "/empresas/<int:empresa_id>/setores",
    methods=["POST"],
)
def criar_setor(empresa_id: int):
    """
    Cria setor para a empresa.

    Body JSON:
      - nome (obrigatório)
      - descricao
      - riscos_ocupacionais: {fisico, quimico, biologico, ergonomico, acidente}
    """
    empresa, err = _get_empresa_or_404(empresa_id)
    if err:
        return err

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    nome = _strip_or_none(data.get("nome"))
    if not nome:
        return _json_error("Nome do setor é obrigatório.")

    try:
        setor = SetoresEmpresa(
            empresa_id=empresa_id,
            nome=nome,
            descricao=_strip_or_none(data.get("descricao")),
            riscos_ocupacionais=data.get("riscos_ocupacionais", {}),
        )

        db.session.add(setor)
        db.session.commit()

        LOGGER.info(
            "Setor #%d '%s' criado para empresa #%d",
            setor.id,
            setor.nome,
            empresa_id,
        )

        return (
            jsonify(
                {
                    "message": "Setor criado com sucesso.",
                    "setor": setor.to_dict(),
                }
            ),
            201,
        )

    except IntegrityError:
        db.session.rollback()
        return _json_error(
            f"Já existe um setor '{nome}' nesta empresa.",
            409,
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao criar setor para empresa #%d", empresa_id)
        return _json_error(f"Erro ao criar setor: {exc}", 500)


@empresa_setores_bp.route(
    "/empresas/<int:empresa_id>/setores/<int:setor_id>",
    methods=["PUT"],
)
def atualizar_setor(empresa_id: int, setor_id: int):
    """Atualiza setor existente (campos parciais)."""
    setor = SetoresEmpresa.query.filter_by(
        id=setor_id,
        empresa_id=empresa_id,
    ).first()

    if not setor:
        return _json_error("Setor não encontrado.", 404)

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    try:
        if "nome" in data and data["nome"]:
            setor.nome = str(data["nome"]).strip()

        if "descricao" in data:
            setor.descricao = _strip_or_none(data["descricao"])

        if "riscos_ocupacionais" in data:
            setor.riscos_ocupacionais = data["riscos_ocupacionais"]

        if "ativo" in data:
            ativo = _parse_bool(data["ativo"])
            if ativo is not None:
                setor.ativo = ativo

        db.session.commit()
        LOGGER.info("Setor #%d atualizado", setor_id)

        return jsonify(
            {
                "message": "Setor atualizado com sucesso.",
                "setor": setor.to_dict(),
            }
        )

    except IntegrityError:
        db.session.rollback()
        return _json_error("Já existe um setor com este nome nesta empresa.", 409)

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao atualizar setor #%d", setor_id)
        return _json_error(f"Erro ao atualizar setor: {exc}", 500)


@empresa_setores_bp.route(
    "/empresas/<int:empresa_id>/setores/<int:setor_id>",
    methods=["DELETE"],
)
def excluir_setor(empresa_id: int, setor_id: int):
    """
    Exclui setor (soft delete → inativa).

    Se houver cargos ou vínculos ativos, apenas inativa.
    Se não houver dependências, exclui de fato.
    """
    setor = SetoresEmpresa.query.filter_by(
        id=setor_id,
        empresa_id=empresa_id,
    ).first()

    if not setor:
        return _json_error("Setor não encontrado.", 404)

    try:
        cargos_ativos = setor.cargos.filter_by(ativo=True).count()

        if cargos_ativos > 0:
            # Soft delete: apenas inativa
            setor.ativo = False
            db.session.commit()
            return jsonify(
                {
                    "message": (
                        f"Setor '{setor.nome}' inativado "
                        f"({cargos_ativos} cargo(s) vinculado(s))."
                    ),
                    "soft_delete": True,
                }
            )

        nome = setor.nome
        db.session.delete(setor)
        db.session.commit()

        return jsonify(
            {
                "message": f"Setor '{nome}' excluído com sucesso.",
                "soft_delete": False,
            }
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao excluir setor #%d", setor_id)
        return _json_error(f"Erro ao excluir setor: {exc}", 500)
