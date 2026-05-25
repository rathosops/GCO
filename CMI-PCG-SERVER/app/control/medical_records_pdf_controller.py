"""
Controller para geração de PDF de prontuário médico.

Rotas:
- GET /prontuarios/pdf?cpf=<cpf>  Gera PDF do prontuário completo
- GET /prontuarios/preview?cpf=<cpf>  Retorna dados para preview (JSON)

Filtros opcionais (query params):
- data_inicio, data_fim
- tipo
- crm_medico
- busca (texto livre na anamnese/procedimentos)
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

from flask import (
    Blueprint,
    current_app,
    jsonify,
    make_response,
    render_template,
    request,
)
from sqlalchemy import or_
from weasyprint import HTML

from app.database import db
from app.models.medical_appointments_model import Consultas
from app.models.patients_model import Pacientes
from app.utils.timezone import get_now_sao_paulo

LOGGER = logging.getLogger(__name__)

prontuario_pdf_bp = Blueprint("prontuario_pdf", __name__)

DATE_FORMATS = ("%d/%m/%Y", "%Y-%m-%d")


# =============================================================================
# Helpers
# =============================================================================


def _json_error(message: str, status_code: int = 400):
    """Retorna erro padronizado em JSON."""
    return jsonify({"error": message}), status_code


def _only_digits(value: Any) -> str:
    """Extrai apenas dígitos de uma string."""
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _clean_cpf(value: Any) -> Optional[str]:
    """Retorna CPF como string de 11 dígitos ou None."""
    digits = _only_digits(value)
    if len(digits) != 11:
        return None
    return digits


def _parse_date(value: str | None) -> Optional[date]:
    """Converte string para date, suportando DD/MM/YYYY e YYYY-MM-DD."""
    if not value:
        return None
    value = value.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _format_cpf(cpf: str | None) -> str:
    """Formata CPF com máscara XXX.XXX.XXX-XX."""
    if not cpf:
        return "Não informado"
    digits = _only_digits(cpf)
    digits = digits.zfill(11)
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"


def _format_telefone(telefone: int | None) -> Optional[str]:
    """Formata telefone com máscara brasileira."""
    if telefone is None:
        return None
    tel = str(telefone)
    if len(tel) > 11:
        tel = tel.lstrip("0")
    if len(tel) == 11:
        return f"({tel[:2]}) {tel[2:7]}-{tel[7:]}"
    if len(tel) == 10:
        return f"({tel[:2]}) {tel[2:6]}-{tel[6:]}"
    return tel


def _format_date_br(d: date | None) -> str:
    """Formata data no padrão DD/MM/YYYY."""
    if d is None:
        return "Não informado"
    return d.strftime("%d/%m/%Y")


def _format_datetime_br(dt: datetime | None) -> Optional[str]:
    """Formata datetime no padrão DD/MM/YYYY às HH:MM."""
    if dt is None:
        return None
    return dt.strftime("%d/%m/%Y às %H:%M")


def _calcular_idade(data_nascimento: date | None) -> Optional[int]:
    """Calcula idade a partir da data de nascimento."""
    if data_nascimento is None:
        return None
    hoje = get_now_sao_paulo().date()
    idade = hoje.year - data_nascimento.year
    if (hoje.month, hoje.day) < (data_nascimento.month, data_nascimento.day):
        idade -= 1
    return idade


def _get_logo_path() -> Optional[str]:
    """Retorna file:// URI do logo para o WeasyPrint."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    candidates = [
        base_dir / "static" / "images" / "logo_cmi.png",
        base_dir / "static" / "images" / "logo.png",
        base_dir / "static" / "logo.png",
    ]
    for path in candidates:
        if path.exists():
            return f"file://{path.absolute()}"
    return None


def _get_clinic_info() -> dict:
    """Retorna informações da clínica via env vars."""
    return {
        "nome": os.getenv("CLINIC_NAME", "Centro Médico Integrado"),
        "endereco": os.getenv("CLINIC_ADDRESS"),
        "telefone": os.getenv("CLINIC_PHONE"),
        "email": os.getenv("CLINIC_EMAIL"),
    }


