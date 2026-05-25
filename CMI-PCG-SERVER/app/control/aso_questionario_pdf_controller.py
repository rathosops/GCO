"""
Geração de PDF para Questionário ASO usando WeasyPrint.

Rotas:
  GET /aso-questionarios/<aso_id>/pdf                — Ficha vinculada ao ASO
  GET /aso-questionarios/<aso_id>/pdf?modo=parcial   — Só dados do paciente preenchidos
  GET /aso-questionarios/<aso_id>/pdf?modo=branco    — Ficha em branco para preencher à mão
  GET /aso-questionarios/ficha/<questionario_id>/pdf — Ficha clínica pelo questionário (não exige ASO)
  GET /aso-questionarios/ficha-branca                — Ficha totalmente em branco (sem ASO)

Modos:
  - preenchido: todas as respostas da anamnese + dados do paciente
  - parcial: dados do paciente preenchidos, perguntas em branco
  - branco: tudo em branco, para o paciente preencher à mão
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import Blueprint, current_app, jsonify, request

from app.control.base_pdf_report import BasePdfReport
from app.database import db
from app.models.aso_questionario_model import (
    AsoQuestionario,
    build_anamnese_template,
)
from app.models.aso_request_model import SolicitacoesDeAso
from app.utils.validators import format_cpf, format_cnpj
from app.utils.timezone import get_now_sao_paulo

agora = get_now_sao_paulo()

logger = logging.getLogger(__name__)

aso_questionario_pdf_bp = Blueprint(
    "aso_questionario_pdf",
    __name__,
    url_prefix="/aso-questionarios",
)

SAO_PAULO_TZ = ZoneInfo("America/Sao_Paulo")

# Modos válidos para o query param
_MODOS_VALIDOS = {"preenchido", "parcial", "branco"}


# ---------------------------------------------------------------------------
# Helpers (DRY — reutilizados por build_context)
# ---------------------------------------------------------------------------

_CONCLUSAO_DISPLAY: dict[str, str] = {
    "APTO": "APTO",
    "INAPTO": "INAPTO",
    "APTO_COM_RESTRICOES": "APTO COM RESTRIÇÕES",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _s(val) -> str:
    """None-safe: converte None → '' para nunca renderizar 'None' no PDF."""
    if val is None:
        return ""
    return str(val)


def _format_date_br(dt: date | None) -> str:
    """Formata date para DD/MM/AAAA."""
    if not dt:
        return ""
    return dt.strftime("%d/%m/%Y") if hasattr(dt, "strftime") else str(dt)


def _calc_idade(data_nasc: date | None) -> int | None:
    """Calcula idade usando data atual em America/Sao_Paulo (suporta 29/fev)."""
    if not data_nasc:
        return None
    from app.utils.timezone import get_today_sao_paulo

    hoje = get_today_sao_paulo()
    return (
        hoje.year
        - data_nasc.year
        - ((hoje.month, hoje.day) < (data_nasc.month, data_nasc.day))
    )


def _get_logo_path() -> str | None:
    """Retorna file:// URI do logo para WeasyPrint."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    logo = base_dir / "static" / "images" / "logo_cmi.png"
    return f"file://{logo.absolute()}" if logo.exists() else None


def _build_paciente_context(paciente) -> dict:
    """Monta dict de paciente. Strings nunca são None."""
    if not paciente:
        return {
            "nome": "",
            "cpf": "",
            "data_nascimento_br": "",
            "idade": None,
            "sexo": "",
            "telefone": "",
            "estado_civil": "",
            "email": "",
            "endereco": "",
        }

    # Monta endereço compacto
    endereco_parts = []
    if getattr(paciente, "logradouro", None):
        line = paciente.logradouro
        if getattr(paciente, "numero", None):
            line += f", {paciente.numero}"
        endereco_parts.append(line)
    if getattr(paciente, "bairro", None):
        endereco_parts.append(paciente.bairro)
    if getattr(paciente, "cidade", None) or getattr(paciente, "uf", None):
        city_uf = " - ".join(
            x
            for x in [getattr(paciente, "cidade", None), getattr(paciente, "uf", None)]
            if x
        )
        if city_uf:
            endereco_parts.append(city_uf)
    if getattr(paciente, "cep", None):
        cep = paciente.cep
        if len(str(cep)) == 8:
            cep = f"{str(cep)[:5]}-{str(cep)[5:]}"
        endereco_parts.append(f"CEP {cep}")

    return {
        "nome": _s(paciente.nome),
        "cpf": format_cpf(paciente.cpf) if paciente.cpf else "",
        "data_nascimento_br": _format_date_br(
            getattr(paciente, "data_de_nascimento", None)
        ),
        "idade": _calc_idade(getattr(paciente, "data_de_nascimento", None)),
        "sexo": _s(getattr(paciente, "sexo", "")),
        "telefone": _s(getattr(paciente, "numero_de_contato", "")),
        "estado_civil": _s(getattr(paciente, "estado_civil", "")),
        "email": _s(getattr(paciente, "email", "")),
        "endereco": " | ".join(endereco_parts) if endereco_parts else "",
    }


