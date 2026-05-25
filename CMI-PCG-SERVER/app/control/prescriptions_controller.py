"""
Controller de receituários médicos.

Endpoints:
    GET    /receituarios                   → Listar com filtros
    GET    /receituarios/<id>              → Buscar por ID (com itens)
    POST   /receituarios                   → Criar receituário
    PUT    /receituarios/<id>              → Atualizar cabeçalho
    DELETE /receituarios/<id>              → Cancelar receituário

    POST   /receituarios/<id>/dispensar/<item_id>  → Dispensar item
    GET    /receituarios/paciente/<cpf>    → Receitas de um paciente
    GET    /receituarios/medico/<crm>      → Receitas de um médico
    GET    /receituarios/tipos             → Tipos e vias disponíveis
    GET    /receituarios/stats             → Estatísticas
"""

from __future__ import annotations

from datetime import date, timedelta

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func, or_

from app.database import db
from app.models.prescriptions_model import (
    TIPOS_RECEITA,
    STATUS_RECEITA,
    VIAS_ADMINISTRACAO,
    Receituarios,
)
from app.models.prescription_items_model import ReceituarioItens
from app.models.patients_model import Pacientes
from app.models.doctors_model import Medicos
from app.src.prescription_service import (
    PrescricaoError,
    PrescricaoValidacaoError,
    PrescricaoDispensacaoError,
    prescription_service,
)
from app.utils.responses import get_pagination, json_error, json_success
from app.utils.validators import clean_cpf, format_cpf, only_digits

receituarios_bp = Blueprint("receituarios", __name__)


# ── Helpers locais ───────────────────────────────────────────────────────