# =============================================================================
# Preparação de contexto
# =============================================================================


def _build_paciente_context(paciente: Pacientes) -> dict:
    """Constrói contexto do paciente para o template."""
    endereco_parts = []
    if paciente.logradouro:
        parte = paciente.logradouro
        if paciente.numero:
            parte += f", {paciente.numero}"
        endereco_parts.append(parte)
    if paciente.complemento:
        endereco_parts.append(paciente.complemento)
    if paciente.bairro:
        endereco_parts.append(paciente.bairro)
    if paciente.cidade:
        cidade_uf = paciente.cidade
        if paciente.uf:
            cidade_uf += f"/{paciente.uf}"
        endereco_parts.append(cidade_uf)
    if paciente.cep:
        cep = paciente.cep
        if len(cep) == 8:
            cep = f"{cep[:5]}-{cep[5:]}"
        endereco_parts.append(f"CEP {cep}")

    endereco_completo = " – ".join(endereco_parts) if endereco_parts else None

    # Fallback para campo legado
    if not endereco_completo and paciente.endereco:
        endereco_completo = paciente.endereco

    sexo_map = {"M": "Masculino", "F": "Feminino"}

    empresa_nome = None
    if paciente.vinculado_a_empresa and paciente.empresa:
        empresa_nome = getattr(paciente.empresa, "nome", None)

    convenio_nome = None
    if paciente.vinculado_a_convenio and paciente.convenio:
        convenio_nome = getattr(paciente.convenio, "nome", None)

    return {
        "nome": paciente.nome,
        "cpf": paciente.cpf,
        "cpf_formatado": _format_cpf(paciente.cpf),
        "data_nascimento_br": _format_date_br(paciente.data_de_nascimento),
        "idade": _calcular_idade(paciente.data_de_nascimento),
        "sexo": paciente.sexo,
        "sexo_descritivo": sexo_map.get(paciente.sexo, paciente.sexo),
        "telefone": _format_telefone(paciente.numero_de_contato),
        "email": paciente.email,
        "endereco_completo": endereco_completo,
        "empresa_nome": empresa_nome,
        "convenio_nome": convenio_nome,
        "protocolo_imesc": paciente.protocolo_imesc,
    }


def _build_consulta_context(consulta: Consultas) -> dict:
    """Constrói contexto de uma consulta para o template."""
    return {
        "id": consulta.id,
        "data_br": _format_date_br(consulta.data),
        "hora": (
            consulta.hora_consulta.strftime("%H:%M") if consulta.hora_consulta else None
        ),
        "tipo": consulta.tipo,
        "nome_medico": consulta._get_medico_nome(),
        "crm_medico": consulta.crm_medico,
        "especialidade_medico": consulta._get_medico_especialidade(),
        # Anamnese expandida
        "queixa_principal": consulta.queixa_principal,
        "historia_doenca_atual": consulta.historia_doenca_atual,
        "anamnese": consulta.anamnese,
        "exame_fisico": consulta.exame_fisico,
        # Procedimentos
        "procedimentos": consulta.procedimentos,
        # Diagnóstico e conduta
        "diagnostico": consulta.diagnostico,
        "cid": consulta.cid,
        "conduta": consulta.conduta,
        # Prescrições
        "houve_solicitacao_de_exame": consulta.houve_solicitacao_de_exame or False,
        "houve_prescricao_medicamentos": (
            consulta.houve_prescricao_medicamentos or False
        ),
        "medicamentos_prescrevidos": consulta.medicamentos_prescrevidos,
        # Retorno
        "retorno_em": consulta.retorno_em,
        "data_retorno_br": (
            _format_date_br(consulta.data_retorno) if consulta.data_retorno else None
        ),
        # Observações
        "observacoes_internas": consulta.observacoes_internas,
        # Auditoria
        "created_at": _format_datetime_br(consulta.created_at),
        "updated_at": _format_datetime_br(consulta.updated_at),
    }


