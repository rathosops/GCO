"""
Controller para empresas — Módulo Ocupacional.

Rotas:
  GET    /empresas                         Listar com filtros
  GET    /empresas/<id>                    Detalhe
  GET    /empresas/cnpj/<cnpj>             Busca por CNPJ
  POST   /empresas                         Criar
  PUT    /empresas/<id>                    Atualizar
  DELETE /empresas/<id>                    Excluir
  GET    /empresas/stats                   Estatísticas
  GET    /empresas/<id>/trabalhadores      Trabalhadores vinculados (novo + legado)
  GET    /empresas/<id>/periodicos         Periódicos pendentes/vencidos
  GET    /empresas/<id>/dashboard          Dashboard da empresa
  GET    /empresas/<id>/aso-prefill/<vid>  Pré-preencher ASO por vínculo
"""

from __future__ import annotations

import logging
from typing import Any

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.companies_model import Empresas
from app.models.employee_bonds_model import VinculosEmpregado
from app.src.company_service import company_service

LOGGER = logging.getLogger(__name__)

empresas_bp = Blueprint("empresas", __name__)


# =============================================================================
# Helpers
# =============================================================================


def _only_digits(value: Any) -> str:
    """Extrai apenas dígitos."""
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _clean_cnpj(cnpj: Any) -> int:
    """Remove formatação do CNPJ e retorna como inteiro."""
    digits = _only_digits(cnpj)
    if not digits:
        raise ValueError("CNPJ inválido")
    return int(digits)


def _clean_phone(phone: Any) -> int | None:
    """Telefone → inteiro. None se vazio."""
    digits = _only_digits(phone)
    return int(digits) if digits else None


def _strip_or_none(value: Any) -> str | None:
    """Strip string, retorna None se vazio."""
    if not value:
        return None
    s = str(value).strip()
    return s if s else None


def _safe_int(value: Any, *, default: int | None = None) -> int | None:
    """Converte para int de forma segura."""
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _json_error(msg: str, status: int = 400):
    """Retorno padronizado de erro."""
    return jsonify({"error": msg}), status


def _parse_bool(value: Any) -> bool | None:
    """Converte valor em booleano."""
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


# =============================================================================
# Populador de campos da empresa a partir do JSON
# =============================================================================


def _populate_empresa(empresa: Empresas, data: dict, is_create: bool = False) -> None:
    """
    Popula campos da empresa a partir do dict de request.

    Reutilizado em create e update — DRY.
    No create, campos obrigatórios já foram validados antes.
    No update, só atualiza campos presentes no payload.
    """
    # ── Identificação ────────────────────────────────────────────────
    if is_create or ("cnpj" in data and data["cnpj"]):
        empresa.cnpj = _clean_cnpj(data["cnpj"])

    if is_create:
        empresa.razao_social = str(data["razao_social"]).strip()
        empresa.nome = str(data["nome"]).strip()
    else:
        if "razao_social" in data and data["razao_social"]:
            empresa.razao_social = str(data["razao_social"]).strip()
        if "nome" in data and data["nome"]:
            empresa.nome = str(data["nome"]).strip()

    # ── Classificação ocupacional ────────────────────────────────────
    if "cnae" in data:
        empresa.cnae = _strip_or_none(data["cnae"])
    if "cnae_descricao" in data:
        empresa.cnae_descricao = _strip_or_none(data["cnae_descricao"])
    if "grau_risco" in data:
        gr = _safe_int(data["grau_risco"])
        if gr is not None and gr not in (1, 2, 3, 4):
            raise ValueError("Grau de risco deve ser 1, 2, 3 ou 4")
        empresa.grau_risco = gr

    # ── Endereço ─────────────────────────────────────────────────────
    for campo in ("cep", "logradouro", "numero", "complemento", "bairro", "cidade"):
        if campo in data:
            setattr(empresa, campo, _strip_or_none(data[campo]))
    if "uf" in data:
        uf = _strip_or_none(data["uf"])
        if uf:
            uf = uf.upper()
            if len(uf) != 2:
                raise ValueError("UF deve ter 2 letras")
        empresa.uf = uf

    # ── Contato geral ────────────────────────────────────────────────
    if "numero_para_contato" in data:
        empresa.numero_para_contato = _clean_phone(data["numero_para_contato"])
    if "email" in data:
        empresa.email = _strip_or_none(data["email"])

    # ── Contato RH ───────────────────────────────────────────────────
    if "contato_rh_nome" in data:
        empresa.contato_rh_nome = _strip_or_none(data["contato_rh_nome"])
    if "contato_rh_telefone" in data:
        empresa.contato_rh_telefone = _clean_phone(data["contato_rh_telefone"])
    if "contato_rh_email" in data:
        empresa.contato_rh_email = _strip_or_none(data["contato_rh_email"])

    # ── Fiscal ───────────────────────────────────────────────────────
    if "inscricao_estadual" in data:
        empresa.inscricao_estadual = _strip_or_none(data["inscricao_estadual"])
    if "inscricao_municipal" in data:
        empresa.inscricao_municipal = _strip_or_none(data["inscricao_municipal"])

    # ── Faturamento posterior ────────────────────────────────────────
    if "faturamento_posterior" in data:
        fp = _parse_bool(data["faturamento_posterior"])
        if fp is not None:
            empresa.faturamento_posterior = fp
    if "dia_faturamento" in data:
        dia = _safe_int(data["dia_faturamento"])
        if dia is not None and not (1 <= dia <= 31):
            raise ValueError("dia_faturamento deve ser entre 1 e 31")
        empresa.dia_faturamento = dia
    if "valor_por_consulta" in data:
        v = data["valor_por_consulta"]
        empresa.valor_por_consulta = float(v) if v not in (None, "") else None
    if "valor_por_aso" in data:
        v = data["valor_por_aso"]
        empresa.valor_por_aso = float(v) if v not in (None, "") else None
    if "observacoes_faturamento" in data:
        empresa.observacoes_faturamento = _strip_or_none(data["observacoes_faturamento"])

    # ── Status / Obs ─────────────────────────────────────────────────
    if "ativo" in data:
        ativo = _parse_bool(data["ativo"])
        if ativo is not None:
            empresa.ativo = ativo
    if "observacoes" in data:
        empresa.observacoes = _strip_or_none(data["observacoes"])


