"""
Controller para geração de PDF de comprovante de agendamento.

Rotas:
- GET /agendamentos/<id>/comprovante/pdf  Gera PDF do comprovante
- GET /agendamentos/<id>/comprovante      Retorna dados para preview
"""

from __future__ import annotations

import logging
from datetime import date, time
from io import BytesIO
from pathlib import Path

from flask import (
    Blueprint,
    current_app,
    jsonify,
    make_response,
    render_template,
    request,
)
from weasyprint import HTML

from app.models.appointments_model import Agendamentos
from app.utils.timezone import get_now_sao_paulo

LOGGER = logging.getLogger(__name__)

agendamento_comprovante_bp = Blueprint("agendamento_comprovante", __name__)


# =============================================================================
# Helpers
# =============================================================================


def _not_found(message: str = "Agendamento não encontrado"):
    return jsonify({"error": message}), 404


def _format_cpf(cpf: int | None) -> str:
    """Formata CPF com máscara XXX.XXX.XXX-XX."""
    if cpf is None:
        return "Não informado"
    cpf_str = str(cpf).zfill(11)
    return f"{cpf_str[:3]}.{cpf_str[3:6]}.{cpf_str[6:9]}-{cpf_str[9:]}"


def _format_telefone(telefone: int | None) -> str:
    """Formata telefone com máscara (XX) XXXXX-XXXX ou (XX) XXXX-XXXX."""
    if telefone is None:
        return "Não informado"

    tel_str = str(telefone)

    if len(tel_str) > 11:
        tel_str = tel_str.lstrip("0")

    if len(tel_str) == 11:
        return f"({tel_str[:2]}) {tel_str[2:7]}-{tel_str[7:]}"
    if len(tel_str) == 10:
        return f"({tel_str[:2]}) {tel_str[2:6]}-{tel_str[6:]}"

    return tel_str


def _format_date_br(d: date | None) -> str:
    """Formata data no padrão brasileiro DD/MM/YYYY."""
    if d is None:
        return "Não informado"
    return d.strftime("%d/%m/%Y")


def _format_time(t: time | None) -> str:
    """Formata hora no padrão HH:MM."""
    if t is None:
        return "Não informado"
    return t.strftime("%H:%M")


def _get_day_of_week(d: date | None) -> str:
    """Retorna o dia da semana em português."""
    if d is None:
        return ""

    dias = [
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado",
        "Domingo",
    ]
    return dias[d.weekday()]


def _get_logo_path() -> str | None:
    """
    Retorna o caminho absoluto do logo com file:// URI para WeasyPrint.
    """
    # Caminho relativo ao diretório do projeto
    base_dir = Path(__file__).resolve().parent.parent.parent
    logo_candidates = [
        base_dir / "static" / "images" / "logo_cmi.png",
        base_dir / "static" / "images" / "logo.png",
        base_dir / "static" / "logo.png",
    ]

    for logo_path in logo_candidates:
        if logo_path.exists():
            # WeasyPrint precisa de file:// URI
            return f"file://{logo_path.absolute()}"

    return None


def _prepare_agendamento_context(agendamento: Agendamentos) -> dict:
    """Prepara o contexto do agendamento para o template."""
    return {
        "id": agendamento.id,
        "dia": agendamento.dia,
        "hora": agendamento.hora,
        "dia_formatado": _format_date_br(agendamento.dia),
        "hora_formatada": _format_time(agendamento.hora),
        "dia_semana": _get_day_of_week(agendamento.dia),
        "cpf_paciente": agendamento.cpf_paciente,
        "cpf_formatado": _format_cpf(agendamento.cpf_paciente),
        "nome_paciente": agendamento.nome_paciente,
        "procedimento": agendamento.procedimento,
        "numero_de_contato": agendamento.numero_de_contato,
        "telefone_formatado": _format_telefone(agendamento.numero_de_contato),
        "numero_de_protocolo": agendamento.numero_de_protocolo,
        "status": agendamento.status,
        "observacoes": agendamento.observacoes,
        "paciente_compareceu": agendamento.paciente_compareceu,
    }


def _get_clinic_info() -> dict:
    """Retorna informações da clínica."""
    import os

    return {
        "nome": os.getenv("CLINIC_NAME", "Centro Médico Integrado"),
        "endereco": os.getenv("CLINIC_ADDRESS"),
        "telefone": os.getenv("CLINIC_PHONE"),
        "email": os.getenv("CLINIC_EMAIL"),
    }


