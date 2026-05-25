"""Controller para solicitações de exames.

Melhorias:
    - zoneinfo (America/Sao_Paulo) em vez de pytz
    - Helpers compartilhados (DRY)
    - Cache nos relatórios
    - CPF como String(11)
    - RQE do médico solicitante no PDF
    - Opção de gerar PDF sem valores (sem_valores)
    - Endpoint para download de PDF de solicitação existente

Endpoints:
    GET    /solicitacoes-exames           - Lista solicitações com filtros
    GET    /solicitacoes-exames/<id>      - Busca por ID
    POST   /solicitacoes-exames           - Cria nova solicitação
    PUT    /solicitacoes-exames/<id>      - Atualiza solicitação
    DELETE /solicitacoes-exames/<id>      - Remove solicitação
    PATCH  /solicitacoes-exames/<id>/status - Atualiza apenas status
    GET    /solicitacoes-exames/<id>/pdf  - Download PDF de solicitação existente
    POST   /gerar_solicitacao_exames      - Gera PDF (compatibilidade)
    GET    /relatorios/exames-mais-solicitados
    GET    /relatorios/solicitacoes-por-periodo
    GET    /relatorios/solicitacoes-por-status
"""

from __future__ import annotations

from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import extract, func, or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.extensions.cache_ext import cache
from app.models.exam_request_model import SolicitacoesDeExames
from app.models.exams_model import Exames
from app.models.patients_model import Pacientes
from app.models.doctors_model import Medicos
from app.control.base_pdf_report import BasePdfReport
from app.utils.responses import get_pagination, json_error, json_success
from app.utils.timezone import get_now_sao_paulo
from app.utils.validators import (
    calculate_age,
    clean_cpf,
    format_cpf,
    normalize_float,
    only_digits,
    parse_date,
)

solicitacoes_exames_bp = Blueprint("solicitacoes_exames", __name__)

# ── Constantes ───────────────────────────────────────────────────────────
MAX_LIMIT = 200
CACHE_KEY_PREFIX_RELATORIOS = "relatorios:exames"


# ── Helpers ──────────────────────────────────────────────────────────────


