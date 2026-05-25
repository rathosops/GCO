"""
Controller para vínculos empregatícios — Módulo Ocupacional.

Rotas:
  GET    /empresas/<eid>/vinculos              Listar vínculos da empresa
  GET    /vinculos/<id>                        Detalhe de um vínculo
  POST   /empresas/<eid>/vinculos              Criar vínculo
  PUT    /vinculos/<id>                        Atualizar vínculo
  PUT    /vinculos/<id>/desligar               Desligar trabalhador
  PUT    /vinculos/<id>/reativar               Reativar vínculo
  GET    /pacientes/<pid>/vinculos             Vínculos de um paciente
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.companies_model import Empresas
from app.models.company_positions_model import CargosEmpresa
from app.models.company_sectors_model import SetoresEmpresa
from app.models.employee_bonds_model import STATUS_VINCULO, VinculosEmpregado
from app.models.patients_model import Pacientes

LOGGER = logging.getLogger(__name__)

vinculos_bp = Blueprint("vinculos", __name__)


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


def _parse_date(value) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _validate_references(data: dict, empresa_id: int) -> tuple[bool, str | None]:
    """Valida que paciente, cargo e setor existem e pertencem à empresa."""
    # Paciente
    paciente_id = _safe_int(data.get("paciente_id"))
    if not paciente_id:
        return False, "paciente_id é obrigatório."

    if not Pacientes.query.get(paciente_id):
        return False, "Paciente não encontrado."

    # Cargo (opcional)
    if cargo_id := _safe_int(data.get("cargo_id")):
        cargo = CargosEmpresa.query.filter_by(
            id=cargo_id,
            empresa_id=empresa_id,
        ).first()
        if not cargo:
            return False, "Cargo não encontrado nesta empresa."

    # Setor (opcional)
    if setor_id := _safe_int(data.get("setor_id")):
        setor = SetoresEmpresa.query.filter_by(
            id=setor_id,
            empresa_id=empresa_id,
        ).first()
        if not setor:
            return False, "Setor não encontrado nesta empresa."

    return True, None


# ============================================================================
# ROTAS — CRUD
# ============================================================================


@vinculos_bp.route(
    "/empresas/<int:empresa_id>/vinculos",
    methods=["GET"],
)
def listar_vinculos(empresa_id: int):
    """
    Lista vínculos de uma empresa.

    Query params:
      - status: ATIVO (default), AFASTADO, DESLIGADO, FERIAS ou 'todos'
      - cargo_id, setor_id: filtros
      - search: busca por nome do paciente
      - limit, offset: paginação
    """
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    query = VinculosEmpregado.query.filter(
        VinculosEmpregado.empresa_id == empresa_id,
    )

    # Filtro status
    status = request.args.get("status", "ATIVO")
    if status.lower() != "todos":
        query = query.filter(VinculosEmpregado.status == status.upper())

    if cargo_id := _safe_int(request.args.get("cargo_id")):
        query = query.filter(VinculosEmpregado.cargo_id == cargo_id)

    if setor_id := _safe_int(request.args.get("setor_id")):
        query = query.filter(VinculosEmpregado.setor_id == setor_id)

    if search := request.args.get("search"):
        query = query.join(Pacientes).filter(
            Pacientes.nome.ilike(f"%{search}%"),
        )

    # Paginação
    total = query.count()
    limit = _safe_int(request.args.get("limit"), default=50)
    offset = _safe_int(request.args.get("offset"), default=0)

    vinculos = (
        query.order_by(VinculosEmpregado.funcao.asc())
        .offset(offset)
        .limit(min(limit, 200))
        .all()
    )

    return jsonify(
        {
            "empresa_id": empresa_id,
            "total": total,
            "limit": limit,
            "offset": offset,
            "vinculos": [v.to_dict(include_relations=True) for v in vinculos],
        }
    )


@vinculos_bp.route("/vinculos/<int:vinculo_id>", methods=["GET"])
def detalhe_vinculo(vinculo_id: int):
    """Detalhe de um vínculo com relações completas."""
    vinculo = VinculosEmpregado.query.get(vinculo_id)
    if not vinculo:
        return _json_error("Vínculo não encontrado.", 404)

    result = vinculo.to_dict(include_relations=True)

    # Riscos completos do cargo (merge setor + cargo)
    if vinculo.cargo:
        result["riscos_completos"] = vinculo.cargo.get_riscos_completos()
        result["exames_obrigatorios"] = vinculo.cargo.exames_obrigatorios or {}
        result["nrs_aplicaveis"] = vinculo.cargo.nrs_aplicaveis or {}

    return jsonify(result)


@vinculos_bp.route(
    "/empresas/<int:empresa_id>/vinculos",
    methods=["POST"],
)
def criar_vinculo(empresa_id: int):
    """
    Cria vínculo empregatício.

    Body JSON:
      - paciente_id (obrigatório)
      - funcao (obrigatório)
      - data_admissao (obrigatório, YYYY-MM-DD)
      - cargo_id (opcional)
      - setor_id (opcional)
      - matricula (opcional)
    """
    empresa = Empresas.query.get(empresa_id)
    if not empresa:
        return _json_error("Empresa não encontrada.", 404)

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    # Validações obrigatórias
    if not data.get("funcao"):
        return _json_error("Função é obrigatória.")

    data_admissao = _parse_date(data.get("data_admissao"))
    if not data_admissao:
        return _json_error("Data de admissão é obrigatória (YYYY-MM-DD).")

    ok, erro = _validate_references(data, empresa_id)
    if not ok:
        return _json_error(erro)

    paciente_id = _safe_int(data["paciente_id"])

    # Verifica se já existe vínculo ATIVO do paciente nesta empresa
    existente = VinculosEmpregado.query.filter(
        VinculosEmpregado.paciente_id == paciente_id,
        VinculosEmpregado.empresa_id == empresa_id,
        VinculosEmpregado.status == "ATIVO",
    ).first()

    if existente:
        return _json_error(
            "Paciente já possui vínculo ativo nesta empresa.",
            409,
        )

    try:
        # Se cargo informado, herda função do cargo se não especificada
        cargo_id = _safe_int(data.get("cargo_id"))
        setor_id = _safe_int(data.get("setor_id"))

        # Se cargo tem setor e setor não foi informado, herda do cargo
        if cargo_id and not setor_id:
            cargo = CargosEmpresa.query.get(cargo_id)
            if cargo and cargo.setor_id:
                setor_id = cargo.setor_id

        vinculo = VinculosEmpregado(
            paciente_id=paciente_id,
            empresa_id=empresa_id,
            cargo_id=cargo_id,
            setor_id=setor_id,
            matricula=_strip_or_none(data.get("matricula")),
            funcao=str(data["funcao"]).strip(),
            data_admissao=data_admissao,
            status="ATIVO",
        )

        db.session.add(vinculo)

        # Atualiza link legado no paciente (compatibilidade)
        paciente = Pacientes.query.get(paciente_id)
        if paciente:
            paciente.vinculado_a_empresa = True
            paciente.cnpj_empresa = empresa.cnpj

        db.session.commit()

        LOGGER.info(
            "Vínculo #%d criado: paciente=%d empresa=%d função='%s'",
            vinculo.id,
            paciente_id,
            empresa_id,
            vinculo.funcao,
        )

        return (
            jsonify(
                {
                    "message": "Vínculo criado com sucesso.",
                    "vinculo": vinculo.to_dict(include_relations=True),
                }
            ),
            201,
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao criar vínculo")
        return _json_error(f"Erro ao criar vínculo: {exc}", 500)


@vinculos_bp.route("/vinculos/<int:vinculo_id>", methods=["PUT"])
def atualizar_vinculo(vinculo_id: int):
    """Atualiza vínculo existente (campos parciais)."""
    vinculo = VinculosEmpregado.query.get(vinculo_id)
    if not vinculo:
        return _json_error("Vínculo não encontrado.", 404)

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    try:
        if "funcao" in data and data["funcao"]:
            vinculo.funcao = str(data["funcao"]).strip()

        if "matricula" in data:
            vinculo.matricula = _strip_or_none(data["matricula"])

        if "cargo_id" in data:
            cargo_id = _safe_int(data["cargo_id"])
            if cargo_id:
                cargo = CargosEmpresa.query.filter_by(
                    id=cargo_id,
                    empresa_id=vinculo.empresa_id,
                ).first()
                if not cargo:
                    return _json_error("Cargo não encontrado nesta empresa.")
            vinculo.cargo_id = cargo_id

        if "setor_id" in data:
            setor_id = _safe_int(data["setor_id"])
            if setor_id:
                setor = SetoresEmpresa.query.filter_by(
                    id=setor_id,
                    empresa_id=vinculo.empresa_id,
                ).first()
                if not setor:
                    return _json_error("Setor não encontrado nesta empresa.")
            vinculo.setor_id = setor_id

        if "status" in data:
            novo_status = str(data["status"]).strip().upper()
            if novo_status not in STATUS_VINCULO:
                return _json_error(
                    f"Status inválido. Use: {', '.join(STATUS_VINCULO)}",
                )
            vinculo.status = novo_status

        if "data_admissao" in data:
            dt = _parse_date(data["data_admissao"])
            if not dt:
                return _json_error("Data de admissão inválida (YYYY-MM-DD).")
            vinculo.data_admissao = dt

        db.session.commit()
        LOGGER.info("Vínculo #%d atualizado", vinculo_id)

        return jsonify(
            {
                "message": "Vínculo atualizado com sucesso.",
                "vinculo": vinculo.to_dict(include_relations=True),
            }
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao atualizar vínculo #%d", vinculo_id)
        return _json_error(f"Erro ao atualizar vínculo: {exc}", 500)


# ============================================================================
# ROTAS — Ações de status
# ============================================================================


@vinculos_bp.route(
    "/vinculos/<int:vinculo_id>/desligar",
    methods=["PUT"],
)
def desligar_vinculo(vinculo_id: int):
    """
    Desliga trabalhador da empresa.

    Body JSON:
      - data_desligamento (obrigatório, YYYY-MM-DD)
    """
    vinculo = VinculosEmpregado.query.get(vinculo_id)
    if not vinculo:
        return _json_error("Vínculo não encontrado.", 404)

    if vinculo.status == "DESLIGADO":
        return _json_error("Vínculo já está desligado.")

    data = request.get_json() or {}
    data_desligamento = _parse_date(data.get("data_desligamento"))
    if not data_desligamento:
        return _json_error("Data de desligamento é obrigatória (YYYY-MM-DD).")

    try:
        vinculo.status = "DESLIGADO"
        vinculo.data_desligamento = data_desligamento

        # Atualiza link legado se não houver outros vínculos ativos
        paciente = vinculo.paciente
        if paciente:
            outros_ativos = VinculosEmpregado.query.filter(
                VinculosEmpregado.paciente_id == paciente.id,
                VinculosEmpregado.id != vinculo_id,
                VinculosEmpregado.status == "ATIVO",
            ).count()

            if outros_ativos == 0:
                paciente.vinculado_a_empresa = False
                paciente.cnpj_empresa = None

        db.session.commit()

        LOGGER.info(
            "Vínculo #%d desligado em %s",
            vinculo_id,
            data_desligamento,
        )

        return jsonify(
            {
                "message": "Trabalhador desligado com sucesso.",
                "vinculo": vinculo.to_dict(include_relations=True),
            }
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao desligar vínculo #%d", vinculo_id)
        return _json_error(f"Erro ao desligar: {exc}", 500)


@vinculos_bp.route(
    "/vinculos/<int:vinculo_id>/reativar",
    methods=["PUT"],
)
def reativar_vinculo(vinculo_id: int):
    """Reativa vínculo desligado ou afastado."""
    vinculo = VinculosEmpregado.query.get(vinculo_id)
    if not vinculo:
        return _json_error("Vínculo não encontrado.", 404)

    if vinculo.status == "ATIVO":
        return _json_error("Vínculo já está ativo.")

    try:
        vinculo.status = "ATIVO"
        vinculo.data_desligamento = None

        # Restaura link legado
        paciente = vinculo.paciente
        if paciente:
            paciente.vinculado_a_empresa = True
            paciente.cnpj_empresa = vinculo.empresa.cnpj

        db.session.commit()

        LOGGER.info("Vínculo #%d reativado", vinculo_id)

        return jsonify(
            {
                "message": "Vínculo reativado com sucesso.",
                "vinculo": vinculo.to_dict(include_relations=True),
            }
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao reativar vínculo #%d", vinculo_id)
        return _json_error(f"Erro ao reativar: {exc}", 500)


# ============================================================================
# ROTAS — Vínculos por paciente
# ============================================================================


@vinculos_bp.route(
    "/pacientes/<int:paciente_id>/vinculos",
    methods=["GET"],
)
def vinculos_do_paciente(paciente_id: int):
    """Lista todos os vínculos de um paciente (ativos e históricos)."""
    paciente = Pacientes.query.get(paciente_id)
    if not paciente:
        return _json_error("Paciente não encontrado.", 404)

    vinculos = (
        VinculosEmpregado.query.filter(VinculosEmpregado.paciente_id == paciente_id)
        .order_by(
            VinculosEmpregado.status.asc(),
            VinculosEmpregado.data_admissao.desc(),
        )
        .all()
    )

    return jsonify(
        {
            "paciente_id": paciente_id,
            "paciente_nome": paciente.nome,
            "total": len(vinculos),
            "vinculos": [v.to_dict(include_relations=True) for v in vinculos],
        }
    )
