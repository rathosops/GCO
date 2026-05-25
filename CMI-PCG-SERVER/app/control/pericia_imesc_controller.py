"""
Controller de Perícias IMESC.

Fluxo:
1. Paciente cadastrado -> cria perícia (status: aguardando_triagem)
2. Triagem assistente social -> registra parecer (status: aguardando_medico)
3. Avaliação médica -> registra parecer (status: concluido)

Rotas:
- GET    /pericias-imesc
- GET    /pericias-imesc/<id>
- POST   /pericias-imesc
- PUT    /pericias-imesc/<id>
- DELETE /pericias-imesc/<id>
- PATCH  /pericias-imesc/<id>/parecer-social
- PATCH  /pericias-imesc/<id>/parecer-medico
- GET    /pericias-imesc/stats
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any, Optional, Tuple

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.pericia_imesc_model import PericiaIMESC
from app.models.patients_model import Pacientes
from app.models.doctors_model import Medicos
from app.models.social_workers_model import AssistentesSociais

pericias_imesc_bp = Blueprint("pericias_imesc", __name__)

DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y")
TIME_FORMATS = ("%H:%M", "%H:%M:%S")
STATUS_VALIDOS = {"aguardando_triagem", "aguardando_medico", "concluido", "cancelado"}

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _json_error(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


def _only_digits(value: Any) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _clean_cpf(cpf: Any) -> Optional[str]:
    digits = _only_digits(cpf)
    return digits if len(digits) == 11 else None


def _normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    s = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_time(value: Any) -> Optional[time]:
    if not value:
        return None
    s = str(value).strip()
    for fmt in TIME_FORMATS:
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    return None


def _parse_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _get_limit_offset(args) -> Tuple[int, int]:
    limit = _parse_int(args.get("limit")) or DEFAULT_LIMIT
    offset = _parse_int(args.get("offset")) or 0
    return max(1, min(limit, MAX_LIMIT)), max(0, offset)


def _validate_status(value: Any) -> Optional[str]:
    if value is None:
        return None
    status = str(value).strip()
    return status if status in STATUS_VALIDOS else None


def _get_patient(cpf: str) -> Optional[Pacientes]:
    return Pacientes.query.filter(Pacientes.cpf == cpf).first()


def _get_doctor(crm: int) -> Optional[Medicos]:
    return Medicos.query.filter(Medicos.crm == crm).first()


def _get_social_worker(cress: str) -> Optional[AssistentesSociais]:
    return AssistentesSociais.query.filter(
        AssistentesSociais.cress == cress,
        AssistentesSociais.ativo == True
    ).first()


@pericias_imesc_bp.route("/pericias-imesc", methods=["GET"])
def listar_pericias():
    """Lista perícias com filtros."""
    try:
        query = PericiaIMESC.query

        if protocolo := request.args.get("protocolo"):
            query = query.filter(PericiaIMESC.protocolo.ilike(f"%{protocolo.strip()}%"))

        if cpf := request.args.get("cpf_paciente"):
            cpf_limpo = _clean_cpf(cpf)
            if not cpf_limpo:
                return _json_error("cpf_paciente inválido (11 dígitos)", 400)
            query = query.filter(PericiaIMESC.cpf_paciente == cpf_limpo)

        if crm := request.args.get("crm_medico"):
            crm_digits = _only_digits(crm)
            if not crm_digits:
                return _json_error("crm_medico inválido", 400)
            query = query.filter(PericiaIMESC.crm_medico == int(crm_digits))

        if cress := request.args.get("cress_assistente"):
            query = query.filter(PericiaIMESC.cress_assistente == cress.strip())

        if status_raw := request.args.get("status"):
            status = _validate_status(status_raw)
            if not status:
                return _json_error(f"status inválido. Use: {', '.join(sorted(STATUS_VALIDOS))}", 400)
            query = query.filter(PericiaIMESC.status == status)

        if data_inicio := _parse_date(request.args.get("data_inicio")):
            query = query.filter(PericiaIMESC.data_pericia >= data_inicio)

        if data_fim := _parse_date(request.args.get("data_fim")):
            query = query.filter(PericiaIMESC.data_pericia <= data_fim)

        if search := request.args.get("search"):
            term = f"%{search.strip()}%"
            query = query.outerjoin(Pacientes, PericiaIMESC.cpf_paciente == Pacientes.cpf).filter(
                or_(
                    PericiaIMESC.protocolo.ilike(term),
                    Pacientes.nome.ilike(term),
                )
            )

        query = query.order_by(PericiaIMESC.data_pericia.desc(), PericiaIMESC.id.desc())

        limit, offset = _get_limit_offset(request.args)
        pericias = query.limit(limit).offset(offset).all()

        resumo = (request.args.get("resumo") or "false").lower() == "true"
        return jsonify([p.to_dict_resumo() if resumo else p.to_dict() for p in pericias])

    except Exception:
        current_app.logger.error("Erro ao listar perícias IMESC", exc_info=True)
        return _json_error("Erro ao listar perícias", 500)


@pericias_imesc_bp.route("/pericias-imesc/<int:pericia_id>", methods=["GET"])
def buscar_pericia(pericia_id: int):
    """Busca perícia por ID."""
    try:
        pericia = PericiaIMESC.query.get(pericia_id)
        if not pericia:
            return _json_error("Perícia não encontrada", 404)
        return jsonify(pericia.to_dict())
    except Exception:
        current_app.logger.error("Erro ao buscar perícia", exc_info=True)
        return _json_error("Erro ao buscar perícia", 500)


@pericias_imesc_bp.route("/pericias-imesc", methods=["POST"])
def criar_pericia():
    """
    Cria nova perícia IMESC (status inicial: aguardando_triagem).

    Body JSON:
        - protocolo (obrigatório)
        - cpf_paciente (obrigatório)
        - data_pericia (obrigatório)
        - hora_pericia (opcional)
        - observacoes (opcional)
    """
    try:
        data = request.json or {}

        protocolo = _normalize_text(data.get("protocolo"))
        if not protocolo:
            return _json_error("protocolo é obrigatório", 400)

        cpf = _clean_cpf(data.get("cpf_paciente"))
        if not cpf:
            return _json_error("cpf_paciente é obrigatório (11 dígitos)", 400)

        if not _get_patient(cpf):
            return _json_error("Paciente não encontrado", 404)

        data_pericia = _parse_date(data.get("data_pericia"))
        if not data_pericia:
            return _json_error("data_pericia é obrigatória (YYYY-MM-DD ou DD/MM/YYYY)", 400)

        hora_pericia = _parse_time(data.get("hora_pericia")) if data.get("hora_pericia") else None

        nova = PericiaIMESC(
            protocolo=protocolo,
            cpf_paciente=cpf,
            data_pericia=data_pericia,
            hora_pericia=hora_pericia,
            status="aguardando_triagem",
            observacoes=_normalize_text(data.get("observacoes")),
        )

        db.session.add(nova)
        db.session.commit()

        return jsonify({"message": "Perícia criada com sucesso", "pericia": nova.to_dict()}), 201

    except IntegrityError:
        db.session.rollback()
        return _json_error("Erro de integridade ao criar perícia", 409)
    except Exception:
        db.session.rollback()
        current_app.logger.error("Erro ao criar perícia", exc_info=True)
        return _json_error("Erro ao criar perícia", 500)


@pericias_imesc_bp.route("/pericias-imesc/<int:pericia_id>", methods=["PUT"])
def atualizar_pericia(pericia_id: int):
    """Atualiza dados gerais da perícia."""
    try:
        pericia = PericiaIMESC.query.get(pericia_id)
        if not pericia:
            return _json_error("Perícia não encontrada", 404)

        data = request.json or {}

        if "protocolo" in data:
            protocolo = _normalize_text(data.get("protocolo"))
            if not protocolo:
                return _json_error("protocolo não pode ser vazio", 400)
            pericia.protocolo = protocolo

        if "cpf_paciente" in data:
            cpf = _clean_cpf(data.get("cpf_paciente"))
            if not cpf:
                return _json_error("cpf_paciente inválido (11 dígitos)", 400)
            if not _get_patient(cpf):
                return _json_error("Paciente não encontrado", 404)
            pericia.cpf_paciente = cpf

        if "data_pericia" in data:
            dt = _parse_date(data.get("data_pericia"))
            if not dt:
                return _json_error("data_pericia inválida", 400)
            pericia.data_pericia = dt

        if "hora_pericia" in data:
            pericia.hora_pericia = _parse_time(data.get("hora_pericia")) if data.get("hora_pericia") else None

        if "status" in data:
            status = _validate_status(data.get("status"))
            if not status:
                return _json_error(f"status inválido. Use: {', '.join(sorted(STATUS_VALIDOS))}", 400)
            pericia.status = status

        if "observacoes" in data:
            pericia.observacoes = _normalize_text(data.get("observacoes"))

        db.session.commit()
        return jsonify({"message": "Perícia atualizada", "pericia": pericia.to_dict()})

    except IntegrityError:
        db.session.rollback()
        return _json_error("Erro de integridade ao atualizar perícia", 409)
    except Exception:
        db.session.rollback()
        current_app.logger.error("Erro ao atualizar perícia", exc_info=True)
        return _json_error("Erro ao atualizar perícia", 500)


@pericias_imesc_bp.route("/pericias-imesc/<int:pericia_id>", methods=["DELETE"])
def excluir_pericia(pericia_id: int):
    """Exclui perícia."""
    try:
        pericia = PericiaIMESC.query.get(pericia_id)
        if not pericia:
            return _json_error("Perícia não encontrada", 404)

        db.session.delete(pericia)
        db.session.commit()
        return jsonify({"message": "Perícia excluída com sucesso"})

    except Exception:
        db.session.rollback()
        current_app.logger.error("Erro ao excluir perícia", exc_info=True)
        return _json_error("Erro ao excluir perícia", 500)


@pericias_imesc_bp.route("/pericias-imesc/<int:pericia_id>/parecer-social", methods=["PATCH"])
def registrar_parecer_social(pericia_id: int):
    """
    Registra parecer da assistente social (triagem).
    Transição: aguardando_triagem -> aguardando_medico

    Body JSON:
        - parecer_social (obrigatório)
        - cress_assistente (obrigatório)
    """
    try:
        pericia = PericiaIMESC.query.get(pericia_id)
        if not pericia:
            return _json_error("Perícia não encontrada", 404)

        if pericia.status not in ("aguardando_triagem", "aguardando_medico"):
            return _json_error(f"Perícia em status '{pericia.status}' não permite triagem", 400)

        data = request.json or {}

        parecer = _normalize_text(data.get("parecer_social"))
        if not parecer:
            return _json_error("parecer_social é obrigatório", 400)

        cress = _normalize_text(data.get("cress_assistente"))
        if not cress:
            return _json_error("cress_assistente é obrigatório", 400)

        assistente = _get_social_worker(cress)
        if not assistente:
            return _json_error("Assistente social não encontrado ou inativo", 404)

        pericia.parecer_social = parecer
        pericia.cress_assistente = cress
        pericia.data_parecer_social = _utc_now()
        pericia.status = "aguardando_medico"

        db.session.commit()
        return jsonify({"message": "Parecer social registrado", "pericia": pericia.to_dict()})

    except Exception:
        db.session.rollback()
        current_app.logger.error("Erro ao registrar parecer social", exc_info=True)
        return _json_error("Erro ao registrar parecer social", 500)


@pericias_imesc_bp.route("/pericias-imesc/<int:pericia_id>/parecer-medico", methods=["PATCH"])
def registrar_parecer_medico(pericia_id: int):
    """
    Registra parecer médico e conclusão (finaliza perícia).
    Transição: aguardando_medico -> concluido

    Body JSON:
        - parecer_medico (obrigatório)
        - conclusao_medica (obrigatório)
        - crm_medico (obrigatório)
        - cid (opcional)
    """
    try:
        pericia = PericiaIMESC.query.get(pericia_id)
        if not pericia:
            return _json_error("Perícia não encontrada", 404)

        if pericia.status != "aguardando_medico":
            return _json_error(
                f"Perícia em status '{pericia.status}' não permite parecer médico. "
                "Realize a triagem primeiro.",
                400
            )

        data = request.json or {}

        parecer = _normalize_text(data.get("parecer_medico"))
        if not parecer:
            return _json_error("parecer_medico é obrigatório", 400)

        conclusao = _normalize_text(data.get("conclusao_medica"))
        if not conclusao:
            return _json_error("conclusao_medica é obrigatória", 400)

        crm_str = data.get("crm_medico")
        if not crm_str:
            return _json_error("crm_medico é obrigatório", 400)

        crm_digits = _only_digits(crm_str)
        if not crm_digits:
            return _json_error("crm_medico inválido", 400)

        crm = int(crm_digits)
        if not _get_doctor(crm):
            return _json_error("Médico não encontrado", 404)

        pericia.parecer_medico = parecer
        pericia.conclusao_medica = conclusao
        pericia.crm_medico = crm
        pericia.cid = _normalize_text(data.get("cid"))
        pericia.data_parecer_medico = _utc_now()
        pericia.status = "concluido"

        db.session.commit()
        return jsonify({"message": "Parecer médico registrado", "pericia": pericia.to_dict()})

    except Exception:
        db.session.rollback()
        current_app.logger.error("Erro ao registrar parecer médico", exc_info=True)
        return _json_error("Erro ao registrar parecer médico", 500)


@pericias_imesc_bp.route("/pericias-imesc/stats", methods=["GET"])
def stats_pericias():
    """Estatísticas das perícias IMESC."""
    try:
        hoje = date.today()
        inicio_mes = hoje.replace(day=1)

        total = PericiaIMESC.query.count()
        por_status = {
            "aguardando_triagem": PericiaIMESC.query.filter(PericiaIMESC.status == "aguardando_triagem").count(),
            "aguardando_medico": PericiaIMESC.query.filter(PericiaIMESC.status == "aguardando_medico").count(),
            "concluido": PericiaIMESC.query.filter(PericiaIMESC.status == "concluido").count(),
            "cancelado": PericiaIMESC.query.filter(PericiaIMESC.status == "cancelado").count(),
        }

        return jsonify({
            "total": total,
            **por_status,
            "pericias_hoje": PericiaIMESC.query.filter(PericiaIMESC.data_pericia == hoje).count(),
            "pericias_mes": PericiaIMESC.query.filter(PericiaIMESC.data_pericia >= inicio_mes).count(),
        })

    except Exception:
        current_app.logger.error("Erro ao gerar stats de perícias", exc_info=True)
        return _json_error("Erro ao gerar estatísticas", 500)