def _get_logo_path() -> str | None:
    """Retorna o caminho absoluto do logo se existir."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    logo_path = base_dir / "static" / "images" / "logo_cmi.png"

    if logo_path.exists():
        return f"file://{logo_path.absolute()}"

    return None


def _build_medico_info(crm_raw: str | int | None) -> dict:
    """Busca médico pelo CRM e retorna dict com nome, crm, rqe e especialidade."""
    if not crm_raw:
        return {}

    crm_digits = only_digits(crm_raw)
    if not crm_digits:
        return {}

    medico = Medicos.query.filter(Medicos.crm == int(crm_digits)).first()
    if not medico:
        return {}

    return {
        "nome": medico.nome,
        "crm": medico.crm,
        "rqe": medico.rqe,
        "especialidade": medico.especialidade,
    }


# ── Cache helpers ────────────────────────────────────────────────────────


def _invalidar_cache_relatorios() -> None:
    """Invalida caches de relatórios após mutações."""
    try:
        cache.delete_many(
            f"{CACHE_KEY_PREFIX_RELATORIOS}:mais_solicitados",
            f"{CACHE_KEY_PREFIX_RELATORIOS}:por_status",
        )
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning(
            "Falha ao invalidar cache de relatórios (Redis indisponível?): %s", exc
        )


# =============================================================================
# PDF Generator
# =============================================================================


class ExamRequestPdfReport(BasePdfReport):
    """Gera PDF de solicitação de exames."""

    def __init__(
        self,
        paciente_id: int,
        exames_ids: list[int],
        medico_info: dict | None = None,
        sem_valores: bool = False,
    ):
        self.paciente_id = paciente_id
        self.exames_ids = exames_ids
        self.medico_info = medico_info or {}
        self.sem_valores = sem_valores
        self.context = {}
        self.template_path = "exam_requests/exam_request.html"
        self.filename = "solicitacao_exames.pdf"

    def build_context(self):
        """Monta contexto para o template."""
        paciente = Pacientes.query.get(self.paciente_id)
        if not paciente:
            raise ValueError("Paciente não encontrado")

        exames = Exames.query.filter(
            Exames.id.in_(self.exames_ids),
            Exames.ativo.is_(True),
        ).all()
        if not exames:
            raise ValueError("Nenhum exame encontrado")

        agora = get_now_sao_paulo()
        total = sum(float(e.valor_venda or 0) for e in exames)

        # Dados de nascimento / idade
        data_nascimento_str = ""
        idade = None
        if paciente.data_de_nascimento:
            data_nascimento_str = paciente.data_de_nascimento.strftime("%d/%m/%Y")
            idade = calculate_age(paciente.data_de_nascimento)

        self.context = {
            "paciente": paciente.nome,
            "cpf_paciente": format_cpf(paciente.cpf),
            "data_nascimento": data_nascimento_str,
            "idade": idade,
            "data": agora.strftime("%d/%m/%Y"),
            "hora": agora.strftime("%H:%M"),
            "exames": [
                {
                    "codigo": e.codigo or f"#{e.id}",
                    "nome": e.nome,
                    "tipo": e.tipo,
                    "valor": float(e.valor_venda or 0),
                }
                for e in exames
            ],
            "total": total,
            "sem_valores": self.sem_valores,
            "medico_nome": self.medico_info.get("nome"),
            "medico_crm": self.medico_info.get("crm"),
            "medico_rqe": self.medico_info.get("rqe"),
            "medico_especialidade": self.medico_info.get("especialidade"),
            "logo_path": _get_logo_path(),
        }

        nome_safe = paciente.nome.replace(" ", "_")[:30]
        sufixo = "_sem_valores" if self.sem_valores else ""
        self.filename = f"solicitacao_exames_{nome_safe}_{agora:%Y%m%d}{sufixo}.pdf"


# =============================================================================
# Rotas CRUD
# =============================================================================


@solicitacoes_exames_bp.route("/solicitacoes-exames", methods=["GET"])
def listar_solicitacoes():
    """Lista solicitações de exames com filtros."""
    try:
        query = SolicitacoesDeExames.query

        # Busca textual
        if search := request.args.get("search", "").strip():
            search_like = f"%{search}%"
            query = query.filter(
                or_(
                    SolicitacoesDeExames.nome_paciente.ilike(search_like),
                    SolicitacoesDeExames.exames.ilike(search_like),
                )
            )

        # Filtro por CPF
        if cpf_raw := request.args.get("cpf_paciente"):
            try:
                cpf = clean_cpf(cpf_raw)
                query = query.filter(SolicitacoesDeExames.cpf_paciente == cpf)
            except ValueError:
                pass  # CPF inválido, ignora filtro

        # Filtro por status
        if status := request.args.get("status", "").strip().upper():
            if status in SolicitacoesDeExames.STATUS_VALIDOS:
                query = query.filter(SolicitacoesDeExames.status == status)

        # Filtro por período
        if data_inicio := parse_date(request.args.get("data_inicio")):
            query = query.filter(SolicitacoesDeExames.data >= data_inicio)
        if data_fim := parse_date(request.args.get("data_fim")):
            query = query.filter(SolicitacoesDeExames.data <= data_fim)

        # Ordenação e paginação
        limit, offset = get_pagination(default_limit=50, max_limit=MAX_LIMIT)
        solicitacoes = (
            query.order_by(
                SolicitacoesDeExames.data.desc(),
                SolicitacoesDeExames.hora.desc(),
            )
            .limit(limit)
            .offset(offset)
            .all()
        )

        return jsonify([s.to_dict() for s in solicitacoes])

    except Exception as exc:
        current_app.logger.exception("Erro ao listar solicitações")
        return json_error(f"Erro ao listar solicitações: {exc}", 500)


@solicitacoes_exames_bp.route(
    "/solicitacoes-exames/<int:solicitacao_id>",
    methods=["GET"],
)
def buscar_solicitacao(solicitacao_id: int):
    """Busca solicitação por ID."""
    solicitacao = SolicitacoesDeExames.query.get(solicitacao_id)
    if not solicitacao:
        return json_error("Solicitação não encontrada", 404)
    return jsonify(solicitacao.to_dict())


@solicitacoes_exames_bp.route("/solicitacoes-exames", methods=["POST"])
def criar_solicitacao():
    """
    Cria nova solicitação de exames.

    Body JSON:
        paciente_id ou cpf_paciente, exames_ids (obrigatório),
        status, observacoes, crm_medico, desconto_percentual/valor, gerar_pdf
    """
    try:
        data = request.json or {}

        # Busca paciente
        paciente = None
        if paciente_id := data.get("paciente_id"):
            paciente = Pacientes.query.get(paciente_id)
        elif cpf_raw := data.get("cpf_paciente"):
            try:
                cpf = clean_cpf(cpf_raw)
                paciente = Pacientes.query.filter(Pacientes.cpf == cpf).first()
            except ValueError:
                return json_error("CPF inválido")

        if not paciente:
            return json_error("Paciente não encontrado", 404)

        # Busca exames
        exames_ids = data.get("exames_ids", [])
        if not exames_ids:
            return json_error("Lista de exames_ids é obrigatória")

        exames = Exames.query.filter(
            Exames.id.in_(exames_ids),
            Exames.ativo.is_(True),
        ).all()

        if not exames:
            return json_error("Nenhum exame válido encontrado", 404)

        # Valida status
        status = data.get("status", "PENDENTE").upper()
        if not SolicitacoesDeExames.validar_status(status):
            return json_error(
                f"Status inválido. Use: {', '.join(SolicitacoesDeExames.STATUS_VALIDOS)}",
            )

        # Calcula valores
        soma_valores = sum(float(e.valor_venda or 0) for e in exames)
        desconto = 0.0

        if desc_perc := data.get("desconto_percentual"):
            desconto = soma_valores * (float(desc_perc) / 100)
        elif desc_val := data.get("desconto_valor"):
            desconto = float(desc_val)

        valor_final = max(0, soma_valores - desconto)

        # Busca médico (opcional) — com RQE e especialidade
        medico_info = _build_medico_info(data.get("crm_medico"))

        # Cria solicitação
        agora = get_now_sao_paulo()
        solicitacao = SolicitacoesDeExames(
            cpf_paciente=paciente.cpf,
            nome_paciente=paciente.nome,
            data=agora.date(),
            hora=agora.time().replace(microsecond=0),
            exames=", ".join(e.nome for e in exames),
            exames_ids=",".join(str(e.id) for e in exames),
            soma_dos_valores=soma_valores,
            valor_desconto=desconto,
            valor_final=valor_final,
            status=status,
            observacoes=data.get("observacoes"),
            crm_medico=medico_info.get("crm"),
            nome_medico=medico_info.get("nome"),
            created_at=agora,
            updated_at=agora,
        )

        db.session.add(solicitacao)
        db.session.commit()

        _invalidar_cache_relatorios()

        # Gera PDF se solicitado
        if data.get("gerar_pdf", False):
            try:
                sem_valores = bool(data.get("sem_valores", False))
                pdf_report = ExamRequestPdfReport(
                    paciente.id,
                    [e.id for e in exames],
                    medico_info,
                    sem_valores=sem_valores,
                )
                return pdf_report.generate_response()
            except Exception as pdf_err:
                current_app.logger.warning("Erro ao gerar PDF: %s", pdf_err)

        return json_success(
            "Solicitação criada com sucesso",
            solicitacao.to_dict(),
            201,
        )

    except IntegrityError:
        db.session.rollback()
        return json_error("Erro de integridade ao criar solicitação", 409)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Erro ao criar solicitação")
        return json_error(f"Erro ao criar solicitação: {exc}", 500)


@solicitacoes_exames_bp.route(
    "/solicitacoes-exames/<int:solicitacao_id>",
    methods=["PUT"],
)
def atualizar_solicitacao(solicitacao_id: int):
    """Atualiza solicitação existente."""
    try:
        solicitacao = SolicitacoesDeExames.query.get(solicitacao_id)
        if not solicitacao:
            return json_error("Solicitação não encontrada", 404)

        data = request.json or {}

        if status := data.get("status", "").upper():
            if not SolicitacoesDeExames.validar_status(status):
                return json_error("Status inválido")
            solicitacao.status = status

        if "observacoes" in data:
            solicitacao.observacoes = data.get("observacoes")

        if "valor_desconto" in data:
            solicitacao.valor_desconto = float(data.get("valor_desconto") or 0)
            solicitacao.valor_final = max(
                0,
                float(solicitacao.soma_dos_valores or 0)
                - float(solicitacao.valor_desconto),
            )

        solicitacao.updated_at = get_now_sao_paulo()

        db.session.commit()
        _invalidar_cache_relatorios()

        return json_success("Solicitação atualizada", solicitacao.to_dict())

    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Erro ao atualizar solicitação")
        return json_error(f"Erro ao atualizar: {exc}", 500)


@solicitacoes_exames_bp.route(
    "/solicitacoes-exames/<int:solicitacao_id>",
    methods=["DELETE"],
)
def excluir_solicitacao(solicitacao_id: int):
    """Remove solicitação."""
    try:
        solicitacao = SolicitacoesDeExames.query.get(solicitacao_id)
        if not solicitacao:
            return json_error("Solicitação não encontrada", 404)

        db.session.delete(solicitacao)
        db.session.commit()
        _invalidar_cache_relatorios()

        return json_success("Solicitação excluída")

    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Erro ao excluir solicitação")
        return json_error(f"Erro ao excluir: {exc}", 500)


@solicitacoes_exames_bp.route(
    "/solicitacoes-exames/<int:solicitacao_id>/status",
    methods=["PATCH"],
)
def atualizar_status(solicitacao_id: int):
    """Atualiza apenas o status da solicitação."""
    try:
        solicitacao = SolicitacoesDeExames.query.get(solicitacao_id)
        if not solicitacao:
            return json_error("Solicitação não encontrada", 404)

        data = request.json or {}
        status = data.get("status", "").upper()

        if not SolicitacoesDeExames.validar_status(status):
            return json_error(
                f"Status inválido. Use: {', '.join(SolicitacoesDeExames.STATUS_VALIDOS)}",
            )

        solicitacao.status = status
        solicitacao.updated_at = get_now_sao_paulo()
        db.session.commit()
        _invalidar_cache_relatorios()

        return json_success(f"Status atualizado para {status}", solicitacao.to_dict())

    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Erro ao atualizar status")
        return json_error(f"Erro ao atualizar status: {exc}", 500)


# =============================================================================
# Download PDF de solicitação existente
# =============================================================================


@solicitacoes_exames_bp.route(
    "/solicitacoes-exames/<int:solicitacao_id>/pdf",
    methods=["GET"],
)
def download_pdf_solicitacao(solicitacao_id: int):
    """Gera e retorna PDF de uma solicitação existente.

    Query params:
        sem_valores: true/false — omite coluna de valor e total no PDF
    """
    try:
        solicitacao = SolicitacoesDeExames.query.get(solicitacao_id)
        if not solicitacao:
            return json_error("Solicitação não encontrada", 404)

        # Recupera paciente pelo CPF
        paciente = Pacientes.query.filter(
            Pacientes.cpf == solicitacao.cpf_paciente
        ).first()
        if not paciente:
            return json_error("Paciente não encontrado", 404)

        # Recupera IDs dos exames
        exames_ids = []
        if solicitacao.exames_ids:
            exames_ids = [
                int(eid.strip())
                for eid in solicitacao.exames_ids.split(",")
                if eid.strip().isdigit()
            ]

        if not exames_ids:
            return json_error("Solicitação sem exames vinculados", 400)

        # Médico
        medico_info = _build_medico_info(solicitacao.crm_medico)

        sem_valores = request.args.get("sem_valores", "false").lower() in (
            "true",
            "1",
            "sim",
        )

        pdf_report = ExamRequestPdfReport(
            paciente.id,
            exames_ids,
            medico_info,
            sem_valores=sem_valores,
        )
        return pdf_report.generate_response()

    except ValueError as exc:
        return json_error(str(exc), 404)
    except Exception as exc:
        current_app.logger.exception("Erro ao gerar PDF da solicitação")
        return json_error(f"Erro ao gerar PDF: {exc}", 500)


# =============================================================================
# Rota de compatibilidade (PDF)
# =============================================================================


@solicitacoes_exames_bp.route("/gerar_solicitacao_exames", methods=["POST"])
def gerar_solicitacao_exames_pdf():
    """Rota de compatibilidade para geração de PDF."""
    data = request.json or {}

    if "paciente_id" not in data or "exames_ids" not in data:
        return json_error("paciente_id e exames_ids são obrigatórios")

    try:
        paciente_id = data["paciente_id"]
        exames_ids = data["exames_ids"]
        salvar = data.get("salvar_solicitacao_de_exame", False)
        sem_valores = bool(data.get("sem_valores", False))

        paciente = Pacientes.query.get(paciente_id)
        if not paciente:
            return json_error("Paciente não encontrado", 404)

        exames = Exames.query.filter(Exames.id.in_(exames_ids)).all()
        if not exames:
            return json_error("Nenhum exame encontrado", 404)

        # Busca médico com RQE
        medico_info = _build_medico_info(data.get("crm_medico"))

        if salvar:
            status = data.get("status", "PENDENTE").upper()
            if not SolicitacoesDeExames.validar_status(status):
                return json_error("Status inválido")

            agora = get_now_sao_paulo()
            nova = SolicitacoesDeExames(
                cpf_paciente=paciente.cpf,
                nome_paciente=paciente.nome,
                data=agora.date(),
                hora=agora.time().replace(microsecond=0),
                exames=", ".join(e.nome for e in exames),
                exames_ids=",".join(str(e.id) for e in exames),
                soma_dos_valores=sum(float(e.valor_venda or 0) for e in exames),
                status=status,
                crm_medico=medico_info.get("crm"),
                nome_medico=medico_info.get("nome"),
                created_at=agora,
                updated_at=agora,
            )
            db.session.add(nova)
            db.session.commit()
            _invalidar_cache_relatorios()

        pdf_report = ExamRequestPdfReport(
            paciente_id,
            exames_ids,
            medico_info,
            sem_valores=sem_valores,
        )
        return pdf_report.generate_response()

    except ValueError as exc:
        return json_error(str(exc), 404)
    except Exception as exc:
        current_app.logger.exception("Erro ao gerar solicitação")
        return json_error(str(exc), 500)


# =============================================================================
# Relatórios (com cache)
# =============================================================================


@solicitacoes_exames_bp.route(
    "/relatorios/exames-mais-solicitados",
    methods=["GET"],
)
def relatorio_exames_mais_solicitados():
    """Relatório de exames mais solicitados."""
    try:
        limite = min(int(request.args.get("limite", 20)), 100)

        query = SolicitacoesDeExames.query

        if data_inicio := parse_date(request.args.get("data_inicio")):
            query = query.filter(SolicitacoesDeExames.data >= data_inicio)
        if data_fim := parse_date(request.args.get("data_fim")):
            query = query.filter(SolicitacoesDeExames.data <= data_fim)

        solicitacoes = query.all()

        # Conta exames
        contagem: dict[str, int] = {}
        for sol in solicitacoes:
            for nome in sol.exames.split(","):
                nome = nome.strip()
                if nome:
                    contagem[nome] = contagem.get(nome, 0) + 1

        ranking = sorted(contagem.items(), key=lambda x: x[1], reverse=True)[:limite]

        return jsonify(
            [
                {"nome": nome, "total": total, "posicao": i + 1}
                for i, (nome, total) in enumerate(ranking)
            ]
        )

    except Exception as exc:
        current_app.logger.exception("Erro no relatório")
        return json_error(f"Erro ao gerar relatório: {exc}", 500)


@solicitacoes_exames_bp.route(
    "/relatorios/solicitacoes-por-periodo",
    methods=["GET"],
)
def relatorio_solicitacoes_periodo():
    """Relatório de solicitações agrupadas por período."""
    try:
        data_inicio = parse_date(request.args.get("data_inicio"))
        data_fim = parse_date(request.args.get("data_fim"))
        agrupar = request.args.get("agrupar", "dia")

        if not data_inicio or not data_fim:
            return json_error("data_inicio e data_fim são obrigatórios")

        filtros = [
            SolicitacoesDeExames.data >= data_inicio,
            SolicitacoesDeExames.data <= data_fim,
        ]

        if agrupar == "mes":
            resultados = (
                db.session.query(
                    extract("year", SolicitacoesDeExames.data).label("ano"),
                    extract("month", SolicitacoesDeExames.data).label("mes"),
                    func.count(SolicitacoesDeExames.id).label("total"),
                    func.sum(SolicitacoesDeExames.soma_dos_valores).label(
                        "valor_total"
                    ),
                )
                .filter(*filtros)
                .group_by("ano", "mes")
                .order_by("ano", "mes")
                .all()
            )

            return jsonify(
                [
                    {
                        "periodo": f"{int(r.ano)}-{int(r.mes):02d}",
                        "total_solicitacoes": r.total,
                        "valor_total": round(float(r.valor_total or 0), 2),
                    }
                    for r in resultados
                ]
            )

        # Default: agrupa por dia
        resultados = (
            db.session.query(
                SolicitacoesDeExames.data,
                func.count(SolicitacoesDeExames.id).label("total"),
                func.sum(SolicitacoesDeExames.soma_dos_valores).label("valor_total"),
            )
            .filter(*filtros)
            .group_by(SolicitacoesDeExames.data)
            .order_by(SolicitacoesDeExames.data)
            .all()
        )

        return jsonify(
            [
                {
                    "periodo": r.data.isoformat(),
                    "total_solicitacoes": r.total,
                    "valor_total": round(float(r.valor_total or 0), 2),
                }
                for r in resultados
            ]
        )

    except Exception as exc:
        current_app.logger.exception("Erro no relatório por período")
        return json_error(f"Erro ao gerar relatório: {exc}", 500)


@solicitacoes_exames_bp.route(
    "/relatorios/solicitacoes-por-status",
    methods=["GET"],
)
def relatorio_solicitacoes_status():
    """Relatório de solicitações agrupadas por status."""
    try:
        query = db.session.query(
            SolicitacoesDeExames.status,
            func.count(SolicitacoesDeExames.id).label("total"),
            func.sum(SolicitacoesDeExames.soma_dos_valores).label("valor_total"),
        )

        if data_inicio := parse_date(request.args.get("data_inicio")):
            query = query.filter(SolicitacoesDeExames.data >= data_inicio)
        if data_fim := parse_date(request.args.get("data_fim")):
            query = query.filter(SolicitacoesDeExames.data <= data_fim)

        resultados = query.group_by(SolicitacoesDeExames.status).all()

        return jsonify(
            [
                {
                    "status": r.status,
                    "total": r.total,
                    "valor_total": round(float(r.valor_total or 0), 2),
                }
                for r in resultados
            ]
        )

    except Exception as exc:
        current_app.logger.exception("Erro no relatório por status")
        return json_error(f"Erro ao gerar relatório: {exc}", 500)
