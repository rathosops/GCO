"""
Controller para consultas médicas (CRUD + endpoints auxiliares)

Endpoints:
- GET    /consultas
- GET    /consultas/<id>
- POST   /consultas
- PUT    /consultas/<id>
- DELETE /consultas/<id>

Auxiliares:
- GET    /consultas/tipos
- GET    /consultas/stats
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any, Optional, Tuple

import pytz
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import cast, false, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.types import String as SAString

from app.database import db
from app.models.doctors_model import Medicos
from app.models.medical_appointments_model import Consultas
from app.models.patients_model import Pacientes
from app.models.procedures_model import Procedimentos

consultas_bp = Blueprint("consultas", __name__)

FUSO_BR = pytz.timezone("America/Sao_Paulo")
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y")
TIME_FORMATS = ("%H:%M", "%H:%M:%S")

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


# =============================================================================
# Helpers
# =============================================================================
def _now_br() -> datetime:
    return datetime.now(FUSO_BR)


def _json_error(message: str, status_code: int = 400):
    return jsonify({"error": message}), status_code


def _only_digits(value: Any) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _clean_fixed_digits_str(value: Any, size: int) -> Optional[str]:
    """
    Retorna string somente com dígitos e com tamanho exato.
    Ex: CPF deve ser string de 11 dígitos.
    """
    digits = _only_digits(value)
    if not digits:
        return None
    if len(digits) != size:
        return None
    return digits


def _normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    value_str = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value_str, fmt).date()
        except ValueError:
            continue
    return None


def _parse_time(value: Any) -> Optional[time]:
    if not value:
        return None
    value_str = str(value).strip()
    for fmt in TIME_FORMATS:
        try:
            return datetime.strptime(value_str, fmt).time()
        except ValueError:
            continue
    return None


def _parse_bool(value: Any) -> Optional[bool]:
    """
    Converte valores comuns vindos de querystring/axios:
    - "true"/"false", "1"/"0", "sim"/"nao", True/False, 0/1
    Retorna None se não veio valor ou se inválido.
    """
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        if value in (0, 1):
            return bool(value)
        return None

    text = str(value).strip().lower()
    if text in ("1", "true", "yes", "sim"):
        return True
    if text in ("0", "false", "no", "nao", "não"):
        return False
    return None


def _parse_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _get_limit_offset(args) -> Tuple[int, int]:
    limit_raw = args.get("limit", DEFAULT_LIMIT)
    offset_raw = args.get("offset", 0)

    try:
        limit = int(limit_raw)
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT

    try:
        offset = int(offset_raw)
    except (TypeError, ValueError):
        offset = 0

    limit = max(1, min(limit, MAX_LIMIT))
    offset = max(0, offset)
    return limit, offset


def _apply_order(query, order_value: Optional[str]):
    """
    order suportado pelo frontend:
      - data_desc (default)
      - data_asc
    """
    order = (order_value or "data_desc").strip().lower()
    if order == "data_asc":
        return query.order_by(
            Consultas.data.asc(), Consultas.hora_consulta.asc(), Consultas.id.asc()
        )
    return query.order_by(
        Consultas.data.desc(), Consultas.hora_consulta.desc(), Consultas.id.desc()
    )


def _procedure_exists(nome: Optional[str]) -> bool:
    if not nome:
        return False
    return (
        db.session.query(Procedimentos.id)
        .filter(func.lower(Procedimentos.nome) == func.lower(nome.strip()))
        .first()
        is not None
    )


def _require_patient(cpf_digits: str) -> Optional[Pacientes]:
    """CPF deve ser string com 11 dígitos (model Pacientes.cpf é String(11))."""
    return Pacientes.query.filter(Pacientes.cpf == cpf_digits).first()


def _require_doctor(crm: int) -> Optional[Medicos]:
    """
    Tolerante a diferença de tipo (int vs string) no crm.
    (Mantido por segurança, pois CRM costuma variar por implementação.)
    """
    crm_str = str(crm)
    return Medicos.query.filter(
        (Medicos.crm == crm) | (cast(Medicos.crm, SAString) == crm_str)
    ).first()


# =============================================================================
# Payload Dataclass
# =============================================================================
@dataclass(frozen=True)
class ConsultaPayload:
    """Payload completo para criação/atualização de consultas."""

    # Obrigatórios
    cpf_paciente: str  # CPF SEMPRE como string de 11 dígitos
    crm_medico: int
    tipo: str
    anamnese: str

    # Anamnese expandida
    queixa_principal: Optional[str] = None
    historia_doenca_atual: Optional[str] = None
    exame_fisico: Optional[str] = None

    # Procedimentos
    procedimentos: Optional[str] = None

    # Diagnóstico e conduta
    diagnostico: Optional[str] = None
    cid: Optional[str] = None
    conduta: Optional[str] = None

    # Prescrições
    houve_solicitacao_de_exame: bool = False
    houve_prescricao_medicamentos: bool = False
    medicamentos_prescrevidos: Optional[str] = None

    # Retorno
    retorno_em: Optional[int] = None
    data_retorno: Optional[date] = None

    # Observações
    observacoes_internas: Optional[str] = None

    # Data/hora
    data: Optional[date] = None
    hora_consulta: Optional[time] = None


def _build_payload(
    data: dict,
) -> Tuple[Optional[ConsultaPayload], Optional[Tuple[Any, int]]]:
    """Constrói payload validado a partir do JSON recebido."""

    # CPF (obrigatório, 11 dígitos, SEMPRE string)
    cpf = _clean_fixed_digits_str(data.get("cpf_paciente"), 11)
    if cpf is None:
        return None, _json_error(
            "cpf_paciente é obrigatório e deve ter 11 dígitos.", 400
        )

    # CRM (obrigatório)
    crm_digits = _only_digits(data.get("crm_medico"))
    if not crm_digits or len(crm_digits) < 4:
        return None, _json_error(
            "crm_medico é obrigatório e deve conter dígitos válidos.", 400
        )
    crm = int(crm_digits)

    # Tipo (obrigatório) - aceita legado "tipo_procedimento_consulta"
    tipo = _normalize_text(data.get("tipo")) or _normalize_text(
        data.get("tipo_procedimento_consulta")
    )
    if not tipo:
        return None, _json_error(
            "tipo é obrigatório (ex: IMESC, OCUPACIONAL, etc).", 400
        )

    # Anamnese (obrigatória)
    anamnese = _normalize_text(data.get("anamnese"))
    if not anamnese:
        return None, _json_error("anamnese é obrigatória.", 400)

    # Campos opcionais de anamnese expandida
    queixa_principal = _normalize_text(data.get("queixa_principal"))
    historia_doenca_atual = _normalize_text(data.get("historia_doenca_atual"))
    exame_fisico = _normalize_text(data.get("exame_fisico"))

    # Procedimentos
    procedimentos = _normalize_text(data.get("procedimentos")) or _normalize_text(
        data.get("procedimentos_realizados")
    )

    # Diagnóstico e conduta
    diagnostico = _normalize_text(data.get("diagnostico"))
    cid = _normalize_text(data.get("cid"))
    conduta = _normalize_text(data.get("conduta"))

    # Prescrições (usar parse_bool para evitar bug de "false")
    houve_exame = (
        _parse_bool(
            data.get("houve_solicitacao_de_exame", data.get("houve_solicitacao_exame"))
        )
        or False
    )

    houve_meds = (
        _parse_bool(
            data.get(
                "houve_prescricao_medicamentos",
                data.get("houve_prescricao_medicamento"),
            )
        )
        or False
    )

    meds = _normalize_text(data.get("medicamentos_prescrevidos")) or _normalize_text(
        data.get("medicamentos_prescritos")
    )
    if not houve_meds:
        meds = None

    # Retorno
    retorno_em = _parse_int(data.get("retorno_em"))
    data_retorno = _parse_date(data.get("data_retorno"))

    # Observações internas
    observacoes_internas = _normalize_text(data.get("observacoes_internas"))

    # Data/hora
    data_consulta = _parse_date(data.get("data"))
    hora_consulta = _parse_time(data.get("hora_consulta") or data.get("hora"))

    payload = ConsultaPayload(
        cpf_paciente=cpf,
        crm_medico=crm,
        tipo=tipo.strip(),
        anamnese=anamnese,
        queixa_principal=queixa_principal,
        historia_doenca_atual=historia_doenca_atual,
        exame_fisico=exame_fisico,
        procedimentos=procedimentos,
        diagnostico=diagnostico,
        cid=cid,
        conduta=conduta,
        houve_solicitacao_de_exame=houve_exame,
        houve_prescricao_medicamentos=houve_meds,
        medicamentos_prescrevidos=meds,
        retorno_em=retorno_em,
        data_retorno=data_retorno,
        observacoes_internas=observacoes_internas,
        data=data_consulta,
        hora_consulta=hora_consulta,
    )
    return payload, None


def _apply_payload(model: Consultas, payload: ConsultaPayload) -> None:
    """Aplica todos os campos do payload ao modelo."""
    now = _now_br()

    # Obrigatórios
    model.cpf_paciente = payload.cpf_paciente  # CPF string(11)
    model.crm_medico = payload.crm_medico
    model.tipo = payload.tipo
    model.anamnese = payload.anamnese

    # Anamnese expandida
    model.queixa_principal = payload.queixa_principal
    model.historia_doenca_atual = payload.historia_doenca_atual
    model.exame_fisico = payload.exame_fisico

    # Procedimentos
    model.procedimentos = payload.procedimentos

    # Diagnóstico e conduta
    model.diagnostico = payload.diagnostico
    model.cid = payload.cid
    model.conduta = payload.conduta

    # Prescrições
    model.houve_solicitacao_de_exame = payload.houve_solicitacao_de_exame
    model.houve_prescricao_medicamentos = payload.houve_prescricao_medicamentos
    model.medicamentos_prescrevidos = payload.medicamentos_prescrevidos

    # Retorno
    model.retorno_em = payload.retorno_em
    model.data_retorno = payload.data_retorno

    # Observações
    model.observacoes_internas = payload.observacoes_internas

    # Data/hora (defaults)
    model.data = payload.data or now.date()
    model.hora_consulta = payload.hora_consulta or now.time().replace(microsecond=0)


# =============================================================================
# Routes
# =============================================================================
@consultas_bp.route("/consultas", methods=["GET"])
def get_consultas():
    """
    Lista consultas com filtros opcionais.

    Query params (frontend):
      - search
      - cpf_paciente
      - crm_medico
      - tipo
      - data, data_inicio, data_fim
      - houve_exame, houve_prescricao
      - order: data_desc | data_asc
      - resumo=true
      - limit, offset
    """
    try:
        query = Consultas.query

        if cpf_raw := request.args.get("cpf_paciente"):
            cpf_digits = _clean_fixed_digits_str(cpf_raw, 11)
            if cpf_digits is None:
                return _json_error("cpf_paciente inválido (11 dígitos).", 400)
            query = query.filter(Consultas.cpf_paciente == cpf_digits)

        if crm_raw := request.args.get("crm_medico"):
            crm_digits = _only_digits(crm_raw)
            if not crm_digits:
                return _json_error("crm_medico inválido.", 400)
            query = query.filter(Consultas.crm_medico == int(crm_digits))

        if tipo := request.args.get("tipo"):
            tipo = tipo.strip()
            if tipo:
                query = query.filter(Consultas.tipo.ilike(f"%{tipo}%"))

        if data_str := request.args.get("data"):
            data_obj = _parse_date(data_str)
            if not data_obj:
                return _json_error("data inválida. Use YYYY-MM-DD ou DD/MM/YYYY.", 400)
            query = query.filter(Consultas.data == data_obj)

        if data_inicio := _parse_date(request.args.get("data_inicio")):
            query = query.filter(Consultas.data >= data_inicio)

        if data_fim := _parse_date(request.args.get("data_fim")):
            query = query.filter(Consultas.data <= data_fim)

        houve_exame = _parse_bool(request.args.get("houve_exame"))
        if houve_exame is not None:
            query = query.filter(Consultas.houve_solicitacao_de_exame.is_(houve_exame))

        houve_prescricao = _parse_bool(request.args.get("houve_prescricao"))
        if houve_prescricao is not None:
            query = query.filter(
                Consultas.houve_prescricao_medicamentos.is_(houve_prescricao)
            )

        if search := request.args.get("search"):
            s = search.strip()
            if s:
                # Join para nome do médico/paciente
                query = query.outerjoin(
                    Medicos, Consultas.crm_medico == Medicos.crm
                ).outerjoin(Pacientes, Consultas.cpf_paciente == Pacientes.cpf)

                s_like = f"%{s}%"
                s_digits = _only_digits(s)

                crm_cond = (
                    (Consultas.crm_medico == int(s_digits)) if s_digits else false()
                )
                cpf_cond = (
                    (Consultas.cpf_paciente == s_digits)
                    if len(s_digits) == 11
                    else false()
                )

                query = query.filter(
                    or_(
                        Consultas.tipo.ilike(s_like),
                        Consultas.procedimentos.ilike(s_like),
                        Consultas.anamnese.ilike(s_like),
                        Consultas.diagnostico.ilike(s_like),
                        Medicos.nome.ilike(s_like),
                        Pacientes.nome.ilike(s_like),
                        crm_cond,
                        cpf_cond,
                    )
                )

        limit, offset = _get_limit_offset(request.args)
        query = _apply_order(query, request.args.get("order"))

        consultas = query.limit(limit).offset(offset).all()

        resumo = _parse_bool(request.args.get("resumo")) is True
        if resumo:
            return jsonify([c.to_dict_resumo() for c in consultas])

        return jsonify([c.to_dict() for c in consultas])

    except Exception:  # pylint: disable=broad-except
        current_app.logger.error("Erro ao listar consultas", exc_info=True)
        return _json_error("Erro ao listar consultas", 500)


@consultas_bp.route("/consultas/tipos", methods=["GET"])
def get_consulta_tipos():
    """
    Tipos/procedimentos para preencher filtro/select no frontend.
    Retorna: string[]
    """
    try:
        tipos = (
            db.session.query(Procedimentos.nome)
            .order_by(Procedimentos.nome.asc())
            .all()
        )
        return jsonify([t[0] for t in tipos])
    except Exception:  # pylint: disable=broad-except
        current_app.logger.error("Erro ao listar tipos de consulta", exc_info=True)
        return _json_error("Erro ao listar tipos de consulta", 500)


@consultas_bp.route("/consultas/stats", methods=["GET"])
def get_consultas_stats():
    """
    Retorna exatamente o formato esperado em src/types/consultas.types.ts (ConsultaStats):
      - total
      - consultas_hoje
      - consultas_mes
      - com_solicitacao_exame
      - com_prescricao
      - por_tipo: { tipo, total }[]
      - por_medico: { nome, crm, total }[]
    Aceita filtros:
      - data_inicio, data_fim
    """
    try:
        base = Consultas.query

        data_inicio = _parse_date(request.args.get("data_inicio"))
        data_fim = _parse_date(request.args.get("data_fim"))
        if data_inicio:
            base = base.filter(Consultas.data >= data_inicio)
        if data_fim:
            base = base.filter(Consultas.data <= data_fim)

        hoje = _now_br().date()
        mes_inicio = hoje.replace(day=1)

        total = base.count()
        consultas_hoje = base.filter(Consultas.data == hoje).count()
        consultas_mes = base.filter(Consultas.data >= mes_inicio).count()

        com_solicitacao_exame = base.filter(
            Consultas.houve_solicitacao_de_exame.is_(True)
        ).count()
        com_prescricao = base.filter(
            Consultas.houve_prescricao_medicamentos.is_(True)
        ).count()

        por_tipo_rows = (
            db.session.query(Consultas.tipo, func.count(Consultas.id).label("total"))
            .select_from(Consultas)
            .filter(Consultas.tipo.isnot(None))
            .group_by(Consultas.tipo)
            .order_by(func.count(Consultas.id).desc())
            .limit(10)
            .all()
        )

        por_medico_rows = (
            db.session.query(
                Medicos.nome,
                Medicos.crm,
                func.count(Consultas.id).label("total"),
            )
            .select_from(Consultas)
            .join(Medicos, Consultas.crm_medico == Medicos.crm)
            .group_by(Medicos.nome, Medicos.crm)
            .order_by(func.count(Consultas.id).desc())
            .limit(10)
            .all()
        )

        return jsonify(
            {
                "total": total,
                "consultas_hoje": consultas_hoje,
                "consultas_mes": consultas_mes,
                "com_solicitacao_exame": com_solicitacao_exame,
                "com_prescricao": com_prescricao,
                "por_tipo": [
                    {"tipo": t or "N/A", "total": int(c)} for (t, c) in por_tipo_rows
                ],
                "por_medico": [
                    {"nome": n, "crm": int(crm), "total": int(c)}
                    for (n, crm, c) in por_medico_rows
                ],
            }
        )
    except Exception:  # pylint: disable=broad-except
        current_app.logger.error("Erro ao gerar stats de consultas", exc_info=True)
        return _json_error("Erro ao gerar estatísticas", 500)


@consultas_bp.route("/consultas/<int:consulta_id>", methods=["GET"])
def get_consulta_by_id(consulta_id: int):
    """Busca consulta por ID."""
    try:
        consulta = Consultas.query.get(consulta_id)
        if not consulta:
            return _json_error("Consulta não encontrada.", 404)
        return jsonify(consulta.to_dict())
    except Exception:  # pylint: disable=broad-except
        current_app.logger.error("Erro ao buscar consulta", exc_info=True)
        return _json_error("Erro ao buscar consulta", 500)


@consultas_bp.route("/consultas", methods=["POST"])
def create_consulta():
    """Cria consulta."""
    try:
        data = request.json or {}

        current_app.logger.info(
            "POST /consultas - campos recebidos: %s", list(data.keys())
        )

        payload, err = _build_payload(data)
        if err:
            return err
        assert payload is not None

        paciente = _require_patient(payload.cpf_paciente)
        if not paciente:
            return _json_error(
                "Paciente não encontrado para o cpf_paciente informado.", 404
            )

        medico = _require_doctor(payload.crm_medico)
        if not medico:
            return _json_error(
                "Médico não encontrado para o crm_medico informado.", 404
            )

        if not _procedure_exists(payload.tipo):
            return _json_error(
                "Tipo/Procedimento inválido. Cadastre este procedimento antes de usar.",
                400,
            )

        nova = Consultas(
            cpf_paciente=payload.cpf_paciente,
            crm_medico=payload.crm_medico,
            data=_now_br().date(),
        )
        _apply_payload(nova, payload)

        db.session.add(nova)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Consulta cadastrada com sucesso.",
                    "consulta": nova.to_dict(),
                }
            ),
            201,
        )

    except IntegrityError:
        db.session.rollback()
        current_app.logger.error("Erro de integridade ao criar consulta", exc_info=True)
        return _json_error("Erro de integridade ao criar consulta.", 409)
    except Exception:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error("Erro ao criar consulta", exc_info=True)
        return _json_error("Erro ao criar consulta.", 500)


@consultas_bp.route("/consultas/<int:consulta_id>", methods=["PUT"])
def update_consulta(consulta_id: int):
    """Atualiza consulta."""
    try:
        consulta = Consultas.query.get(consulta_id)
        if not consulta:
            return _json_error("Consulta não encontrada.", 404)

        data = request.json or {}

        current_app.logger.info(
            "PUT /consultas/%s - campos recebidos: %s", consulta_id, list(data.keys())
        )

        payload, err = _build_payload(data)
        if err:
            return err
        assert payload is not None

        paciente = _require_patient(payload.cpf_paciente)
        if not paciente:
            return _json_error(
                "Paciente não encontrado para o cpf_paciente informado.", 404
            )

        medico = _require_doctor(payload.crm_medico)
        if not medico:
            return _json_error(
                "Médico não encontrado para o crm_medico informado.", 404
            )

        if not _procedure_exists(payload.tipo):
            return _json_error(
                "Tipo/Procedimento inválido. Cadastre este procedimento antes de usar.",
                400,
            )

        _apply_payload(consulta, payload)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Consulta atualizada com sucesso.",
                    "consulta": consulta.to_dict(),
                }
            ),
            200,
        )

    except IntegrityError:
        db.session.rollback()
        current_app.logger.error(
            "Erro de integridade ao atualizar consulta", exc_info=True
        )
        return _json_error("Erro de integridade ao atualizar consulta.", 409)
    except Exception:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error("Erro ao atualizar consulta", exc_info=True)
        return _json_error("Erro ao atualizar consulta.", 500)


@consultas_bp.route("/consultas/<int:consulta_id>", methods=["DELETE"])
def delete_consulta(consulta_id: int):
    """Remove consulta."""
    try:
        consulta = Consultas.query.get(consulta_id)
        if not consulta:
            return _json_error("Consulta não encontrada.", 404)

        db.session.delete(consulta)
        db.session.commit()
        return jsonify({"message": "Consulta excluída com sucesso."}), 200

    except Exception:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error("Erro ao excluir consulta", exc_info=True)
        return _json_error("Erro ao excluir consulta.", 500)