def _safe_int(value, *, default=None):
    """Converte para int com fallback."""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _parse_bool(value):
    """Converte para bool."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("true", "1", "sim", "yes")


def _parse_date(value):
    """Parse de data ISO ou BR."""
    if not value:
        return None
    from datetime import datetime

    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


# ══════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════


@receituarios_bp.route("/receituarios", methods=["GET"])
def get_receituarios():
    """Lista receituários com filtros."""
    try:
        query = Receituarios.query

        if cpf := request.args.get("cpf_paciente"):
            query = query.filter(Receituarios.cpf_paciente == only_digits(cpf))

        if crm := request.args.get("crm_medico"):
            query = query.filter(Receituarios.crm_medico == int(only_digits(crm)))

        if tipo := request.args.get("tipo_receita"):
            query = query.filter(Receituarios.tipo_receita == tipo.strip().upper())

        if status := request.args.get("status"):
            query = query.filter(Receituarios.status == status.strip().upper())

        if data_inicio := _parse_date(request.args.get("data_inicio")):
            query = query.filter(Receituarios.data_prescricao >= data_inicio)

        if data_fim := _parse_date(request.args.get("data_fim")):
            query = query.filter(Receituarios.data_prescricao <= data_fim)

        if consulta_id := _safe_int(request.args.get("consulta_id")):
            query = query.filter(Receituarios.consulta_id == consulta_id)

        if search := request.args.get("search"):
            s = f"%{search}%"
            paciente_ids = (
                db.session.query(Pacientes.cpf)
                .filter(Pacientes.nome.ilike(s))
                .subquery()
            )
            medico_crms = (
                db.session.query(Medicos.crm).filter(Medicos.nome.ilike(s)).subquery()
            )
            query = query.filter(
                or_(
                    Receituarios.cpf_paciente.in_(paciente_ids),
                    Receituarios.crm_medico.in_(medico_crms),
                )
            )

        query = query.order_by(
            Receituarios.data_prescricao.desc(), Receituarios.id.desc()
        )

        limit, offset = get_pagination()
        receituarios = query.limit(limit).offset(offset).all()

        return jsonify([r.to_dict_resumo() for r in receituarios])

    except Exception as exc:
        current_app.logger.error("Erro ao listar receituários: %s", exc, exc_info=True)
        return json_error("Erro ao listar receituários", 500)


@receituarios_bp.route("/receituarios/<int:rec_id>", methods=["GET"])
def get_receituario_by_id(rec_id: int):
    """Busca receituário por ID com itens."""
    try:
        rec = Receituarios.query.get(rec_id)
        if not rec:
            return json_error("Receituário não encontrado", 404)

        return jsonify(rec.to_dict(include_itens=True))

    except Exception as exc:
        current_app.logger.error("Erro ao buscar receituário: %s", exc, exc_info=True)
        return json_error("Erro ao buscar receituário", 500)


@receituarios_bp.route("/receituarios", methods=["POST"])
def create_receituario():
    """
    Cria novo receituário médico.

    Body JSON:
        cpf_paciente (obrigatório): CPF do paciente
        crm_medico (obrigatório): CRM do médico prescritor
        tipo_receita: SIMPLES | CONTROLE_ESPECIAL | ANTIMICROBIANO
        consulta_id: ID da consulta vinculada
        observacoes_gerais: Texto livre
        orientacoes_paciente: Orientações ao paciente
        validade_dias: Override da validade padrão
        itens (obrigatório): Lista de itens [
            {
                nome_medicamento: str (obrigatório),
                posologia: str (obrigatório),
                medicamento_id: int (opcional),
                principio_ativo: str,
                concentracao: str,
                forma_farmaceutica: str,
                via_administracao: str,
                quantidade: int,
                unidade_quantidade: str,
                duracao_dias: int,
                uso_continuo: bool,
                is_amostra_gratis: bool,
                observacoes: str,
            }
        ]
    """
    try:
        data = request.json or {}

        if not data.get("cpf_paciente"):
            return json_error("CPF do paciente é obrigatório")
        if not data.get("crm_medico"):
            return json_error("CRM do médico é obrigatório")
        if not data.get("itens"):
            return json_error("Itens são obrigatórios")

        cpf = only_digits(data["cpf_paciente"])
        if len(cpf) != 11:
            return json_error("CPF inválido (11 dígitos)")

        crm = int(only_digits(data["crm_medico"]))

        receituario = prescription_service.criar_receituario(
            cpf_paciente=cpf,
            crm_medico=crm,
            tipo_receita=(data.get("tipo_receita") or "SIMPLES").strip().upper(),
            itens=data["itens"],
            consulta_id=_safe_int(data.get("consulta_id")),
            observacoes_gerais=(data.get("observacoes_gerais") or "").strip() or None,
            orientacoes_paciente=(data.get("orientacoes_paciente") or "").strip()
            or None,
            validade_dias=_safe_int(data.get("validade_dias")),
        )

        return json_success(
            "Receituário criado com sucesso",
            data=receituario.to_dict(),
            status_code=201,
        )

    except PrescricaoValidacaoError as exc:
        return json_error(str(exc), 400)
    except PrescricaoError as exc:
        return json_error(str(exc), 422)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao criar receituário: %s", exc, exc_info=True)
        return json_error("Erro ao criar receituário", 500)


@receituarios_bp.route("/receituarios/<int:rec_id>", methods=["PUT"])
def update_receituario(rec_id: int):
    """Atualiza cabeçalho do receituário (observações/orientações)."""
    try:
        rec = Receituarios.query.get(rec_id)
        if not rec:
            return json_error("Receituário não encontrado", 404)

        if rec.status != "ATIVA":
            return json_error("Apenas receituários ativos podem ser editados", 409)

        data = request.json or {}

        if "observacoes_gerais" in data:
            rec.observacoes_gerais = (data["observacoes_gerais"] or "").strip() or None
        if "orientacoes_paciente" in data:
            rec.orientacoes_paciente = (
                data["orientacoes_paciente"] or ""
            ).strip() or None

        db.session.commit()
        return json_success("Receituário atualizado", data=rec.to_dict())

    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(
            "Erro ao atualizar receituário: %s", exc, exc_info=True
        )
        return json_error("Erro ao atualizar receituário", 500)


@receituarios_bp.route("/receituarios/<int:rec_id>", methods=["DELETE"])
def cancel_receituario(rec_id: int):
    """Cancela receituário (soft delete)."""
    try:
        data = request.json or {}
        motivo = (data.get("motivo") or "").strip()

        if not motivo:
            return json_error("Motivo de cancelamento é obrigatório")

        receituario = prescription_service.cancelar_receituario(rec_id, motivo=motivo)
        return json_success(
            "Receituário cancelado",
            data=receituario.to_dict(include_itens=False),
        )

    except PrescricaoValidacaoError as exc:
        return json_error(str(exc), 400)
    except PrescricaoError as exc:
        return json_error(str(exc), 422)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao cancelar receituário: %s", exc, exc_info=True)
        return json_error("Erro ao cancelar receituário", 500)


# ══════════════════════════════════════════════════════════════════════════
# DISPENSAÇÃO
# ══════════════════════════════════════════════════════════════════════════


@receituarios_bp.route(
    "/receituarios/<int:rec_id>/dispensar/<int:item_id>", methods=["POST"]
)
def dispensar_item(rec_id: int, item_id: int):
    """
    Dispensa item do receituário via farmácia interna.

    Body JSON (opcional):
        quantidade: int (override)
        lote_id: int (lote específico; se ausente, usa FEFO)
    """
    try:
        # Valida vínculo item <-> receituário
        item = ReceituarioItens.query.get(item_id)
        if not item or item.receituario_id != rec_id:
            return json_error("Item não encontrado neste receituário", 404)

        data = request.json or {}

        item = prescription_service.dispensar_item(
            item_id,
            quantidade=_safe_int(data.get("quantidade")),
            lote_id=_safe_int(data.get("lote_id")),
        )

        return json_success("Item dispensado com sucesso", data=item.to_dict())

    except PrescricaoDispensacaoError as exc:
        return json_error(str(exc), 409)
    except PrescricaoError as exc:
        return json_error(str(exc), 422)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error("Erro ao dispensar item: %s", exc, exc_info=True)
        return json_error("Erro ao dispensar item", 500)


# ══════════════════════════════════════════════════════════════════════════
# CONSULTAS POR PACIENTE / MÉDICO
# ══════════════════════════════════════════════════════════════════════════


@receituarios_bp.route("/receituarios/paciente/<cpf>", methods=["GET"])
def get_receituarios_by_paciente(cpf: str):
    """Lista receituários de um paciente."""
    try:
        cpf_limpo = only_digits(cpf)
        if len(cpf_limpo) != 11:
            return json_error("CPF inválido", 400)

        query = Receituarios.query.filter(
            Receituarios.cpf_paciente == cpf_limpo
        ).order_by(Receituarios.data_prescricao.desc())

        limit, offset = get_pagination()
        receituarios = query.limit(limit).offset(offset).all()

        return jsonify(
            {
                "cpf_paciente": cpf_limpo,
                "total": query.count(),
                "receituarios": [r.to_dict_resumo() for r in receituarios],
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "Erro ao buscar receituários do paciente: %s", exc, exc_info=True
        )
        return json_error("Erro ao buscar receituários", 500)


@receituarios_bp.route("/receituarios/medico/<crm>", methods=["GET"])
def get_receituarios_by_medico(crm: str):
    """Lista receituários de um médico."""
    try:
        crm_int = int(only_digits(crm))

        query = Receituarios.query.filter(Receituarios.crm_medico == crm_int).order_by(
            Receituarios.data_prescricao.desc()
        )

        limit, offset = get_pagination()
        receituarios = query.limit(limit).offset(offset).all()

        return jsonify(
            {
                "crm_medico": crm_int,
                "total": query.count(),
                "receituarios": [r.to_dict_resumo() for r in receituarios],
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "Erro ao buscar receituários do médico: %s", exc, exc_info=True
        )
        return json_error("Erro ao buscar receituários", 500)


# ══════════════════════════════════════════════════════════════════════════
# AUXILIARES
# ══════════════════════════════════════════════════════════════════════════


@receituarios_bp.route("/receituarios/tipos", methods=["GET"])
def get_tipos_receita():
    """Retorna tipos de receita, vias de administração e status."""
    return jsonify(
        {
            "tipos_receita": [{"codigo": k, **v} for k, v in TIPOS_RECEITA.items()],
            "vias_administracao": list(VIAS_ADMINISTRACAO),
            "status_receita": list(STATUS_RECEITA),
        }
    )


@receituarios_bp.route("/receituarios/stats", methods=["GET"])
def get_receituarios_stats():
    """Estatísticas de receituários."""
    try:
        from app.utils.timezone import get_today_sao_paulo

        hoje = get_today_sao_paulo()
        inicio_mes = hoje.replace(day=1)

        total = Receituarios.query.count()
        ativas = Receituarios.query.filter(Receituarios.status == "ATIVA").count()
        dispensadas = Receituarios.query.filter(
            Receituarios.status == "DISPENSADA"
        ).count()
        canceladas = Receituarios.query.filter(
            Receituarios.status == "CANCELADA"
        ).count()

        mes_atual = Receituarios.query.filter(
            Receituarios.data_prescricao >= inicio_mes
        ).count()

        por_tipo = (
            db.session.query(
                Receituarios.tipo_receita,
                func.count(Receituarios.id),
            )
            .group_by(Receituarios.tipo_receita)
            .all()
        )

        amostras = (
            db.session.query(func.count(ReceituarioItens.id))
            .filter(ReceituarioItens.is_amostra_gratis.is_(True))
            .scalar()
            or 0
        )

        return jsonify(
            {
                "total": total,
                "ativas": ativas,
                "dispensadas": dispensadas,
                "canceladas": canceladas,
                "mes_atual": mes_atual,
                "amostras_gratis": amostras,
                "por_tipo": [{"tipo": t, "total": c} for t, c in por_tipo],
            }
        )

    except Exception as exc:
        current_app.logger.error("Erro ao buscar estatísticas: %s", exc, exc_info=True)
        return json_error("Erro ao buscar estatísticas", 500)
