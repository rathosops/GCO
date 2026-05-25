"""
Controller para ASOs (Atestados de Saúde Ocupacional).

Rotas:
  POST   /asos                   Criar ASO (salva + opcionalmente gera PDF)
  GET    /asos                   Listar com filtros avançados
  GET    /asos/<id>              Detalhe de um ASO
  PUT    /asos/<id>              Atualizar ASO existente
  DELETE /asos/<id>              Excluir ASO
  GET    /asos/historico/<cpf>   Histórico de ASOs de um paciente
  GET    /asos/stats             Estatísticas gerais
  POST   /asos/gerar-pdf         Gerar PDF sem salvar (preview)
  GET    /asos/<id>/pdf          Re-gerar PDF de um ASO já salvo
  POST   /gerar_aso              Rota legada (compatibilidade com frontend atual)

Conforme NR-7 item 7.5.19.1:
  Razão social/CNPJ, nome/CPF/função do trabalhador,
  riscos ocupacionais, exames, conclusão, dados do médico.
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime
from typing import Any

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func, or_
from app.control.base_pdf_report import BasePdfReport
from app.database import db
from app.models.aso_request_model import (
    CONCLUSOES,
    TIPOS_EXAME,
    SolicitacoesDeAso,
)
from app.models.companies_model import Empresas
from app.models.doctors_model import Medicos
from app.models.patients_model import Pacientes
from app.utils.timezone import get_now_sao_paulo
from app.utils.validators import normalize_for_search

LOGGER = logging.getLogger(__name__)

aso_bp = Blueprint("aso", __name__)


# ============================================================================
# Helpers
# ============================================================================


def _only_digits(value: Any) -> str:
    """Extrai apenas dígitos de qualquer valor."""
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _to_int(value: Any) -> int | None:
    """Converte valor para int (para FKs BigInteger)."""
    try:
        return int(float(str(value)))
    except (TypeError, ValueError):
        digits = _only_digits(value)
        return int(digits) if digits else None


def _fmt_cpf(cpf: Any) -> str:
    """Formata CPF para XXX.XXX.XXX-XX."""
    digits = _only_digits(cpf).zfill(11)
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"


def _fmt_cnpj(cnpj: Any) -> str:
    """Formata CNPJ para XX.XXX.XXX/XXXX-XX."""
    digits = _only_digits(cnpj).zfill(14)
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


def _fmt_crm(crm: Any) -> str:
    """Formata CRM como string inteira."""
    try:
        return str(int(float(str(crm))))
    except (TypeError, ValueError):
        return str(crm)


def _cpf_to_str(value: Any) -> str | None:
    """Normaliza CPF para string de 11 dígitos."""
    digits = _only_digits(value)
    if not digits:
        return None
    return digits.zfill(11)


def _json_error(msg: str, status: int = 400):
    """Retorno padronizado de erro."""
    return jsonify({"error": msg}), status


def _parse_date(value: str | None) -> date | None:
    """Converte string ISO (YYYY-MM-DD) para date."""
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


# ============================================================================
# Validação
# ============================================================================


def _validar_entidades(data: dict) -> tuple[bool, str | None, dict]:
    """
    Valida paciente, empresa e médico.
    Retorna (ok, erro_msg, {paciente_db, empresa_db, medico_db, cpf, cnpj, crm}).
    """
    pac = data.get("paciente", {})
    emp = data.get("empresa", {})
    med = data.get("medico", {})

    if not pac or not emp or not med:
        return False, "Paciente, empresa e médico são obrigatórios.", {}

    cpf = _cpf_to_str(pac.get("cpf"))
    cnpj = _to_int(emp.get("cnpj"))
    crm = _to_int(med.get("crm"))

    if cpf is None:
        return False, "CPF inválido.", {}
    if cnpj is None:
        return False, "CNPJ inválido.", {}
    if crm is None:
        return False, "CRM inválido.", {}

    paciente_db = Pacientes.query.filter_by(cpf=cpf).first()
    if not paciente_db:
        return False, "Paciente não encontrado na base de dados.", {}

    if not paciente_db.vinculado_a_empresa or paciente_db.cnpj_empresa != cnpj:
        return False, "Paciente não está vinculado à empresa informada.", {}

    empresa_db = Empresas.query.filter_by(cnpj=cnpj).first()
    if not empresa_db:
        return False, "Empresa não cadastrada na base de dados.", {}

    medico_db = Medicos.query.filter_by(crm=crm).first()
    if not medico_db:
        return False, "Médico não encontrado na base de dados.", {}

    return (
        True,
        None,
        {
            "paciente_db": paciente_db,
            "empresa_db": empresa_db,
            "medico_db": medico_db,
            "cpf": cpf,
            "cnpj": cnpj,
            "crm": crm,
        },
    )


def _validar_campos_aso(data: dict) -> tuple[bool, str | None]:
    """Valida campos específicos do ASO."""
    tipo = data.get("tipo_de_exame", {}).get("exame", "")
    if not tipo:
        return False, "Tipo de exame é obrigatório."

    conclusao = data.get("conclusao", {}).get("status", "")
    if not conclusao:
        return False, "Conclusão médica é obrigatória."

    funcao = data.get("funcao_do_paciente", "").strip()
    if not funcao:
        return False, "Função do paciente é obrigatória."

    return True, None


# ============================================================================
# Normalização de enums
# ============================================================================

_MAPA_TIPO_EXAME = {
    "admissional": "ADMISSIONAL",
    "periódico": "PERIODICO",
    "periodico": "PERIODICO",
    "retorno ao trabalho": "RETORNO_AO_TRABALHO",
    "mudança de função": "MUDANCA_DE_FUNCAO",
    "mudanca de funcao": "MUDANCA_DE_FUNCAO",
    "mudança de riscos ocupacionais": "MUDANCA_DE_FUNCAO",
    "demissional": "DEMISSIONAL",
}

_MAPA_CONCLUSAO = {
    "apto": "APTO",
    "inapto": "INAPTO",
    "apto com restrições": "APTO_COM_RESTRICOES",
    "apto com restricoes": "APTO_COM_RESTRICOES",
    "apto_com_restricoes": "APTO_COM_RESTRICOES",
}


def _normalizar_tipo_exame(tipo_raw: str) -> str:
    """Normaliza tipo de exame para o enum do modelo."""
    return _MAPA_TIPO_EXAME.get(
        tipo_raw.lower().strip(), tipo_raw.upper().replace(" ", "_")
    )


def _normalizar_conclusao(conclusao_raw: str) -> str:
    """Normaliza conclusão para o enum do modelo."""
    return _MAPA_CONCLUSAO.get(conclusao_raw.lower().strip(), conclusao_raw.upper())


# ============================================================================
# Persistência
# ============================================================================


def _criar_aso_record(data: dict, entities: dict) -> SolicitacoesDeAso:
    """Cria o registro de ASO no banco."""
    agora = get_now_sao_paulo()

    tipo_raw = data.get("tipo_de_exame", {}).get("exame", "ADMISSIONAL")
    conclusao_raw = data.get("conclusao", {}).get("status", "APTO")

    aso = SolicitacoesDeAso(
        cpf_paciente=entities["cpf"],
        cnpj_empresa=entities["cnpj"],
        crm_medico=entities["crm"],
        tipo_exame=_normalizar_tipo_exame(tipo_raw),
        funcao_paciente=data.get("funcao_do_paciente", "Não informado").strip(),
        setor=data.get("setor", "").strip() or None,
        conclusao=_normalizar_conclusao(conclusao_raw),
        restricoes=data.get("restricoes", "").strip() or None,
        riscos_ocupacionais=data.get("riscos", {}),
        exames_complementares=data.get("exames_solicitados", {}),
        normas_regulamentadoras=data.get("nrs", {}),
        manipulacao_alimentos=data.get("manipulacao_de_alimentos", "").strip() or None,
        observacoes=data.get("observacoes", "").strip() or None,
        data=agora.date(),
        hora=agora.time(),
        created_by=data.get("created_by"),
    )

    db.session.add(aso)
    db.session.commit()

    LOGGER.info(
        "ASO #%d criado | CPF=%s | Empresa=%s | Tipo=%s | Conclusão=%s",
        aso.id,
        aso.cpf_paciente,
        aso.cnpj_empresa,
        aso.tipo_exame,
        aso.conclusao,
    )
    return aso


# ============================================================================
# Geração de PDF
# ============================================================================


class AsoPdfReport(BasePdfReport):
    """Gera PDF do ASO usando template Jinja2 + WeasyPrint."""

    def __init__(self, data: dict):
        self.data = data
        self.context: dict = {}
        self.template_path = "aso_request/aso_template.html"
        nome = self.data.get("paciente", {}).get("nome", "paciente")
        self.filename = f"aso_{nome.replace(' ', '_')}.pdf"

    def build_context(self) -> None:
        paciente = self.data.get("paciente", {})
        empresa = self.data.get("empresa", {})
        medico = self.data.get("medico", {})

        if "cpf" in paciente:
            paciente["cpf"] = _fmt_cpf(paciente["cpf"])
        if "cnpj" in empresa:
            empresa["cnpj"] = _fmt_cnpj(empresa["cnpj"])
        if "crm" in medico:
            medico["crm"] = _fmt_crm(medico["crm"])

        agora = get_now_sao_paulo()
        self.data["data_geracao"] = agora.strftime("%d/%m/%Y")
        self.data.setdefault("funcao_do_paciente", "Não informado")

        self.context = self.data
        self.context["logo_path"] = os.path.join(
            current_app.root_path,
            "..",
            "static",
            "images",
            "logo_cmi.png",
        )


# Mapas de display para PDF
_TIPO_DISPLAY = {
    "ADMISSIONAL": "Admissional",
    "PERIODICO": "Periódico",
    "RETORNO_AO_TRABALHO": "Retorno ao Trabalho",
    "MUDANCA_DE_FUNCAO": "Mudança de Função",
    "DEMISSIONAL": "Demissional",
}

_CONCLUSAO_DISPLAY = {
    "APTO": "APTO",
    "INAPTO": "INAPTO",
    "APTO_COM_RESTRICOES": "APTO COM RESTRIÇÕES",
}


def _build_pdf_data_from_record(aso: SolicitacoesDeAso) -> dict:
    """Reconstrói dict de dados para PDF a partir de um ASO salvo."""
    return {
        "aso_id": aso.id,
        "paciente": {
            "nome": aso.paciente.nome if aso.paciente else "—",
            "cpf": aso.cpf_paciente,
        },
        "empresa": {
            "nome": aso.empresa.nome if aso.empresa else "—",
            "cnpj": aso.cnpj_empresa,
        },
        "medico": {
            "nome": aso.medico.nome if aso.medico else "—",
            "crm": aso.crm_medico,
        },
        "funcao_do_paciente": aso.funcao_paciente,
        "setor": aso.setor or "",
        "tipo_de_exame": {
            "exame": _TIPO_DISPLAY.get(aso.tipo_exame, aso.tipo_exame),
        },
        "riscos": aso.riscos_ocupacionais or {},
        "exames_solicitados": aso.exames_complementares or {},
        "conclusao": {
            "status": _CONCLUSAO_DISPLAY.get(aso.conclusao, aso.conclusao),
        },
        "restricoes": aso.restricoes or "",
        "nrs": aso.normas_regulamentadoras or {},
        "manipulacao_de_alimentos": aso.manipulacao_alimentos or "",
        "observacoes": aso.observacoes or "",
    }


# ============================================================================
# ROTAS — CRUD
# ============================================================================


@aso_bp.route("/asos", methods=["POST"])
def criar_aso():
    """
    Cria um ASO.

    Body JSON: payload com paciente, empresa, medico, campos do ASO.
    Query params:
      - gerar_pdf=true  → retorna PDF ao invés de JSON
    """
    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    ok, erro, entities = _validar_entidades(data)
    if not ok:
        return _json_error(erro)

    ok, erro = _validar_campos_aso(data)
    if not ok:
        return _json_error(erro)

    gerar_pdf = request.args.get("gerar_pdf", "false").lower() == "true"

    try:
        aso_record = _criar_aso_record(data, entities)

        if gerar_pdf:
            pdf_data = _build_pdf_data_from_record(aso_record)
            pdf = AsoPdfReport(pdf_data)
            return pdf.generate_response()

        return (
            jsonify(
                {
                    "message": "ASO criado com sucesso.",
                    "aso": aso_record.to_dict(include_relations=True),
                }
            ),
            201,
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao criar ASO")
        return _json_error(f"Erro interno ao criar ASO: {exc}", 500)


@aso_bp.route("/asos", methods=["GET"])
def listar_asos():
    """
    Lista ASOs com filtros.

    Query params:
      - cpf: filtra por paciente
      - cnpj: filtra por empresa
      - crm: filtra por médico
      - tipo_exame: ADMISSIONAL, PERIODICO, etc.
      - conclusao: APTO, INAPTO, APTO_COM_RESTRICOES
      - data_inicio, data_fim: intervalo de datas (YYYY-MM-DD)
      - search: busca por nome do paciente
      - limit, offset: paginação
      - order: data_desc (default) ou data_asc
    """
    try:
        query = SolicitacoesDeAso.query

        if cpf := request.args.get("cpf"):
            query = query.filter(SolicitacoesDeAso.cpf_paciente == _cpf_to_str(cpf))

        if cnpj := request.args.get("cnpj"):
            query = query.filter(SolicitacoesDeAso.cnpj_empresa == _to_int(cnpj))

        if crm := request.args.get("crm"):
            query = query.filter(SolicitacoesDeAso.crm_medico == _to_int(crm))

        if tipo := request.args.get("tipo_exame"):
            query = query.filter(SolicitacoesDeAso.tipo_exame == tipo.upper())

        if conclusao := request.args.get("conclusao"):
            query = query.filter(SolicitacoesDeAso.conclusao == conclusao.upper())

        if data_inicio := _parse_date(request.args.get("data_inicio")):
            query = query.filter(SolicitacoesDeAso.data >= data_inicio)

        if data_fim := _parse_date(request.args.get("data_fim")):
            query = query.filter(SolicitacoesDeAso.data <= data_fim)

        if search := request.args.get("search"):
            normalized_s = normalize_for_search(search)
            digits_s = _only_digits(search)
            aso_search_filters = [
                func.unaccent(Pacientes.nome).ilike(f"%{normalized_s}%")
            ]
            if digits_s and len(digits_s) >= 3:
                aso_search_filters.append(
                    SolicitacoesDeAso.cpf_paciente.ilike(f"%{digits_s}%")
                )
            query = query.outerjoin(
                Pacientes,
                SolicitacoesDeAso.cpf_paciente == Pacientes.cpf,
            ).filter(or_(*aso_search_filters))

        # Ordenação
        order = request.args.get("order", "data_desc")
        if order == "data_asc":
            query = query.order_by(
                SolicitacoesDeAso.data.asc(), SolicitacoesDeAso.hora.asc()
            )
        else:
            query = query.order_by(
                SolicitacoesDeAso.data.desc(), SolicitacoesDeAso.hora.desc()
            )

        # Paginação
        limit = min(int(request.args.get("limit", 50)), 200)
        offset = int(request.args.get("offset", 0))

        total = query.count()
        asos = query.offset(offset).limit(limit).all()

        return jsonify(
            {
                "total": total,
                "limit": limit,
                "offset": offset,
                "asos": [a.to_dict(include_relations=True) for a in asos],
            }
        )

    except Exception as exc:
        LOGGER.exception("Erro ao listar ASOs")
        return _json_error(f"Erro ao listar ASOs: {exc}", 500)


@aso_bp.route("/asos/<int:aso_id>", methods=["GET"])
def detalhe_aso(aso_id: int):
    """Retorna detalhe de um ASO por ID."""
    aso = SolicitacoesDeAso.query.get(aso_id)
    if not aso:
        return _json_error("ASO não encontrado.", 404)
    return jsonify(aso.to_dict(include_relations=True))


@aso_bp.route("/asos/<int:aso_id>", methods=["PUT"])
def atualizar_aso(aso_id: int):
    """Atualiza um ASO existente (campos parciais)."""
    aso = SolicitacoesDeAso.query.get(aso_id)
    if not aso:
        return _json_error("ASO não encontrado.", 404)

    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    try:
        if "tipo_de_exame" in data:
            tipo_raw = data["tipo_de_exame"].get("exame", "")
            if tipo_raw:
                aso.tipo_exame = _normalizar_tipo_exame(tipo_raw)

        if "funcao_do_paciente" in data:
            aso.funcao_paciente = data["funcao_do_paciente"].strip()

        if "setor" in data:
            aso.setor = data["setor"].strip() or None

        if "conclusao" in data:
            status = data["conclusao"].get("status", "")
            if status:
                aso.conclusao = _normalizar_conclusao(status)

        if "restricoes" in data:
            aso.restricoes = data["restricoes"].strip() or None

        if "riscos" in data:
            aso.riscos_ocupacionais = data["riscos"]

        if "exames_solicitados" in data:
            aso.exames_complementares = data["exames_solicitados"]

        if "nrs" in data:
            aso.normas_regulamentadoras = data["nrs"]

        if "manipulacao_de_alimentos" in data:
            aso.manipulacao_alimentos = data["manipulacao_de_alimentos"].strip() or None

        if "observacoes" in data:
            aso.observacoes = data["observacoes"].strip() or None

        db.session.commit()
        LOGGER.info("ASO #%d atualizado", aso_id)

        return jsonify(
            {
                "message": "ASO atualizado com sucesso.",
                "aso": aso.to_dict(include_relations=True),
            }
        )

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao atualizar ASO #%d", aso_id)
        return _json_error(f"Erro ao atualizar ASO: {exc}", 500)


@aso_bp.route("/asos/<int:aso_id>", methods=["DELETE"])
def excluir_aso(aso_id: int):
    """Exclui um ASO."""
    aso = SolicitacoesDeAso.query.get(aso_id)
    if not aso:
        return _json_error("ASO não encontrado.", 404)

    try:
        db.session.delete(aso)
        db.session.commit()
        LOGGER.info("ASO #%d excluído", aso_id)
        return jsonify({"message": f"ASO #{aso_id} excluído com sucesso."})
    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao excluir ASO #%d", aso_id)
        return _json_error(f"Erro ao excluir ASO: {exc}", 500)


# ============================================================================
# ROTAS — Histórico e Estatísticas
# ============================================================================


@aso_bp.route("/asos/historico/<cpf>", methods=["GET"])
def historico_paciente(cpf: str):
    """
    Retorna todos os ASOs de um paciente, ordenados por data desc.

    Útil para acompanhar a trajetória ocupacional do trabalhador
    conforme exigido pela NR-7 (prontuário mantido por 20 anos).
    """
    cpf_str = _cpf_to_str(cpf)
    if cpf_str is None:
        return _json_error("CPF inválido.")

    paciente = Pacientes.query.filter_by(cpf=cpf_str).first()
    if not paciente:
        return _json_error("Paciente não encontrado.", 404)

    asos = (
        SolicitacoesDeAso.query.filter_by(cpf_paciente=cpf_str)
        .order_by(SolicitacoesDeAso.data.desc(), SolicitacoesDeAso.hora.desc())
        .all()
    )

    return jsonify(
        {
            "paciente": {
                "nome": paciente.nome,
                "cpf": cpf_str,
                "cpf_formatado": _fmt_cpf(cpf_str),
            },
            "total": len(asos),
            "asos": [a.to_dict(include_relations=True) for a in asos],
        }
    )


@aso_bp.route("/asos/stats", methods=["GET"])
def stats_asos():
    """
    Estatísticas gerais de ASOs.

    Query params opcionais:
      - data_inicio, data_fim
      - cnpj: filtrar por empresa
    """
    try:
        query = SolicitacoesDeAso.query

        if cnpj := request.args.get("cnpj"):
            query = query.filter(SolicitacoesDeAso.cnpj_empresa == _to_int(cnpj))

        if data_inicio := _parse_date(request.args.get("data_inicio")):
            query = query.filter(SolicitacoesDeAso.data >= data_inicio)

        if data_fim := _parse_date(request.args.get("data_fim")):
            query = query.filter(SolicitacoesDeAso.data <= data_fim)

        asos = query.all()
        total = len(asos)

        por_tipo = {t: sum(1 for a in asos if a.tipo_exame == t) for t in TIPOS_EXAME}
        por_conclusao = {
            c: sum(1 for a in asos if a.conclusao == c) for c in CONCLUSOES
        }

        # Top empresas por volume de ASOs
        empresas_count: dict[str, int] = {}
        for a in asos:
            nome = a.empresa.nome if a.empresa else str(a.cnpj_empresa)
            empresas_count[nome] = empresas_count.get(nome, 0) + 1

        top_empresas = sorted(
            [{"nome": k, "total": v} for k, v in empresas_count.items()],
            key=lambda x: x["total"],
            reverse=True,
        )[:10]

        return jsonify(
            {
                "total": total,
                "pacientes_unicos": len({a.cpf_paciente for a in asos}),
                "por_tipo_exame": por_tipo,
                "por_conclusao": por_conclusao,
                "top_empresas": top_empresas,
            }
        )

    except Exception as exc:
        LOGGER.exception("Erro ao gerar stats de ASOs")
        return _json_error(f"Erro ao gerar estatísticas: {exc}", 500)


# ============================================================================
# ROTAS — PDF
# ============================================================================


@aso_bp.route("/asos/gerar-pdf", methods=["POST"])
def gerar_pdf_preview():
    """Gera PDF do ASO sem salvar no banco (modo preview/rascunho)."""
    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    ok, erro, _entities = _validar_entidades(data)
    if not ok:
        return _json_error(erro)

    ok, erro = _validar_campos_aso(data)
    if not ok:
        return _json_error(erro)

    try:
        pdf = AsoPdfReport(data)
        return pdf.generate_response()
    except Exception as exc:
        LOGGER.exception("Erro ao gerar PDF preview de ASO")
        return _json_error(f"Erro ao gerar PDF: {exc}", 500)


@aso_bp.route("/asos/<int:aso_id>/pdf", methods=["GET"])
def gerar_pdf_salvo(aso_id: int):
    """Re-gera PDF de um ASO já salvo no banco."""
    aso = SolicitacoesDeAso.query.get(aso_id)
    if not aso:
        return _json_error("ASO não encontrado.", 404)

    try:
        pdf_data = _build_pdf_data_from_record(aso)
        pdf = AsoPdfReport(pdf_data)
        return pdf.generate_response()
    except Exception as exc:
        LOGGER.exception("Erro ao gerar PDF do ASO #%d", aso_id)
        return _json_error(f"Erro ao gerar PDF: {exc}", 500)


# ============================================================================
# ROTA LEGADA (compatibilidade com frontend atual)
# ============================================================================


@aso_bp.route("/gerar_aso", methods=["POST"])
def gerar_aso_legado():
    """
    Endpoint legado: gera PDF e opcionalmente salva.
    Mantido para compatibilidade com o frontend existente.
    """
    data = request.get_json()
    if not data:
        return _json_error("Dados JSON ausentes.")

    ok, erro, entities = _validar_entidades(data)
    if not ok:
        return _json_error(erro)

    ok, erro = _validar_campos_aso(data)
    if not ok:
        return _json_error(erro)

    try:
        if data.get("salvar_aso") is True:
            _criar_aso_record(data, entities)

        pdf = AsoPdfReport(data)
        return pdf.generate_response()

    except Exception as exc:
        db.session.rollback()
        LOGGER.exception("Erro ao gerar ASO (legado)")
        return _json_error(f"Erro interno ao gerar ASO: {exc}", 500)