# =============================================================================
# Rotas
# =============================================================================


@agendamento_comprovante_bp.route(
    "/agendamentos/<int:agendamento_id>/comprovante", methods=["GET"]
)
def get_comprovante_data(agendamento_id: int):
    """Retorna dados do comprovante para preview (JSON)."""
    agendamento = Agendamentos.query.get(agendamento_id)
    if not agendamento:
        return _not_found()

    context = _prepare_agendamento_context(agendamento)
    clinic_info = _get_clinic_info()

    return (
        jsonify(
            {
                "agendamento": context,
                "clinica": clinic_info,
                "data_geracao": get_now_sao_paulo().strftime("%d/%m/%Y às %H:%M"),
            }
        ),
        200,
    )


@agendamento_comprovante_bp.route(
    "/agendamentos/<int:agendamento_id>/comprovante/pdf", methods=["GET"]
)
def generate_comprovante_pdf(agendamento_id: int):
    """Gera PDF do comprovante de agendamento."""
    agendamento = Agendamentos.query.get(agendamento_id)
    if not agendamento:
        return _not_found()

    try:
        agendamento_ctx = _prepare_agendamento_context(agendamento)
        clinic_info = _get_clinic_info()
        logo_path = _get_logo_path()

        html_content = render_template(
            "agendamentos/comprovante_agendamento.html",
            agendamento=agendamento_ctx,
            logo_path=logo_path,
            clinica_nome=clinic_info.get("nome"),
            clinica_endereco=clinic_info.get("endereco"),
            clinica_telefone=clinic_info.get("telefone"),
            clinica_email=clinic_info.get("email"),
            data_geracao=get_now_sao_paulo().strftime("%d/%m/%Y às %H:%M"),
        )

        html = HTML(string=html_content, base_url=current_app.static_folder)
        pdf_buffer = BytesIO()
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        protocolo = agendamento.numero_de_protocolo or agendamento.id
        nome_paciente = (agendamento.nome_paciente or "paciente").replace(" ", "_")[:30]
        data_str = agendamento.dia.strftime("%Y%m%d") if agendamento.dia else "sem_data"
        filename = f"comprovante_{protocolo}_{nome_paciente}_{data_str}.pdf"

        response = make_response(pdf_buffer.read())
        response.headers["Content-Type"] = "application/pdf"

        download = request.args.get("download", "false").lower() == "true"
        disposition = "attachment" if download else "inline"
        response.headers["Content-Disposition"] = (
            f'{disposition}; filename="{filename}"'
        )

        LOGGER.info("PDF de comprovante gerado para agendamento %s", agendamento_id)

        return response

    except Exception as exc:
        LOGGER.exception(
            "Erro ao gerar PDF do comprovante para agendamento %s", agendamento_id
        )
        return jsonify({"error": f"Erro ao gerar PDF: {str(exc)}"}), 500


@agendamento_comprovante_bp.route(
    "/agendamentos/<int:agendamento_id>/comprovante/html", methods=["GET"]
)
def get_comprovante_html(agendamento_id: int):
    """Retorna HTML do comprovante (para debug/preview)."""
    agendamento = Agendamentos.query.get(agendamento_id)
    if not agendamento:
        return _not_found()

    try:
        agendamento_ctx = _prepare_agendamento_context(agendamento)
        clinic_info = _get_clinic_info()
        logo_path = _get_logo_path()

        html_content = render_template(
            "agendamentos/comprovante_agendamento.html",
            agendamento=agendamento_ctx,
            logo_path=logo_path,
            clinica_nome=clinic_info.get("nome"),
            clinica_endereco=clinic_info.get("endereco"),
            clinica_telefone=clinic_info.get("telefone"),
            clinica_email=clinic_info.get("email"),
            data_geracao=get_now_sao_paulo().strftime("%d/%m/%Y às %H:%M"),
        )

        if request.args.get("raw", "false").lower() == "true":
            response = make_response(html_content)
            response.headers["Content-Type"] = "text/html; charset=utf-8"
            return response

        return jsonify({"html": html_content}), 200

    except Exception as exc:
        LOGGER.exception("Erro ao gerar HTML do comprovante")
        return jsonify({"error": str(exc)}), 500
