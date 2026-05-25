"""
Relatórios PDF: ficha do paciente e prontuário (download)

Rotas:
- GET /pacientes/<int:paciente_id>/ficha/pdf
- GET /pacientes/<int:paciente_id>/prontuario/pdf
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterable

from flask import Blueprint, current_app, jsonify, send_file
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from zoneinfo import ZoneInfo

from app.models.medical_appointments_model import Consultas
from app.models.patients_model import Pacientes

patient_reports_pdf_bp = Blueprint("patient_reports_pdf", __name__)

# =========================
# Constantes / Config
# =========================
IMESC_CNPJ_DIGITS = "43054154000179"
SAO_PAULO_TZ = ZoneInfo("America/Sao_Paulo")

PAGE_TOP_Y = 800
PAGE_LEFT_X = 40
PAGE_RIGHT_X = 555
PAGE_MIN_Y = 60
CONTENT_START_Y = 755

WRAP_MAX_CHARS = 95


@dataclass(frozen=True)
class PdfMeta:
    title: str
    issued_at: datetime


# =========================
# Helpers genéricos
# =========================
def _now_sp() -> datetime:
    """Datetime timezone-aware no fuso de São Paulo."""
    return datetime.now(tz=SAO_PAULO_TZ)


def _only_digits(value: object) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _is_imesc(cnpj_value: object) -> bool:
    return _only_digits(cnpj_value) == IMESC_CNPJ_DIGITS


def _format_cpf(cpf: str | int | None) -> str:
    """Formata CPF para exibição: XXX.XXX.XXX-XX"""
    if cpf is None:
        return ""
    s = _only_digits(cpf).zfill(11)
    return f"{s[:3]}.{s[3:6]}.{s[6:9]}-{s[9:]}"


def _format_cnpj(cnpj_int: int | None) -> str:
    s = str(cnpj_int or "").zfill(14)
    if len(s) != 14:
        return str(cnpj_int or "—")
    return f"{s[:2]}.{s[2:5]}.{s[5:8]}/{s[8:12]}-{s[12:]}"


def _calculate_age(birth_date: date | None) -> int | None:
    """Calcula idade atual a partir da data de nascimento."""
    if not birth_date:
        return None
    today = date.today()
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


def _wrap_text(text: str, max_chars: int = WRAP_MAX_CHARS) -> list[str]:
    """Quebra texto por palavras respeitando um limite de caracteres."""
    words = (text or "").replace("\r", "").split()
    if not words:
        return ["—"]

    lines: list[str] = []
    current: list[str] = []
    count = 0

    for word in words:
        extra = len(word) + (1 if current else 0)
        if count + extra > max_chars:
            lines.append(" ".join(current))
            current = [word]
            count = len(word)
            continue

        current.append(word)
        count += extra

    if current:
        lines.append(" ".join(current))

    return lines


def _new_pdf() -> tuple[io.BytesIO, canvas.Canvas]:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    return buffer, c


# =========================
# Helpers de desenho
# =========================
def _draw_title(c: canvas.Canvas, meta: PdfMeta) -> None:
    c.setFont("Helvetica-Bold", 14)
    c.drawString(PAGE_LEFT_X, PAGE_TOP_Y, meta.title)

    c.setFont("Helvetica", 9)
    issued = meta.issued_at.strftime("%d/%m/%Y %H:%M")
    c.drawString(PAGE_LEFT_X, PAGE_TOP_Y - 14, f"Emitido em: {issued}")

    c.line(PAGE_LEFT_X, PAGE_TOP_Y - 20, PAGE_RIGHT_X, PAGE_TOP_Y - 20)


def _ensure_space(c: canvas.Canvas, y: int, needed: int, meta: PdfMeta) -> int:
    """Garante espaço vertical; se não tiver, cria nova página."""
    if y - needed < PAGE_MIN_Y:
        c.showPage()
        _draw_title(c, meta)
        return CONTENT_START_Y
    return y


def _draw_lines(
    c: canvas.Canvas,
    x: int,
    y: int,
    lines: Iterable[str],
    *,
    line_height: int = 14,
    meta: PdfMeta,
) -> int:
    """Desenha múltiplas linhas e devolve o novo y."""
    for line in lines:
        y = _ensure_space(c, y, line_height + 6, meta)
        c.drawString(x, y, line)
        y -= line_height
    return y


def _draw_kv(
    c: canvas.Canvas, x: int, y: int, label: str, value: str, meta: PdfMeta
) -> int:
    """Desenha uma linha 'label: value' e devolve o novo y."""
    y = _ensure_space(c, y, 20, meta)
    c.drawString(x, y, f"{label}: {value}")
    return y - 16


def _patient_birth_line(paciente: Pacientes) -> str:
    if not getattr(paciente, "data_de_nascimento", None):
        return "Nascimento: —"

    nasc = paciente.data_de_nascimento.strftime("%d/%m/%Y")
    idade = _calculate_age(paciente.data_de_nascimento)
    idade_str = f" ({idade} anos)" if idade is not None else ""
    return f"Nascimento: {nasc}{idade_str}"


def _endereco_compacto(paciente: Pacientes) -> str:
    parts: list[str] = []

    logradouro = getattr(paciente, "logradouro", None)
    if logradouro:
        line = str(logradouro)
        numero = getattr(paciente, "numero", None)
        if numero:
            line += f", {numero}"
        complemento = getattr(paciente, "complemento", None)
        if complemento:
            line += f" ({complemento})"
        parts.append(line)

    bairro = getattr(paciente, "bairro", None)
    if bairro:
        parts.append(str(bairro))

    cidade = getattr(paciente, "cidade", None)
    uf = getattr(paciente, "uf", None)
    if cidade or uf:
        parts.append(" - ".join([x for x in [cidade, uf] if x]))

    cep = getattr(paciente, "cep", None)
    if cep:
        parts.append(f"CEP {cep}")

    if parts:
        return " | ".join(parts)

    endereco_legado = getattr(paciente, "endereco", None)
    return str(endereco_legado) if endereco_legado else "—"


def _resolve_convenio_cnpj(paciente: Pacientes) -> int | None:
    """Retorna CNPJ do convênio via relacionamento ou campo direto."""
    if getattr(paciente, "convenio", None):
        return getattr(paciente.convenio, "cnpj", None)
    return getattr(paciente, "cnpj_convenio", None)


# =========================
# Renderização: Ficha
# =========================
def _render_ficha(c: canvas.Canvas, paciente: Pacientes, meta: PdfMeta) -> None:
    _draw_title(c, meta)

    y = 750
    c.setFont("Helvetica-Bold", 11)
    c.drawString(PAGE_LEFT_X, y, paciente.nome or "—")
    y -= 20

    c.setFont("Helvetica", 10)
    y = _draw_kv(c, PAGE_LEFT_X, y, "CPF", _format_cpf(paciente.cpf), meta)
    y = _draw_kv(
        c,
        PAGE_LEFT_X,
        y,
        "Nascimento",
        _patient_birth_line(paciente).replace("Nascimento: ", ""),
        meta,
    )
    y = _draw_kv(c, PAGE_LEFT_X, y, "Sexo", str(paciente.sexo or "—"), meta)
    y = _draw_kv(
        c,
        PAGE_LEFT_X,
        y,
        "Telefone",
        _only_digits(getattr(paciente, "numero_de_contato", None)) or "—",
        meta,
    )
    y = _draw_kv(c, PAGE_LEFT_X, y, "Email", str(paciente.email or "—"), meta)
    y -= 6

    # Endereço
    c.setFont("Helvetica-Bold", 10)
    y = _ensure_space(c, y, 40, meta)
    c.drawString(PAGE_LEFT_X, y, "Endereço:")
    y -= 14

    c.setFont("Helvetica", 10)
    endereco = _endereco_compacto(paciente)
    y = _draw_lines(c, PAGE_LEFT_X, y, _wrap_text(endereco), meta=meta)

    # Vínculos
    y -= 10
    y = _ensure_space(c, y, 90, meta)

    c.setFont("Helvetica-Bold", 10)
    c.drawString(PAGE_LEFT_X, y, "Vínculos:")
    y -= 14

    c.setFont("Helvetica", 10)

    if getattr(paciente, "vinculado_a_empresa", False):
        if getattr(paciente, "empresa", None):
            empresa_nome = str(getattr(paciente.empresa, "nome", "—"))
            empresa_cnpj = _format_cnpj(getattr(paciente.empresa, "cnpj", None))
            y = _draw_lines(
                c,
                PAGE_LEFT_X,
                y,
                [f"Empresa: {empresa_nome} • CNPJ: {empresa_cnpj}"],
                meta=meta,
            )
        else:
            cnpj_empresa = getattr(paciente, "cnpj_empresa", None)
            if cnpj_empresa:
                y = _draw_lines(
                    c,
                    PAGE_LEFT_X,
                    y,
                    [f"Empresa: (CNPJ) {_format_cnpj(cnpj_empresa)}"],
                    meta=meta,
                )

    if getattr(paciente, "vinculado_a_convenio", False):
        cnpj_conv = _resolve_convenio_cnpj(paciente)

        if getattr(paciente, "convenio", None):
            conv_nome = str(getattr(paciente.convenio, "nome", "—"))
            conv_cnpj = _format_cnpj(getattr(paciente.convenio, "cnpj", None))
            y = _draw_lines(
                c,
                PAGE_LEFT_X,
                y,
                [f"Convênio: {conv_nome} • CNPJ: {conv_cnpj}"],
                meta=meta,
            )
        elif cnpj_conv:
            y = _draw_lines(
                c,
                PAGE_LEFT_X,
                y,
                [f"Convênio: (CNPJ) {_format_cnpj(cnpj_conv)}"],
                meta=meta,
            )

        if cnpj_conv and _is_imesc(cnpj_conv):
            proto = (getattr(paciente, "protocolo_imesc", None) or "").strip() or "—"
            y = _draw_lines(
                c,
                PAGE_LEFT_X,
                y,
                [f"Protocolo IMESC: {proto}"],
                meta=meta,
            )


# =========================
# Renderização: Prontuário
# =========================
def _consulta_header(consulta: Consultas, idx: int) -> str:
    header = f"{idx}. {consulta.data.isoformat() if consulta.data else '—'}"
    if getattr(consulta, "hora_consulta", None):
        header += f" {consulta.hora_consulta.strftime('%H:%M')}"
    if getattr(consulta, "tipo", None):
        header += f" • {consulta.tipo}"
    if getattr(consulta, "crm_medico", None):
        header += f" • CRM {consulta.crm_medico}"
    return header


def _consulta_blocos(consulta: Consultas) -> list[tuple[str, object]]:
    """Lista de blocos para renderizar no prontuário."""
    return [
        ("Queixa principal", getattr(consulta, "queixa_principal", None)),
        ("História da doença atual", getattr(consulta, "historia_doenca_atual", None)),
        ("Exame físico", getattr(consulta, "exame_fisico", None)),
        ("Diagnóstico", getattr(consulta, "diagnostico", None)),
        ("CID", getattr(consulta, "cid", None)),
        ("Conduta", getattr(consulta, "conduta", None)),
        ("Anamnese", getattr(consulta, "anamnese", None)),
        (
            "Medicamentos prescritos",
            getattr(consulta, "medicamentos_prescrevidos", None),
        ),
        ("Observações internas", getattr(consulta, "observacoes_internas", None)),
    ]


def _render_prontuario(
    c: canvas.Canvas, paciente: Pacientes, consultas: list[Consultas], meta: PdfMeta
) -> None:
    _draw_title(c, meta)

    y = CONTENT_START_Y
    c.setFont("Helvetica-Bold", 11)
    c.drawString(PAGE_LEFT_X, y, paciente.nome or "—")
    y -= 16

    c.setFont("Helvetica", 10)
    y = _draw_kv(c, PAGE_LEFT_X, y, "CPF", _format_cpf(paciente.cpf), meta)
    y = _draw_kv(
        c,
        PAGE_LEFT_X,
        y,
        "Nascimento",
        _patient_birth_line(paciente).replace("Nascimento: ", ""),
        meta,
    )
    y -= 6

    if not consultas:
        c.setFont("Helvetica", 11)
        c.drawString(PAGE_LEFT_X, y, "Nenhuma consulta/anamnese registrada.")
        return

    for idx, consulta in enumerate(consultas, start=1):
        y = _ensure_space(c, y, 120, meta)

        c.setFont("Helvetica-Bold", 10)
        c.drawString(PAGE_LEFT_X, y, _consulta_header(consulta, idx))
        y -= 14

        if getattr(consulta, "procedimentos", None):
            c.setFont("Helvetica", 10)
            y = _ensure_space(c, y, 20, meta)
            c.drawString(PAGE_LEFT_X, y, f"Procedimentos: {consulta.procedimentos}")
            y -= 14

        for titulo_bloco, texto in _consulta_blocos(consulta):
            if not texto:
                continue

            y = _ensure_space(c, y, 40, meta)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(PAGE_LEFT_X, y, f"{titulo_bloco}:")
            y -= 14

            c.setFont("Helvetica", 10)
            y = _draw_lines(c, PAGE_LEFT_X, y, _wrap_text(str(texto)), meta=meta)
            y -= 6

        y -= 8


# =========================
# Rotas
# =========================
@patient_reports_pdf_bp.route("/pacientes/<int:paciente_id>/ficha/pdf", methods=["GET"])
def ficha_paciente_pdf(paciente_id: int):
    """Baixa a ficha (dados cadastrais) do paciente em PDF."""
    try:
        paciente = Pacientes.query.get(paciente_id)
        if not paciente:
            return jsonify({"error": "Paciente não encontrado"}), 404

        buffer, c = _new_pdf()
        meta = PdfMeta(title="Ficha do Paciente", issued_at=_now_sp())

        _render_ficha(c, paciente, meta)

        c.showPage()
        c.save()
        buffer.seek(0)

        return send_file(
            buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"ficha_{paciente_id}.pdf",
        )

    except Exception:
        current_app.logger.error("Erro ao gerar ficha PDF", exc_info=True)
        return jsonify({"error": "Erro ao gerar ficha PDF"}), 500


@patient_reports_pdf_bp.route(
    "/pacientes/<int:paciente_id>/prontuario/pdf", methods=["GET"]
)
def prontuario_paciente_pdf(paciente_id: int):
    """Baixa o prontuário (consultas/anamneses) do paciente em PDF."""
    try:
        paciente = Pacientes.query.get(paciente_id)
        if not paciente:
            return jsonify({"error": "Paciente não encontrado"}), 404

        consultas = (
            Consultas.query.filter(Consultas.cpf_paciente == paciente.cpf)
            .order_by(Consultas.data.desc(), Consultas.hora_consulta.desc())
            .all()
        )

        buffer, c = _new_pdf()
        meta = PdfMeta(title="Prontuário do Paciente", issued_at=_now_sp())

        _render_prontuario(c, paciente, consultas, meta)

        c.showPage()
        c.save()
        buffer.seek(0)

        return send_file(
            buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"prontuario_{paciente_id}.pdf",
        )

    except Exception:
        current_app.logger.error("Erro ao gerar prontuário PDF", exc_info=True)
        return jsonify({"error": "Erro ao gerar prontuário PDF"}), 500