# ---------------------------------------------------------------------------
# Report class
# ---------------------------------------------------------------------------


class AsoQuestionarioPdfReport(BasePdfReport):
    """Gera PDF do questionário ASO (anamnese + exame clínico).

    Args:
        aso: Registro do ASO (pode ser None para ficha sem ASO).
        questionario: Questionário preenchido (pode ser None).
        modo: 'preenchido' | 'parcial' | 'branco'
    """

    template_path = "aso_questionario/aso_questionario_template.html"

    def __init__(
        self,
        aso: SolicitacoesDeAso | None,
        questionario: AsoQuestionario | None,
        *,
        modo: str = "preenchido",
    ):
        self.aso = aso
        self.questionario = questionario
        self.modo = modo

        # Nome do arquivo
        if aso and aso.paciente:
            nome = aso.paciente.nome.replace(" ", "_")
        elif questionario and questionario.paciente:
            nome = questionario.paciente.nome.replace(" ", "_")
        else:
            nome = "ficha"

        sufixo = f"_{modo}" if modo != "preenchido" else ""
        ref = (
            str(aso.id)
            if aso
            else (f"q{questionario.id}" if questionario else "branco")
        )
        self.filename = f"ASO_Questionario_{nome}_{ref}{sufixo}.pdf"
        self.context: dict = {}

    def build_context(self) -> None:
        """Monta contexto Jinja2 respeitando o modo selecionado."""
        from datetime import datetime

        agora = datetime.now(tz=SAO_PAULO_TZ)
        aso = self.aso
        q = self.questionario

        # --- Anamnese por modo ---
        if self.modo == "branco":
            anamnese = build_anamnese_template()
            exame_clinico = {}
            observacoes_medicas = ""
        elif self.modo == "parcial":
            anamnese = build_anamnese_template()
            exame_clinico = {}
            observacoes_medicas = ""
        else:
            # preenchido: usa dados do questionário ou template vazio
            anamnese = (q.anamnese if q else None) or build_anamnese_template()
            exame_clinico = (q.exame_clinico if q else None) or {}
            observacoes_medicas = _s(q.observacoes_medicas) if q else ""

        # Paciente: ASO → questionário → vazio
        if self.modo == "branco":
            paciente_ctx = _build_paciente_context(None)
        else:
            paciente_obj = None
            if aso and aso.paciente:
                paciente_obj = aso.paciente
            elif q and q.paciente:
                paciente_obj = q.paciente
            paciente_ctx = _build_paciente_context(paciente_obj)

        # --- Empresa ---
        empresa = aso.empresa if aso else None
        empresa_ctx = {
            "nome": _s(empresa.nome) if empresa else "",
            "cnpj": format_cnpj(empresa.cnpj) if empresa and empresa.cnpj else "",
            "endereco": _s(getattr(empresa, "endereco", "")) if empresa else "",
        }

        # --- Médico ---
        medico = aso.medico if aso else None
        medico_ctx = {
            "nome": _s(medico.nome) if medico else "",
            "crm": _s(medico.crm) if medico else "",
            "especialidade": _s(getattr(medico, "especialidade", "")) if medico else "",
        }

        self.context = {
            "logo_path": _get_logo_path(),
            "data_geracao": agora.strftime("%d/%m/%Y"),
            "hora_geracao": agora.strftime("%H:%M"),
            "cidade_uf": "Presidente Prudente - SP",
            "aso_id": aso.id if aso else None,
            "tipo_de_exame": _s(aso.tipo_exame) if aso else "",
            "modo": self.modo,
            "clinica": {"nome": "Centro Médico Integrado"},
            "paciente": paciente_ctx,
            "empresa": empresa_ctx,
            "medico": medico_ctx,
            "funcao_do_paciente": _s(aso.funcao_paciente) if aso else "",
            "setor": _s(aso.setor) if aso else "",
            "anamnese": anamnese,
            "exame_clinico": exame_clinico,
            "observacoes_medicas": observacoes_medicas,
            # ASO
            "exames_solicitados": (aso.exames_complementares if aso else None) or {},
            "riscos": (aso.riscos_ocupacionais if aso else None) or {},
            "conclusao": {
                "status": (
                    _CONCLUSAO_DISPLAY.get(aso.conclusao, aso.conclusao) if aso else ""
                ),
            },
            "restricoes": _s(aso.restricoes) if aso else "",
        }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@aso_questionario_pdf_bp.route("/<int:aso_id>/pdf", methods=["GET"])