def _build_stats(consultas: list[Consultas]) -> dict:
    """Calcula estatísticas resumidas das consultas."""
    total = len(consultas)
    medicos = {c.crm_medico for c in consultas if c.crm_medico}
    tipos = {c.tipo for c in consultas if c.tipo}
    com_exame = sum(1 for c in consultas if c.houve_solicitacao_de_exame)
    com_prescricao = sum(1 for c in consultas if c.houve_prescricao_medicamentos)

    periodo = None
    if consultas:
        datas = [c.data for c in consultas if c.data]
        if datas:
            mais_antiga = min(datas)
            mais_recente = max(datas)
            if mais_antiga != mais_recente:
                periodo = (
                    f"{_format_date_br(mais_antiga)} a "
                    f"{_format_date_br(mais_recente)}"
                )
            else:
                periodo = _format_date_br(mais_antiga)

    return {
        "total": total,
        "total_medicos": len(medicos),
        "total_tipos": len(tipos),
        "com_exame": com_exame,
        "com_prescricao": com_prescricao,
        "periodo": periodo,
    }


def _build_filtros_text(args: dict) -> Optional[str]:
    """Monta string legível dos filtros aplicados."""
    parts = []
    if args.get("data_inicio"):
        parts.append(f"De: {args['data_inicio']}")
    if args.get("data_fim"):
        parts.append(f"Até: {args['data_fim']}")
    if args.get("tipo"):
        parts.append(f"Tipo: {args['tipo']}")
    if args.get("crm_medico"):
        parts.append(f"CRM Médico: {args['crm_medico']}")
    if args.get("busca"):
        parts.append(f"Busca: \"{args['busca']}\"")
    return " | ".join(parts) if parts else None


# =============================================================================
# Query de consultas com filtros
# =============================================================================


def _query_consultas(cpf_digits: str, args: dict) -> list[Consultas]:
    """Busca consultas do paciente aplicando filtros opcionais."""
    query = Consultas.query.filter(Consultas.cpf_paciente == cpf_digits)

    if data_inicio := _parse_date(args.get("data_inicio")):
        query = query.filter(Consultas.data >= data_inicio)

    if data_fim := _parse_date(args.get("data_fim")):
        query = query.filter(Consultas.data <= data_fim)

    if tipo := args.get("tipo"):
        tipo = tipo.strip()
        if tipo:
            query = query.filter(Consultas.tipo.ilike(f"%{tipo}%"))

    if crm_medico := args.get("crm_medico"):
        crm_digits = _only_digits(crm_medico)
        if crm_digits:
            query = query.filter(Consultas.crm_medico == int(crm_digits))

    if busca := args.get("busca"):
        busca = busca.strip()
        if busca:
            like_pattern = f"%{busca}%"
            query = query.filter(
                or_(
                    Consultas.anamnese.ilike(like_pattern),
                    Consultas.procedimentos.ilike(like_pattern),
                    Consultas.diagnostico.ilike(like_pattern),
                    Consultas.queixa_principal.ilike(like_pattern),
                    Consultas.conduta.ilike(like_pattern),
                )
            )

    return query.order_by(
        Consultas.data.desc(),
        Consultas.hora_consulta.desc(),
    ).all()


# =============================================================================
# Rotas
# =============================================================================


@prontuario_pdf_bp.route("/prontuarios/preview", methods=["GET"])
def get_prontuario_preview():
    """Retorna dados do prontuário para preview (JSON)."""
    cpf_digits = _clean_cpf(request.args.get("cpf"))
    if cpf_digits is None:
        return _json_error("CPF é obrigatório e deve ter 11 dígitos.", 400)

    paciente = Pacientes.query.filter(Pacientes.cpf == cpf_digits).first()
    if not paciente:
        return _json_error("Paciente não encontrado.", 404)

    consultas = _query_consultas(cpf_digits, request.args)

    return (
        jsonify(
            {
                "paciente": _build_paciente_context(paciente),
                "consultas": [_build_consulta_context(c) for c in consultas],
                "stats": _build_stats(consultas),
                "filtros": _build_filtros_text(request.args),
                "data_geracao": get_now_sao_paulo().strftime("%d/%m/%Y às %H:%M"),
            }
        ),
        200,
    )


