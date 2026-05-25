"""
Controller para cargos/funções de empresa — Módulo Ocupacional.

Rotas:
  GET    /empresas/<eid>/cargos           Listar cargos
  GET    /empresas/<eid>/cargos/<id>      Detalhe
  POST   /empresas/<eid>/cargos           Criar cargo
  PUT    /empresas/<eid>/cargos/<id>      Atualizar
  DELETE /empresas/<eid>/cargos/<id>      Excluir/inativar
"""

from __future__ import annotations

import logging

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.companies_model import Empresas
from app.models.company_positions_model import CargosEmpresa
from app.models.company_sectors_model import SetoresEmpresa
from app.models.employee_bonds_model import VinculosEmpregado

LOGGER = logging.getLogger(__name__)

empresa_cargos_bp = Blueprint("empresa_cargos", __name__)


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


def _safe_int(value, *, default=None) -> int | None:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


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
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return None, _json_error("Empresa não encontrada.", 404)
    return empresa, None


def _populate_cargo(cargo: CargosEmpresa, data: dict, empresa_id: int) -> None:
    """Popula campos do cargo a partir do payload. Reutilizado em create/update."""
    if "nome" in data and data["nome"]:
        cargo.nome = str(data["nome"]).strip()

    if "setor_id" in data:
        setor_id = _safe_int(data["setor_id"])
        if setor_id:
            setor = SetoresEmpresa.query.filter_by(
                id=setor_id,
                empresa_id=empresa_id,
            ).first()
            if not setor:
                raise ValueError("Setor não encontrado nesta empresa.")
        cargo.setor_id = setor_id

    if "cbo" in data:
        cargo.cbo = _strip_or_none(data["cbo"])

    if "descricao" in data:
        cargo.descricao = _strip_or_none(data["descricao"])

    if "riscos_ocupacionais" in data:
        cargo.riscos_ocupacionais = data["riscos_ocupacionais"]

    if "exames_obrigatorios" in data:
        cargo.exames_obrigatorios = data["exames_obrigatorios"]

    if "nrs_aplicaveis" in data:
        cargo.nrs_aplicaveis = data["nrs_aplicaveis"]

    if "periodicidade_meses" in data:
        meses = _safe_int(data["periodicidade_meses"], default=12)
        if meses < 1 or meses > 60:
            raise ValueError("Periodicidade deve ser entre 1 e 60 meses.")
        cargo.periodicidade_meses = meses

    if "manipula_alimentos" in data:
        ma = _parse_bool(data["manipula_alimentos"])
        if ma is not None:
            cargo.manipula_alimentos = ma

    if "ativo" in data:
        ativo = _parse_bool(data["ativo"])
        if ativo is not None:
            cargo.ativo = ativo


# ============================================================================
# ROTAS
# ============================================================================


@empresa_cargos_bp.route(
    "/empresas/<int:empresa_id>/cargos",
    methods=["GET"],
)
def listar_cargos(empresa_id: int):
    """
    Lista cargos de uma empresa.

    Query params:
      - ativo: true/false (default: true)
      - setor_id: filtra por setor
      - search: busca por nome
    """
    empresa, err = _get_empresa_or_404(empresa_id)
    if err:
        return err

    query = CargosEmpresa.query.filter(
        CargosEmpresa.empresa_id == empresa_id,
    )

    ativo = _parse_bool(request.args.get("ativo", "true"))
    if ativo is not None:
        query = query.filter(CargosEmpresa.ativo.is_(ativo))

    if setor_id := _safe_int(request.args.get("setor_id")):
        query = query.filter(CargosEmpresa.setor_id == setor_id)

    if search := request.args.get("search"):
        query = query.filter(CargosEmpresa.nome.ilike(f"%{search}%"))

    query = query.order_by(CargosEmpresa.nome.asc())
    cargos = query.all()

    return jsonify(
        {
            "empresa_id": empresa_id,
            "total": len(cargos),
            "cargos": [c.to_dict(include_setor=True) for c in cargos],
        }
    )


@empresa_cargos_bp.route(
    "/empresas/<int:empresa_id>/cargos/<int:cargo_id>",
    methods=["GET"],
)
def detalhe_cargo(empresa_id: int, cargo_id: int):
    """Detalhe de um cargo com riscos completos (setor + cargo)."""
    cargo = CargosEmpresa.query.filter_by(
        id=cargo_id,
        empresa_id=empresa_id,
    ).first()

    if not cargo:
        return _json_error("Cargo não encontrado.", 404)

    result = cargo.to_dict(include_setor=True)
    result["riscos_completos"] = cargo.get_riscos_completos()

    # Total de trabalhadores neste cargo
    total_trabalhadores = VinculosEmpregado.query.filter(
        VinculosEmpregado.cargo_id == cargo_id,
        VinculosEmpregado.status == "ATIVO",
    ).count()
    result["total_trabalhadores_ativos"] = total_trabalhadores

    return jsonify(result)