# =============================================================================
# ROTAS — CRUD
# =============================================================================


@empresas_bp.route("/empresas", methods=["GET"])
def get_empresas():
    """
    Lista empresas com filtros.

    Query params:
      - cnpj: CNPJ exato
      - nome: parcial (case insensitive)
      - search: busca em nome + razao_social
      - cnae: filtra por CNAE
      - grau_risco: filtra por grau de risco (1-4)
      - cidade, uf: filtros geográficos
      - ativo: true/false (default: true)
      - include_pacientes: true/false
      - compact: true → retorna apenas id, cnpj, nome (para selects)
      - limit, offset: paginação
    """
    try:
        query = Empresas.query

        # Filtros
        if cnpj := request.args.get("cnpj"):
            query = query.filter(Empresas.cnpj == _clean_cnpj(cnpj))

        if nome := request.args.get("nome"):
            query = query.filter(Empresas.nome.ilike(f"%{nome}%"))

        if search := request.args.get("search"):
            termo = f"%{search}%"
            query = query.filter(
                or_(
                    Empresas.nome.ilike(termo),
                    Empresas.razao_social.ilike(termo),
                )
            )

        if cnae := request.args.get("cnae"):
            query = query.filter(Empresas.cnae == cnae.strip())

        if grau := request.args.get("grau_risco"):
            query = query.filter(Empresas.grau_risco == int(grau))

        if cidade := request.args.get("cidade"):
            query = query.filter(Empresas.cidade.ilike(f"%{cidade}%"))

        if uf := request.args.get("uf"):
            query = query.filter(Empresas.uf == uf.strip().upper())

        # Filtro ativo (default: mostra apenas ativas)
        ativo = _parse_bool(request.args.get("ativo", "true"))
        if ativo is not None:
            query = query.filter(Empresas.ativo.is_(ativo))

        # Ordenação e paginação
        query = query.order_by(Empresas.nome.asc())

        total = query.count()
        limit = _safe_int(request.args.get("limit"), default=None)
        offset = _safe_int(request.args.get("offset"), default=None)
        if limit and limit > 0:
            query = query.limit(min(limit, 200))
        if offset and offset >= 0:
            query = query.offset(offset)

        empresas = query.all()

        compact = _parse_bool(request.args.get("compact")) is True
        include_pacientes = _parse_bool(request.args.get("include_pacientes")) is True

        return jsonify(
            {
                "total": total,
                "empresas": [
                    e.to_dict(compact=compact, include_pacientes=include_pacientes)
                    for e in empresas
                ],
            }
        )

    except Exception as exc:
        LOGGER.exception("Erro ao listar empresas")
        return _json_error(f"Erro ao listar empresas: {exc}", 500)


@empresas_bp.route("/empresas/<int:empresa_id>", methods=["GET"])
def get_empresa_by_id(empresa_id: int):
    """Detalhe de uma empresa por ID."""
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    include_pacientes = (
        _parse_bool(request.args.get("include_pacientes", "true")) is True
    )
    return jsonify(empresa.to_dict(include_pacientes=include_pacientes))


