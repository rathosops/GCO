"""
Geração de PDF para Perícias IMESC usando WeasyPrint.

Rota:
- GET /pericias-imesc/<id>/pdf
"""

from __future__ import annotations

import os
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import Blueprint, current_app, jsonify

from app.control.base_pdf_report import BasePdfReport
from app.models.pericia_imesc_model import PericiaIMESC

pericia_imesc_pdf_bp = Blueprint("pericia_imesc_pdf", __name__)

SAO_PAULO_TZ = ZoneInfo("America/Sao_Paulo")


def _now_sp() -> datetime:
    return datetime.now(tz=SAO_PAULO_TZ)


def _only_digits(value: object) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _format_cpf(cpf: str) -> str:
    s = _only_digits(cpf).zfill(11)
    return f"{s[:3]}.{s[3:6]}.{s[6:9]}-{s[9:]}"


def _calculate_age(birth_date: date) -> int:
    today = date.today()
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


def _format_datetime_br(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=SAO_PAULO_TZ)
    return dt.astimezone(SAO_PAULO_TZ).strftime("%d/%m/%Y %H:%M")


def _get_logo_path() -> str | None:
    """Retorna o caminho absoluto do logo se existir."""
    # Caminho relativo ao diretório do projeto
    base_dir = Path(__file__).resolve().parent.parent.parent
    logo_path = base_dir / "static" / "images" / "logo_cmi.png"
    
    if logo_path.exists():
        # WeasyPrint precisa de file:// URI ou caminho absoluto
        return f"file://{logo_path.absolute()}"
    
    return None


class PericiaImescPdfReport(BasePdfReport):
    """Gerador de PDF para relatório de perícia IMESC."""

    template_path = "pericias_imesc/pericia_imesc_report.html"

    def __init__(self, pericia: PericiaIMESC):
        self.pericia = pericia
        self.filename = f"pericia_imesc_{pericia.protocolo.replace(' ', '_').replace('/', '-')}.pdf"
        self.context = {}

    def build_context(self):
        pericia = self.pericia
        paciente = pericia.paciente
        medico = pericia.medico
        assistente = pericia.assistente_social

        # Dados do paciente
        paciente_data = None
        if paciente:
            paciente_data = {
                "nome": paciente.nome,
                "cpf_formatado": _format_cpf(paciente.cpf),
                "data_nascimento_br": (
                    paciente.data_de_nascimento.strftime("%d/%m/%Y")
                    if paciente.data_de_nascimento
                    else "—"
                ),
                "idade": (
                    _calculate_age(paciente.data_de_nascimento)
                    if paciente.data_de_nascimento
                    else "—"
                ),
                "sexo": paciente.sexo,
            }

        # Dados do médico
        medico_data = None
        if medico:
            medico_data = {
                "nome": medico.nome,
                "crm": medico.crm,
                "especialidade": getattr(medico, 'especialidade', None),
            }

        # Dados da assistente social
        assistente_data = None
        if assistente:
            assistente_data = {
                "nome": assistente.nome,
                "cress": assistente.cress,
            }

        # Dados da perícia
        pericia_data = {
            "protocolo": pericia.protocolo,
            "data_pericia_br": (
                pericia.data_pericia.strftime("%d/%m/%Y")
                if pericia.data_pericia
                else "—"
            ),
            "hora_pericia": (
                pericia.hora_pericia.strftime("%H:%M")
                if pericia.hora_pericia
                else None
            ),
            "status": pericia.status,
            "parecer_social": pericia.parecer_social,
            "data_parecer_social_br": _format_datetime_br(pericia.data_parecer_social),
            "parecer_medico": pericia.parecer_medico,
            "conclusao_medica": pericia.conclusao_medica,
            "cid": pericia.cid,
            "data_parecer_medico_br": _format_datetime_br(pericia.data_parecer_medico),
            "observacoes": pericia.observacoes,
        }

        self.context = {
            "pericia": pericia_data,
            "paciente": paciente_data,
            "medico": medico_data,
            "assistente_social": assistente_data,
            "data_geracao": _now_sp().strftime("%d/%m/%Y às %H:%M"),
            "logo_path": _get_logo_path(),
        }


@pericia_imesc_pdf_bp.route("/pericias-imesc/<int:pericia_id>/pdf", methods=["GET"])
def gerar_pdf_pericia(pericia_id: int):
    """Gera PDF do relatório da perícia IMESC."""
    try:
        pericia = PericiaIMESC.query.get(pericia_id)
        if not pericia:
            return jsonify({"error": "Perícia não encontrada"}), 404

        report = PericiaImescPdfReport(pericia)
        return report.generate_response()

    except Exception:
        current_app.logger.error("Erro ao gerar PDF da perícia", exc_info=True)
        return jsonify({"error": "Erro ao gerar PDF"}), 500