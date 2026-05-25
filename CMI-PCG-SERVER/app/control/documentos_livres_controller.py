# app/control/documentos_livres_controller.py
"""
Controller para geração de documentos médicos livres (sem persistência).

Endpoints:
    GET  /documentos-livres/medicos   → Lista médicos para seleção
    POST /documentos-livres/gerar-pdf → Gera PDF de atestado ou receita livre

Tipos suportados:
    - ATESTADO: Atestado médico com texto livre
    - RECEITA:  Receita médica com texto livre
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

from app.models.doctors_model import Medicos
from app.utils.timezone import get_now_sao_paulo

LOGGER = logging.getLogger(__name__)

documentos_livres_bp = Blueprint("documentos_livres", __name__)

TIPOS_DOCUMENTO = {
    "ATESTADO": "Atestado Médico",
    "RECEITA": "Receituário Médico",
}


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
    """Retorna informações da clínica via env vars."""
    return {
        "nome": os.getenv("CLINIC_NAME", "Centro Médico Integrado"),
        "endereco": os.getenv("CLINIC_ADDRESS"),
        "telefone": os.getenv("CLINIC_PHONE"),
        "email": os.getenv("CLINIC_EMAIL"),
        "cnpj": os.getenv("CLINIC_CNPJ"),
    }


def _validate_payload(data: dict) -> str | None:
    """Valida payload e retorna mensagem de erro ou None se válido."""
    tipo = (data.get("tipo_documento") or "").strip().upper()
    if tipo not in TIPOS_DOCUMENTO:
        return f"Tipo inválido. Use: {', '.join(TIPOS_DOCUMENTO)}"

    if not (data.get("nome_paciente") or "").strip():
        return "Nome do paciente é obrigatório"

    if not (data.get("corpo_texto") or "").strip():
        return "Texto do documento é obrigatório"

    crm = data.get("crm_medico")
    if not crm:
        return "Médico responsável é obrigatório"

    return None


# ── Rotas ────────────────────────────────────────────────────────────────


@documentos_livres_bp.route("/documentos-livres/medicos", methods=["GET"])
def listar_medicos():
    """Lista médicos cadastrados para seleção no formulário."""
    try:
        medicos = Medicos.query.order_by(Medicos.nome).all()
        return jsonify(
            [
                {
                    "id": m.id,
                    "nome": m.nome,
                    "crm": m.crm,
                    "especialidade": m.especialidade,
                    "sexo": m.sexo,
                }
                for m in medicos
            ]
        )
    except Exception as exc:
        LOGGER.exception("Erro ao listar médicos para documentos livres")
        return jsonify({"error": str(exc)}), 500


@documentos_livres_bp.route("/documentos-livres/gerar-pdf", methods=["POST"])
def gerar_pdf():
    """
    Gera PDF de atestado ou receita livre (sem salvar no banco).

    Body JSON:
        tipo_documento: ATESTADO | RECEITA
        nome_paciente: str (obrigatório)
        corpo_texto: str (obrigatório, texto livre do documento)
        crm_medico: int (obrigatório, CRM do médico cadastrado)
        observacoes: str (opcional)
    """
    try:
        data = request.json or {}

        # Validação
        erro = _validate_payload(data)
        if erro:
            return jsonify({"error": erro}), 400

        tipo = data["tipo_documento"].strip().upper()
        crm = int(data["crm_medico"])

        # Busca médico no banco
        medico = Medicos.query.filter(Medicos.crm == crm).first()
        if not medico:
            return jsonify({"error": "Médico não encontrado"}), 404

        agora = get_now_sao_paulo()

        context = {
            "tipo_documento": tipo,
            "tipo_descricao": TIPOS_DOCUMENTO[tipo],
            "nome_paciente": data["nome_paciente"].strip(),
            "corpo_texto": data["corpo_texto"].strip(),
            "observacoes": (data.get("observacoes") or "").strip() or None,
            "medico": {
                "nome": medico.nome,
                "crm": medico.crm,
                "especialidade": medico.especialidade,
                "sexo": medico.sexo,
            },
            "clinica": _get_clinic_info(),
            "logo_path": _get_logo_path(),
            "data_geracao": agora.strftime("%d/%m/%Y"),
            "data_geracao_completa": agora.strftime("%d/%m/%Y às %H:%M"),
        }

        html_content = render_template(
            "documentos_livres/documento_report.html",
            **context,
        )

        # Gera PDF
        html = HTML(string=html_content, base_url=current_app.static_folder)
        pdf_buffer = BytesIO()
        html.write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        # Nome do arquivo
        nome_curto = data["nome_paciente"].strip().replace(" ", "_")[:25]
        data_str = agora.strftime("%Y%m%d")
        filename = f"{tipo.lower()}_{nome_curto}_{data_str}.pdf"

        response = make_response(pdf_buffer.read())
        response.headers["Content-Type"] = "application/pdf"

        download = request.args.get("download", "false").lower() == "true"
        disposition = "attachment" if download else "inline"
        response.headers["Content-Disposition"] = (
            f'{disposition}; filename="{filename}"'
        )

        LOGGER.info("Documento livre %s gerado para %s", tipo, nome_curto)
        return response

    except Exception as exc:
        LOGGER.exception("Erro ao gerar documento livre")
        return jsonify({"error": f"Erro ao gerar PDF: {exc}"}), 500