@empresas_bp.route("/empresas/cnpj/<cnpj>", methods=["GET"])
def get_empresa_by_cnpj(cnpj: str):
    """Busca empresa por CNPJ."""
    try:
        cnpj_limpo = _clean_cnpj(cnpj)
    except ValueError:
        return _json_error("CNPJ inválido.")

    empresa = Empresas.query.filter(Empresas.cnpj == cnpj_limpo).first()
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    return jsonify(empresa.to_dict(include_pacientes=True))


@empresas_bp.route("/empresas", methods=["POST"])
def create_empresa():
    """
    Cria nova empresa.

    Body JSON:
      - cnpj (obrigatório)
      - razao_social (obrigatório)
      - nome (obrigatório) — nome fantasia
      - cnae, cnae_descricao, grau_risco
      - cep, logradouro, numero, complemento, bairro, cidade, uf
      - numero_para_contato, email
      - contato_rh_nome, contato_rh_telefone, contato_rh_email
      - inscricao_estadual, inscricao_municipal
      - observacoes
    """
    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    # Validações obrigatórias
    if not data.get("cnpj"):
        return _json_error("CNPJ é obrigatório.")
    if not data.get("nome"):
        return _json_error("Nome fantasia é obrigatório.")

    # razao_social: usa nome como fallback
    if not data.get("razao_social"):
        data["razao_social"] = data["nome"]

    try:
        cnpj_limpo = _clean_cnpj(data["cnpj"])
    except ValueError:
        return _json_error("CNPJ inválido.")

    if Empresas.query.filter(Empresas.cnpj == cnpj_limpo).first():
        return _json_error("Empresa com este CNPJ já está cadastrada.", 409)

    try:
        empresa = Empresas()
        _populate_empresa(empresa, data, is_create=True)

        db.session.add(empresa)
        db.session.commit()

        return (
            jsonify(
                {"message": "Empresa criada com sucesso.", "empresa": empresa.to_dict()}
            ),
            201,
        )

    except ValueError as exc:
        db.session.rollback()
        return _json_error(str(exc))
    except IntegrityError:
        db.session.rollback()
        return _json_error("Empresa com este CNPJ já está cadastrada.", 409)
    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao criar empresa")
        return _json_error(f"Erro ao criar empresa: {exc}", 500)


@empresas_bp.route("/empresas/<int:empresa_id>", methods=["PUT"])
def update_empresa(empresa_id: int):
    """Atualiza empresa existente (campos parciais)."""
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    # Verifica duplicidade de CNPJ se está sendo alterado
    if "cnpj" in data and data["cnpj"]:
        try:
            novo_cnpj = _clean_cnpj(data["cnpj"])
        except ValueError:
            return _json_error("CNPJ inválido.")

        existente = Empresas.query.filter(
            Empresas.cnpj == novo_cnpj,
            Empresas.id != empresa_id,
        ).first()
        if existente:
            return _json_error("Este CNPJ já está cadastrado em outra empresa.", 409)

    try:
        _populate_empresa(empresa, data, is_create=False)
        db.session.commit()
        return jsonify(
            {"message": "Empresa atualizada com sucesso.", "empresa": empresa.to_dict()}
        )

    except ValueError as exc:
        db.session.rollback()
        return _json_error(str(exc))
    except IntegrityError:
        db.session.rollback()
        return _json_error("Erro de integridade ao atualizar empresa.", 409)
    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao atualizar empresa %d", empresa_id)
        return _json_error(f"Erro ao atualizar empresa: {exc}", 500)


@empresas_bp.route("/empresas/<int:empresa_id>", methods=["DELETE"])
def delete_empresa(empresa_id: int):
    """Exclui empresa. Bloqueia se houver vínculos ativos."""
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    # Verifica vínculos ativos (nova tabela)
    vinculos_ativos = VinculosEmpregado.query.filter(
        VinculosEmpregado.empresa_id == empresa_id,
        VinculosEmpregado.status == "ATIVO",
    ).count()

    if vinculos_ativos > 0:
        return (
            jsonify(
                {
                    "error": "Não é possível excluir empresa com vínculos ativos.",
                    "vinculos_ativos": vinculos_ativos,
                }
            ),
            409,
        )

    # Verifica pacientes legados
    if hasattr(empresa, "pacientes") and len(list(empresa.pacientes)) > 0:
        return (
            jsonify(
                {
                    "error": "Não é possível excluir empresa com pacientes vinculados.",
                    "total_pacientes": len(list(empresa.pacientes)),
                }
            ),
            409,
        )

    try:
        nome = empresa.nome
        db.session.delete(empresa)
        db.session.commit()
        return jsonify({"message": f"Empresa '{nome}' excluída com sucesso."})

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao excluir empresa %d", empresa_id)
        return _json_error(f"Erro ao excluir empresa: {exc}", 500)


