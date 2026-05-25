"""
Controller de Questionário de Anamnese Ocupacional (ASO).

Endpoints:
  GET    /aso-questionarios/template                  — Template vazio da anamnese
  GET    /aso-questionarios/buscar?q=<termo>           — Busca pendentes por nome ou CPF
  GET    /aso-questionarios/<aso_id>                   — Questionário vinculado ao ASO
  POST   /aso-questionarios/<aso_id>                   — Cria questionário (manual)
  PUT    /aso-questionarios/<aso_id>                   — Atualiza respostas / exame clínico
  POST   /aso-questionarios/<aso_id>/vincular          — Vincula form pendente ao ASO
  GET    /aso-questionarios/pendentes                  — Lista forms pendentes (sem ASO)
  GET    /aso-questionarios/pendentes/<cpf>            — Forms pendentes de um CPF
  POST   /aso-questionarios/<aso_id>/finalizar         — Marca como completo
  GET    /aso-questionarios/<aso_id>/gerar-link-form   — Gera link do Google Form pré-preenchido
"""

from __future__ import annotations

import os
from urllib.parse import quote

from flask import Blueprint, jsonify, request

from app.database import db
from app.extensions.cache_ext import cache
from app.models.aso_questionario_model import (
    AsoQuestionario,
    build_anamnese_template,
)
from app.models.aso_request_model import SolicitacoesDeAso
from app.models.patients_model import Pacientes
from app.utils.validators import clean_cpf, format_cpf

aso_questionarios_bp = Blueprint(
    "aso_questionarios",
    __name__,
    url_prefix="/aso-questionarios",
)


# ------------------------------------------------------------------ helpers


def _safe_cpf(cpf: int | str | None) -> str | None:
    """Normaliza CPF para string de 11 dígitos. None se inválido."""
    if cpf is None:
        return None
    try:
        return clean_cpf(cpf)
    except ValueError:
        return None


def _get_aso_or_404(aso_id: int) -> SolicitacoesDeAso:
    aso = db.session.get(SolicitacoesDeAso, aso_id)
    if not aso:
        from werkzeug.exceptions import NotFound

        raise NotFound(f"ASO {aso_id} não encontrado.")
    return aso


def _auto_link_pending(aso: SolicitacoesDeAso) -> AsoQuestionario | None:
    """Busca questionário pendente para o CPF do ASO e vincula."""
    cpf = _safe_cpf(aso.cpf_paciente)
    if not cpf:
        return None

    pendente = (
        AsoQuestionario.query.filter_by(cpf_paciente=cpf, aso_id=None)
        .order_by(AsoQuestionario.created_at.desc())
        .first()
    )
    if pendente:
        pendente.vincular_aso(aso.id)
        db.session.commit()
    return pendente


# ------------------------------------------------------------------ GET template


@aso_questionarios_bp.route("/template", methods=["GET"])
@cache.cached(timeout=3600, key_prefix="aso_anamnese_template")
def get_template():
    """Retorna o template vazio da anamnese (cacheado 1h — dados estáticos)."""
    return jsonify(build_anamnese_template()), 200


# ------------------------------------------------------------------ GET buscar (nome ou CPF)


@aso_questionarios_bp.route("/buscar", methods=["GET"])
def buscar_pendentes():
    """
    Busca questionários pendentes por nome ou CPF.

    Query params:
      - q: termo de busca (nome parcial ou dígitos do CPF)

    Detecção automática: se o termo contiver apenas dígitos, busca por CPF;
    caso contrário, busca por nome via JOIN com a tabela de pacientes.
    """
    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify([]), 200

    digits = "".join(c for c in q if c.isdigit())

    if (
        digits
        and len(digits) >= 3
        and len(digits) == len(q.replace(".", "").replace("-", "").replace(" ", ""))
    ):
        # Termo é predominantemente numérico → busca por CPF parcial
        pendentes = (
            AsoQuestionario.query.filter(
                AsoQuestionario.aso_id.is_(None),
                AsoQuestionario.cpf_paciente.like(f"{digits}%"),
            )
            .order_by(AsoQuestionario.created_at.desc())
            .limit(20)
            .all()
        )
    else:
        # Busca por nome via join com pacientes
        pendentes = (
            AsoQuestionario.query.join(
                Pacientes, Pacientes.cpf == AsoQuestionario.cpf_paciente
            )
            .filter(
                AsoQuestionario.aso_id.is_(None),
                Pacientes.nome.ilike(f"%{q}%"),
            )
            .order_by(AsoQuestionario.created_at.desc())
            .limit(20)
            .all()
        )

    return jsonify([p.to_dict() for p in pendentes]), 200