@prontuario_pdf_bp.route("/prontuarios/pdf", methods=["GET"])
def generate_prontuario_pdf():
    """Gera PDF completo do prontuário médico."""
    cpf_digits = _clean_cpf(request.args.get("cpf"))
    if cpf_digits is None:
        return _json_error("CPF é obrigatório e deve ter 11 dígitos.", 400)

    paciente = Pacientes.query.filter(Pacientes.cpf == cpf_digits).first()
    if not paciente:
        return _json_error("Paciente não encontrado.", 404)

    try:
        consultas = _query_consultas(cpf_digits, request.args)
        clinic_info = _get_clinic_info()
        now = get_now_sao_paulo()

        # Contexto do template
        paciente_ctx = _build_paciente_context(paciente)
        consultas_ctx = [_build_consulta_context(c) for c in consultas]
        stats = _build_stats(consultas)
        filtros_text = _build_filtros_text(request.args)

        html_content = render_template(
            "prontuarios/prontuario_report.html",
            paciente=paciente_ctx,
            consultas=consultas_ctx,
            stats=stats,
            filtros_aplicados=filtros_text,
            logo_path=_get_logo_path(),
            clinica_nome=clinic_info.get("nome"),
            clinica_endereco=clinic_info.get("endereco"),
            data_geracao=now.strftime("%d/%m/%Y às %H:%M"),
        )

        # Gera PDF via WeasyPrint
        html = HTML(string=html_content, base_url=current_app.static_folder)
        pdf_buffer = BytesIO()
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        # Nome do arquivo
        nome_arquivo = (paciente.nome or "paciente").replace(" ", "_")[:30]
        data_str = now.strftime("%Y%m%d")
        filename = f"prontuario_{nome_arquivo}_{data_str}.pdf"

        response = make_response(pdf_buffer.read())
        response.headers["Content-Type"] = "application/pdf"

        download = request.args.get("download", "false").lower() == "true"
        disposition = "attachment" if download else "inline"
        response.headers["Content-Disposition"] = (
            f'{disposition}; filename="{filename}"'
        )

        LOGGER.info(
            "PDF de prontuário gerado para paciente CPF=%s (%d consultas)",
            cpf_digits,
            len(consultas),
        )

        return response

    except Exception as exc:
        LOGGER.exception("Erro ao gerar PDF do prontuário para CPF=%s", cpf_digits)
        return _json_error(f"Erro ao gerar PDF: {exc}", 500)


@prontuario_pdf_bp.route("/prontuarios/pdf/html", methods=["GET"])
def get_prontuario_html():
    """Retorna HTML do prontuário (debug/preview)."""
    cpf_digits = _clean_cpf(request.args.get("cpf"))
    if cpf_digits is None:
        return _json_error("CPF é obrigatório e deve ter 11 dígitos.", 400)

    paciente = Pacientes.query.filter(Pacientes.cpf == cpf_digits).first()
    if not paciente:
        return _json_error("Paciente não encontrado.", 404)

    try:
        consultas = _query_consultas(cpf_digits, request.args)
        clinic_info = _get_clinic_info()
        now = get_now_sao_paulo()

        html_content = render_template(
            "prontuarios/prontuario_report.html",
            paciente=_build_paciente_context(paciente),
            consultas=[_build_consulta_context(c) for c in consultas],
            stats=_build_stats(consultas),
            filtros_aplicados=_build_filtros_text(request.args),
            logo_path=_get_logo_path(),
            clinica_nome=clinic_info.get("nome"),
            clinica_endereco=clinic_info.get("endereco"),
            data_geracao=now.strftime("%d/%m/%Y às %H:%M"),
        )

        if request.args.get("raw", "false").lower() == "true":
            response = make_response(html_content)
            response.headers["Content-Type"] = "text/html; charset=utf-8"
            return response

        return jsonify({"html": html_content}), 200

    except Exception as exc:
        LOGGER.exception("Erro ao gerar HTML do prontuário")
        return _json_error(f"Erro ao gerar HTML: {exc}", 500)