# =============================================================================
# ROTAS — Estatísticas
# =============================================================================


@empresas_bp.route("/empresas/stats", methods=["GET"])
def get_empresas_stats():
    """Estatísticas do módulo de empresas."""
    try:
        total = Empresas.query.count()
        ativas = Empresas.query.filter(Empresas.ativo.is_(True)).count()

        # Por grau de risco
        por_grau = dict(
            db.session.query(Empresas.grau_risco, func.count(Empresas.id))
            .filter(Empresas.grau_risco.isnot(None))
            .group_by(Empresas.grau_risco)
            .all()
        )

        # Top empresas por vínculos ativos
        top = (
            db.session.query(
                Empresas.id,
                Empresas.nome,
                func.count(VinculosEmpregado.id).label("total"),
            )
            .outerjoin(
                VinculosEmpregado,
                (VinculosEmpregado.empresa_id == Empresas.id)
                & (VinculosEmpregado.status == "ATIVO"),
            )
            .group_by(Empresas.id, Empresas.nome)
            .order_by(func.count(VinculosEmpregado.id).desc())
            .limit(10)
            .all()
        )

        return jsonify(
            {
                "total": total,
                "ativas": ativas,
                "inativas": total - ativas,
                "por_grau_risco": {str(k): v for k, v in por_grau.items()},
                "top_empresas": [
                    {"id": eid, "nome": nome, "trabalhadores_ativos": t}
                    for eid, nome, t in top
                ],
            }
        )

    except Exception as exc:
        LOGGER.exception("Erro ao buscar estatísticas de empresas")
        return _json_error(f"Erro ao buscar estatísticas: {exc}", 500)


# =============================================================================
# ROTAS — Integração ocupacional (delegam para CompanyService)
# =============================================================================


@empresas_bp.route("/empresas/<int:empresa_id>/trabalhadores", methods=["GET"])
def get_trabalhadores(empresa_id: int):
    """
    Lista trabalhadores vinculados à empresa (novo + legado).

    Query params:
      - status: ATIVO (default), AFASTADO, DESLIGADO, FERIAS, LEGADO ou 'todos'
      - search: busca por nome/CPF
      - limit, offset: paginação
    """
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    status = request.args.get("status", "ATIVO").strip()
    if status.lower() == "todos":
        status = None
    elif status.lower() == "legado":
        status = "LEGADO"

    return jsonify(
        company_service.get_trabalhadores(
            empresa_id,
            status=status,
            search=request.args.get("search"),
            limit=_safe_int(request.args.get("limit"), default=50),
            offset=_safe_int(request.args.get("offset"), default=0),
        )
    )


@empresas_bp.route("/empresas/<int:empresa_id>/periodicos", methods=["GET"])
def get_periodicos_pendentes(empresa_id: int):
    """
    Periódicos vencidos ou a vencer.

    Query params:
      - dias: antecedência em dias (default: 30)
    """
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    dias = _safe_int(request.args.get("dias"), default=30)

    pendentes = company_service.get_periodicos_pendentes(empresa_id, dias)

    return jsonify(
        {
            "empresa_id": empresa_id,
            "empresa_nome": empresa.nome,
            "dias_antecedencia": dias,
            "total": len(pendentes),
            "pendentes": pendentes,
        }
    )


@empresas_bp.route("/empresas/<int:empresa_id>/dashboard", methods=["GET"])
def get_empresa_dashboard(empresa_id: int):
    """Dashboard resumido da empresa."""
    resultado = company_service.get_empresa_dashboard(empresa_id)
    if not resultado:
        return _json_error("Empresa não encontrada.", 404)
    return jsonify(resultado)


@empresas_bp.route(
    "/empresas/<int:empresa_id>/aso-prefill/<int:vinculo_id>",
    methods=["GET"],
)
def get_aso_prefill(empresa_id: int, vinculo_id: int):
    """
    Retorna dados pré-preenchidos para gerar ASO
    com base no vínculo empregatício.

    Riscos = merge(setor + cargo).
    Exames e NRs vêm do cargo.
    """
    prefill = company_service.get_aso_prefill(vinculo_id)
    if not prefill:
        return _json_error("Vínculo não encontrado.", 404)

    if prefill["empresa"]["id"] != empresa_id:
        return _json_error("Vínculo não pertence a esta empresa.", 400)

    return jsonify(prefill)