# ------------------------------------------------------------------ GET by ASO


@aso_questionarios_bp.route("/<int:aso_id>", methods=["GET"])
def get_questionario(aso_id: int):
    """
    Busca o questionário vinculado a um ASO.
    Se não existir vinculado, tenta auto-link de pendente.
    """
    aso = _get_aso_or_404(aso_id)

    questionario = AsoQuestionario.query.filter_by(aso_id=aso_id).first()

    if not questionario:
        questionario = _auto_link_pending(aso)

    if not questionario:
        cpf = _safe_cpf(aso.cpf_paciente)
        has_pending = bool(
            cpf
            and AsoQuestionario.query.filter_by(cpf_paciente=cpf, aso_id=None).count()
        )

        return (
            jsonify(
                {
                    "message": "Questionário ainda não preenchido.",
                    "data": None,
                    "has_pending": has_pending,
                }
            ),
            200,
        )

    return jsonify(questionario.to_dict()), 200


# ------------------------------------------------------------------ POST manual


@aso_questionarios_bp.route("/<int:aso_id>", methods=["POST"])
def create_questionario(aso_id: int):
    """Cria questionário manualmente vinculado ao ASO."""
    aso = _get_aso_or_404(aso_id)

    if AsoQuestionario.query.filter_by(aso_id=aso_id).first():
        return (
            jsonify(
                {
                    "error": "Questionário já existe para este ASO. Use PUT para atualizar.",
                }
            ),
            409,
        )

    body = request.get_json(silent=True) or {}

    questionario = AsoQuestionario(
        aso_id=aso.id,
        cpf_paciente=_safe_cpf(aso.cpf_paciente),
        status="vinculado",
        origem="manual",
        anamnese=body.get("anamnese", build_anamnese_template()),
        exame_clinico=body.get("exame_clinico", {}),
        observacoes_medicas=body.get("observacoes_medicas"),
        created_by=body.get("created_by"),
    )

    db.session.add(questionario)
    db.session.commit()

    return jsonify(questionario.to_dict()), 201


# ------------------------------------------------------------------ PUT


@aso_questionarios_bp.route("/<int:aso_id>", methods=["PUT"])
def update_questionario(aso_id: int):
    """Atualiza respostas da anamnese e/ou dados do exame clínico."""
    _get_aso_or_404(aso_id)

    questionario = AsoQuestionario.query.filter_by(aso_id=aso_id).first()
    if not questionario:
        return (
            jsonify(
                {
                    "error": "Questionário não encontrado. Crie antes com POST.",
                }
            ),
            404,
        )

    body = request.get_json(silent=True) or {}

    if "anamnese" in body and isinstance(body["anamnese"], dict):
        anamnese_atual = dict(questionario.anamnese or {})
        anamnese_atual.update(body["anamnese"])
        questionario.anamnese = anamnese_atual

    if "exame_clinico" in body and isinstance(body["exame_clinico"], dict):
        exame_atual = dict(questionario.exame_clinico or {})
        exame_atual.update(body["exame_clinico"])
        questionario.exame_clinico = exame_atual

    if "observacoes_medicas" in body:
        questionario.observacoes_medicas = body["observacoes_medicas"]

    db.session.commit()

    return jsonify(questionario.to_dict()), 200


# ------------------------------------------------------------------ POST vincular