@empresa_cargos_bp.route(
    "/empresas/<int:empresa_id>/cargos",
    methods=["POST"],
)
def criar_cargo(empresa_id: int):
    """
    Cria cargo para a empresa.

    Body JSON:
      - nome (obrigatório)
      - setor_id (opcional)
      - cbo, descricao
      - riscos_ocupacionais: {fisico, quimico, biologico, ergonomico, acidente}
      - exames_obrigatorios: {admissional: [...], periodico: [...], ...}
      - nrs_aplicaveis: {nr7: true, nr9: true, ...}
      - periodicidade_meses (default: 12)
      - manipula_alimentos (default: false)
    """
    empresa, err = _get_empresa_or_404(empresa_id)
    if err:
        return err

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    if not data.get("nome"):
        return _json_error("Nome do cargo é obrigatório.")

    try:
        cargo = CargosEmpresa(empresa_id=empresa_id)
        _populate_cargo(cargo, data, empresa_id)

        db.session.add(cargo)
        db.session.commit()

        LOGGER.info(
            "Cargo #%d '%s' criado para empresa #%d",
            cargo.id,
            cargo.nome,
            empresa_id,
        )

        return (
            jsonify(
                {
                    "message": "Cargo criado com sucesso.",
                    "cargo": cargo.to_dict(include_setor=True),
                }
            ),
            201,
        )

    except ValueError as exc:
        db.session.rollback()
        return _json_error(str(exc))

    except IntegrityError:
        db.session.rollback()
        return _json_error(
            f"Já existe um cargo '{data.get('nome')}' nesta empresa.",
            409,
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao criar cargo para empresa #%d", empresa_id)
        return _json_error(f"Erro ao criar cargo: {exc}", 500)


@empresa_cargos_bp.route(
    "/empresas/<int:empresa_id>/cargos/<int:cargo_id>",
    methods=["PUT"],
)
def atualizar_cargo(empresa_id: int, cargo_id: int):
    """Atualiza cargo existente (campos parciais)."""
    cargo = CargosEmpresa.query.filter_by(
        id=cargo_id,
        empresa_id=empresa_id,
    ).first()

    if not cargo:
        return _json_error("Cargo não encontrado.", 404)

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    try:
        _populate_cargo(cargo, data, empresa_id)
        db.session.commit()

        LOGGER.info("Cargo #%d atualizado", cargo_id)

        return jsonify(
            {
                "message": "Cargo atualizado com sucesso.",
                "cargo": cargo.to_dict(include_setor=True),
            }
        )

    except ValueError as exc:
        db.session.rollback()
        return _json_error(str(exc))

    except IntegrityError:
        db.session.rollback()
        return _json_error("Já existe um cargo com este nome nesta empresa.", 409)

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao atualizar cargo #%d", cargo_id)
        return _json_error(f"Erro ao atualizar cargo: {exc}", 500)


@empresa_cargos_bp.route(
    "/empresas/<int:empresa_id>/cargos/<int:cargo_id>",
    methods=["DELETE"],
)
def excluir_cargo(empresa_id: int, cargo_id: int):
    """Exclui cargo. Soft delete se houver vínculos ativos."""
    cargo = CargosEmpresa.query.filter_by(
        id=cargo_id,
        empresa_id=empresa_id,
    ).first()

    if not cargo:
        return _json_error("Cargo não encontrado.", 404)

    try:
        vinculos_ativos = VinculosEmpregado.query.filter(
            VinculosEmpregado.cargo_id == cargo_id,
            VinculosEmpregado.status == "ATIVO",
        ).count()

        if vinculos_ativos > 0:
            cargo.ativo = False
            db.session.commit()
            return jsonify(
                {
                    "message": (
                        f"Cargo '{cargo.nome}' inativado "
                        f"({vinculos_ativos} vínculo(s) ativo(s))."
                    ),
                    "soft_delete": True,
                }
            )

        nome = cargo.nome
        db.session.delete(cargo)
        db.session.commit()

        return jsonify(
            {
                "message": f"Cargo '{nome}' excluído com sucesso.",
                "soft_delete": False,
            }
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao excluir cargo #%d", cargo_id)
        return _json_error(f"Erro ao excluir cargo: {exc}", 500)