def gerar_pdf_questionario(aso_id: int):
    """
    Gera PDF do questionário ASO vinculado.

    Query params:
      - modo: preenchido (default) | parcial | branco
    """
    try:
        aso = db.session.get(SolicitacoesDeAso, aso_id)
        if not aso:
            return jsonify({"error": "ASO não encontrado."}), 404

        modo = request.args.get("modo", "preenchido").lower()
        if modo not in _MODOS_VALIDOS:
            return (
                jsonify({"error": f"Modo inválido. Use: {', '.join(_MODOS_VALIDOS)}"}),
                400,
            )

        questionario = AsoQuestionario.query.filter_by(aso_id=aso_id).first()

        report = AsoQuestionarioPdfReport(aso, questionario, modo=modo)
        return report.generate_response()

    except Exception:
        current_app.logger.error("Erro ao gerar PDF do questionário ASO", exc_info=True)
        return jsonify({"error": "Erro ao gerar PDF"}), 500


@aso_questionario_pdf_bp.route("/ficha/<int:questionario_id>/pdf", methods=["GET"])
def gerar_pdf_ficha_clinica(questionario_id: int):
    """
    Gera PDF da ficha clínica a partir do questionário.

    Não exige ASO vinculado — ideal para o médico revisar a anamnese
    antes de criar o ASO.

    Se o questionário já estiver vinculado a um ASO, inclui os dados
    do ASO (empresa, médico, tipo de exame, conclusão) no PDF.

    Query params:
      - modo: preenchido (default) | parcial
    """
    try:
        questionario = db.session.get(AsoQuestionario, questionario_id)
        if not questionario:
            return jsonify({"error": "Questionário não encontrado."}), 404

        modo = request.args.get("modo", "preenchido").lower()
        if modo not in ("preenchido", "parcial"):
            return jsonify({"error": "Modo inválido. Use: preenchido, parcial"}), 400

        # Se tem ASO vinculado, usa os dados do ASO também
        aso = None
        if questionario.aso_id:
            aso = db.session.get(SolicitacoesDeAso, questionario.aso_id)

        report = AsoQuestionarioPdfReport(aso, questionario, modo=modo)
        return report.generate_response()

    except Exception:
        current_app.logger.error(
            "Erro ao gerar PDF da ficha clínica #%d", questionario_id, exc_info=True
        )
        return jsonify({"error": "Erro ao gerar PDF"}), 500


@aso_questionario_pdf_bp.route("/ficha-branca", methods=["GET"])
def gerar_ficha_branca():
    """
    Gera PDF de ficha clínica totalmente em branco.

    Útil para quando o paciente não preencheu o Google Forms e
    precisa preencher à mão na recepção.
    """
    try:
        report = AsoQuestionarioPdfReport(None, None, modo="branco")
        return report.generate_response()
    except Exception:
        current_app.logger.error("Erro ao gerar ficha branca", exc_info=True)
        return jsonify({"error": "Erro ao gerar ficha branca"}), 500
