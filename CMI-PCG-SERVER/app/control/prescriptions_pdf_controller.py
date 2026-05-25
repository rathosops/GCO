"""
Controller para geração de PDF de receituário médico.

Rotas:
    GET /receituarios/<id>/pdf         → Gera PDF da receita
    GET /receituarios/<id>/pdf/html    → Preview HTML (debug)

Formatos:
    - A4 portrait
    - Cabeçalho com dados da clínica e médico
    - Lista de medicamentos com posologia completa
    - Assinatura do médico com CRM
    - Rodapé com validade e informações legais
"""

from __future__ import annotations

import logging
import os
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

from app.models.prescriptions_model import TIPOS_RECEITA, Receituarios
from app.utils.timezone import get_now_sao_paulo

LOGGER = logging.getLogger(__name__)

receituario_pdf_bp = Blueprint("receituario_pdf", __name__)


# ── Helpers ──────────────────────────────────────────────────────────────


def _get_logo_path() -> str | None:
    """Retorna file:// URI do logo para WeasyPrint."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    for name in ("logo_cmi.png", "logo.png"):
        path = base_dir / "static" / "images" / name
        if path.exists():
            return f"file://{path.absolute()}"
    return None


def _get_clinic_info() -> dict:
    """Retorna informações da clínica."""
    return {
        "nome": os.getenv("CLINIC_NAME", "Centro Médico Integrado"),
        "endereco": os.getenv("CLINIC_ADDRESS"),
        "telefone": os.getenv("CLINIC_PHONE"),
        "email": os.getenv("CLINIC_EMAIL"),
        "cnpj": os.getenv("CLINIC_CNPJ"),
    }


def _format_cpf(cpf: str | None) -> str:
    """Formata CPF com máscara."""
    if not cpf or len(cpf) != 11:
        return cpf or ""
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"


def _calcular_idade(data_nascimento) -> int | None:
    """Calcula idade."""
    if not data_nascimento:
        return None
    hoje = get_now_sao_paulo().date()
    idade = hoje.year - data_nascimento.year
    if (hoje.month, hoje.day) < (data_nascimento.month, data_nascimento.day):
        idade -= 1
    return idade


def _build_context(receituario: Receituarios) -> dict:
    """Monta contexto completo para o template."""
    paciente = receituario.paciente
    medico = receituario.medico

    paciente_ctx = {}
    if paciente:
        paciente_ctx = {
            "nome": paciente.nome,
            "cpf_formatado": _format_cpf(paciente.cpf),
            "data_nascimento_br": (
                paciente.data_de_nascimento.strftime("%d/%m/%Y")
                if paciente.data_de_nascimento
                else None
            ),
            "idade": _calcular_idade(paciente.data_de_nascimento),
            "sexo": paciente.sexo,
            "endereco": getattr(paciente, "endereco", None),
        }

    medico_ctx = {}
    if medico:
        medico_ctx = {
            "nome": medico.nome,
            "crm": medico.crm,
            "especialidade": medico.especialidade,
            "sexo": medico.sexo,
        }

    itens_ctx = []
    for item in receituario.itens:
        itens_ctx.append(
            {
                "ordem": item.ordem,
                "nome_medicamento": item.nome_medicamento,
                "principio_ativo": item.principio_ativo,
                "concentracao": item.concentracao,
                "forma_farmaceutica": item.forma_farmaceutica,
                "descricao_completa": item.descricao_completa,
                "via_administracao": item.via_administracao,
                "posologia": item.posologia,
                "quantidade": item.quantidade,
                "unidade_quantidade": item.unidade_quantidade,
                "duracao_dias": item.duracao_dias,
                "uso_continuo": item.uso_continuo,
                "is_amostra_gratis": item.is_amostra_gratis,
                "observacoes": item.observacoes,
            }
        )

    return {
        "receituario": {
            "id": receituario.id,
            "tipo_receita": receituario.tipo_receita,
            "tipo_descricao": receituario.tipo_descricao,
            "data_prescricao_br": (
                receituario.data_prescricao.strftime("%d/%m/%Y")
                if receituario.data_prescricao
                else None
            ),
            "data_validade_br": (
                receituario.data_validade.strftime("%d/%m/%Y")
                if receituario.data_validade
                else None
            ),
            "validade_dias": receituario.validade_dias,
            "numero_vias": receituario.numero_vias,
            "observacoes_gerais": receituario.observacoes_gerais,
            "orientacoes_paciente": receituario.orientacoes_paciente,
            "status": receituario.status_efetivo,
        },
        "paciente": paciente_ctx,
        "medico": medico_ctx,
        "itens": itens_ctx,
        "logo_path": _get_logo_path(),
        "clinica": _get_clinic_info(),
        "data_geracao": get_now_sao_paulo().strftime("%d/%m/%Y às %H:%M"),
    }


# ══════════════════════════════════════════════════════════════════════════
# ROTAS
# ══════════════════════════════════════════════════════════════════════════


@receituario_pdf_bp.route("/receituarios/<int:rec_id>/pdf", methods=["GET"])
def generate_receituario_pdf(rec_id: int):
    """Gera PDF do receituário médico."""
    rec = Receituarios.query.get(rec_id)
    if not rec:
        return jsonify({"error": "Receituário não encontrado"}), 404

    try:
        context = _build_context(rec)

        html_content = render_template(
            "prescriptions/prescription_report.html",
            **context,
        )

        html = HTML(string=html_content, base_url=current_app.static_folder)
        pdf_buffer = BytesIO()
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        # Nome do arquivo
        nome_pac = (rec.paciente.nome if rec.paciente else "paciente").replace(
            " ", "_"
        )[:25]
        data_str = rec.data_prescricao.strftime("%Y%m%d") if rec.data_prescricao else ""
        filename = f"receituario_{nome_pac}_{data_str}.pdf"

        response = make_response(pdf_buffer.read())
        response.headers["Content-Type"] = "application/pdf"

        download = request.args.get("download", "false").lower() == "true"
        disposition = "attachment" if download else "inline"
        response.headers["Content-Disposition"] = (
            f'{disposition}; filename="{filename}"'
        )

        LOGGER.info(
            "PDF de receituário #%d gerado (%d itens)",
            rec_id,
            len(rec.itens),
        )
        return response

    except Exception as exc:
        LOGGER.exception("Erro ao gerar PDF do receituário #%d", rec_id)
        return jsonify({"error": f"Erro ao gerar PDF: {exc}"}), 500


@receituario_pdf_bp.route("/receituarios/<int:rec_id>/pdf/html", methods=["GET"])
def get_receituario_html(rec_id: int):
    """Retorna HTML do receituário (debug/preview)."""
    rec = Receituarios.query.get(rec_id)
    if not rec:
        return jsonify({"error": "Receituário não encontrado"}), 404

    try:
        context = _build_context(rec)
        html_content = render_template(
            "prescriptions/prescription_report.html",
            **context,
        )

        if request.args.get("raw", "false").lower() == "true":
            response = make_response(html_content)
            response.headers["Content-Type"] = "text/html; charset=utf-8"
            return response

        return jsonify({"html": html_content}), 200

    except Exception as exc:
        LOGGER.exception("Erro ao gerar HTML do receituário #%d", rec_id)
        return jsonify({"error": f"Erro ao gerar HTML: {exc}"}), 500