@aso_questionarios_bp.route("/<int:aso_id>/vincular", methods=["POST"])
def vincular_pendente(aso_id: int):
    """Vincula manualmente um questionário pendente ao ASO."""
    aso = _get_aso_or_404(aso_id)

    if AsoQuestionario.query.filter_by(aso_id=aso_id).first():
        return jsonify({"error": "ASO já tem questionário vinculado."}), 409

    body = request.get_json(silent=True) or {}
    qid = body.get("questionario_id")

    if qid:
        pendente = db.session.get(AsoQuestionario, qid)
        if not pendente or pendente.aso_id is not None:
            return (
                jsonify(
                    {
                        "error": "Questionário não encontrado ou já vinculado.",
                    }
                ),
                404,
            )
    else:
        cpf = _safe_cpf(aso.cpf_paciente)
        pendente = (
            (
                AsoQuestionario.query.filter_by(cpf_paciente=cpf, aso_id=None)
                .order_by(AsoQuestionario.created_at.desc())
                .first()
            )
            if cpf
            else None
        )

    if not pendente:
        return jsonify({"error": "Nenhum questionário pendente para este CPF."}), 404

    pendente.vincular_aso(aso.id)
    db.session.commit()

    return jsonify(pendente.to_dict()), 200


# ------------------------------------------------------------------ POST finalizar


@aso_questionarios_bp.route("/<int:aso_id>/finalizar", methods=["POST"])
def finalizar_questionario(aso_id: int):
    """Marca questionário como completo (médico finalizou)."""
    _get_aso_or_404(aso_id)

    questionario = AsoQuestionario.query.filter_by(aso_id=aso_id).first()
    if not questionario:
        return jsonify({"error": "Questionário não encontrado."}), 404

    questionario.finalizar()
    db.session.commit()

    return jsonify(questionario.to_dict()), 200


# ------------------------------------------------------------------ GET pendentes


@aso_questionarios_bp.route("/pendentes", methods=["GET"])
def listar_pendentes():
    """Lista todos os questionários pendentes (sem ASO vinculado)."""
    pendentes = (
        AsoQuestionario.query.filter_by(aso_id=None)
        .order_by(AsoQuestionario.created_at.desc())
        .all()
    )
    return jsonify([q.to_dict() for q in pendentes]), 200


@aso_questionarios_bp.route("/pendentes/<cpf>", methods=["GET"])
def listar_pendentes_cpf(cpf: str):
    """Lista questionários pendentes de um CPF específico."""
    cpf_normalizado = _safe_cpf(cpf)
    if not cpf_normalizado:
        return jsonify({"error": "CPF inválido."}), 400

    pendentes = (
        AsoQuestionario.query.filter_by(cpf_paciente=cpf_normalizado, aso_id=None)
        .order_by(AsoQuestionario.created_at.desc())
        .all()
    )
    return jsonify([q.to_dict() for q in pendentes]), 200


# ------------------------------------------------------------------ GET gerar link


@aso_questionarios_bp.route("/<int:aso_id>/gerar-link-form", methods=["GET"])
def gerar_link_form(aso_id: int):
    """Gera link do Google Form pré-preenchido com CPF e nome."""
    aso = _get_aso_or_404(aso_id)
    paciente = aso.paciente

    base_url = os.getenv("GOOGLE_FORM_URL", "")
    cpf_entry = os.getenv("GOOGLE_FORM_CPF_ENTRY_ID", "")
    nome_entry = os.getenv("GOOGLE_FORM_NOME_ENTRY_ID", "")

    if not base_url:
        return jsonify({"error": "GOOGLE_FORM_URL não configurada."}), 500

    params = []
    if cpf_entry and paciente and paciente.cpf:
        params.append(f"entry.{cpf_entry}={format_cpf(paciente.cpf)}")

    if nome_entry and paciente and paciente.nome:
        params.append(f"entry.{nome_entry}={quote(paciente.nome)}")

    separator = "&" if "?" in base_url else "?"
    url = base_url + (separator + "&".join(params) if params else "")

    return (
        jsonify(
            {
                "url": url,
                "paciente_nome": paciente.nome if paciente else None,
                "cpf": paciente.cpf if paciente else None,
            }
        ),
        200,
    )
