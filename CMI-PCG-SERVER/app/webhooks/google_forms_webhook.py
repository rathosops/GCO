"""
Webhook para receber respostas do Google Forms (ASO Questionário).

Endpoint:
  POST /webhooks/google-forms/aso

Fluxo:
  1. GAS envia JSON com CPF + identificação + anamnese
  2. Valida API_KEY via header X-API-Key
  3. Busca ou cria paciente pelo CPF (com endereço e contato)
  4. Busca ASO pendente para o CPF (sem questionário vinculado)
  5. Cria AsoQuestionario vinculado ao ASO ou pendente (aso_id=NULL)

Segurança:
  - Autenticação via X-API-Key (compartilhada com o GAS)
  - Rate limit recomendado via nginx/reverse proxy
"""

from __future__ import annotations

import logging
import os
from datetime import date

from flask import Blueprint, jsonify, request

from app.database import db
from app.models.aso_questionario_model import (
    AsoQuestionario,
    build_anamnese_template,
)
from app.models.aso_request_model import SolicitacoesDeAso
from app.models.patients_model import Pacientes
from app.utils.validators import clean_cpf, clean_phone, normalize_string, parse_date

logger = logging.getLogger(__name__)

google_forms_webhook_bp = Blueprint(
    "google_forms_webhook",
    __name__,
    url_prefix="/webhooks/google-forms",
)


# ------------------------------------------------------------------ auth


def _validate_api_key() -> bool:
    """Valida X-API-Key contra a env var GOOGLE_FORMS_WEBHOOK_KEY."""
    expected = os.getenv("GOOGLE_FORMS_WEBHOOK_KEY", "")
    if not expected:
        logger.warning("GOOGLE_FORMS_WEBHOOK_KEY não configurada no .env")
        return False
    return request.headers.get("X-API-Key", "") == expected


# ------------------------------------------------------------------ sanitização


def _safe_cpf(raw: str | int | None) -> str | None:
    """Normaliza CPF para string de 11 dígitos. None se inválido."""
    if raw is None:
        return None
    try:
        return clean_cpf(raw)
    except ValueError:
        return None


def _sanitize_nome(raw: str | None) -> str:
    """Sanitiza nome: strip, limite de 300 chars, fallback."""
    nome = normalize_string(raw)
    return nome[:300] if nome else "Pendente cadastro"


def _sanitize_sexo(raw: str | None) -> str | None:
    """Normaliza sexo para M/F. Fallback None (não obrigatório)."""
    if not raw:
        return None
    s = str(raw).strip().upper()
    if s in ("M", "MASCULINO"):
        return "M"
    if s in ("F", "FEMININO"):
        return "F"
    return None


def _sanitize_resposta(val: str | None) -> str | None:
    """Aceita apenas 'sim'/'nao'/None."""
    return val if val in ("sim", "nao") else None


def _sanitize_cep(raw: str | None) -> str | None:
    """CEP → string de 8 dígitos, sem hífen."""
    if not raw:
        return None
    digits = "".join(c for c in str(raw) if c.isdigit())
    return digits if len(digits) == 8 else None


def _sanitize_uf(raw: str | None) -> str | None:
    """UF → 2 letras maiúsculas."""
    if not raw:
        return None
    uf = str(raw).strip().upper()
    return uf if len(uf) == 2 and uf.isalpha() else None


def _truncate(val: str | None, max_len: int) -> str | None:
    """Trunca string com limite. None se vazio."""
    text = normalize_string(val)
    return text[:max_len] if text else None


# ------------------------------------------------------------------ merge


def _merge_anamnese_responses(template: dict, respostas: dict) -> dict:
    """
    Mescla respostas do Form com o template padrão.

    O GAS envia apenas {resposta, observacao} por posição.
    Esta função merge no template que já tem o campo 'texto'.
    """
    merged = {}
    for grupo, perguntas_template in template.items():
        respostas_grupo = respostas.get(grupo, [])
        grupo_merged = []

        for i, pergunta in enumerate(perguntas_template):
            item = dict(pergunta)
            if i < len(respostas_grupo) and respostas_grupo[i]:
                resp = respostas_grupo[i]
                item["resposta"] = _sanitize_resposta(resp.get("resposta"))
                obs = _truncate(resp.get("observacao"), 500)
                if obs:
                    item["observacao"] = obs
            grupo_merged.append(item)

        merged[grupo] = grupo_merged
    return merged


# ------------------------------------------------------------------ paciente


def _find_or_create_patient(cpf: str, identificacao: dict) -> Pacientes:
    """
    Busca paciente pelo CPF ou cria com dados do formulário.

    Campos populados na criação:
      - nome, data_de_nascimento, sexo, numero_de_contato, email
      - cep, logradouro, numero, bairro, cidade, uf
    """
    paciente = Pacientes.query.filter_by(cpf=cpf).first()
    if paciente:
        # Atualiza campos vazios com dados do form (enriquecimento)
        _enrich_patient(paciente, identificacao)
        return paciente

    # data_de_nascimento é NOT NULL → fallback seguro
    data_nasc = parse_date(identificacao.get("data_nascimento"))
    if not data_nasc:
        data_nasc = date(1900, 1, 1)

    # numero_de_contato é BigInteger no model
    telefone_raw = clean_phone(identificacao.get("telefone"))
    telefone_int = int(telefone_raw) if telefone_raw else None

    paciente = Pacientes(
        cpf=cpf,
        nome=_sanitize_nome(identificacao.get("nome")),
        data_de_nascimento=data_nasc,
        sexo=_sanitize_sexo(identificacao.get("sexo")),
        numero_de_contato=telefone_int,
        email=_truncate(identificacao.get("email"), 200),
        cep=_sanitize_cep(identificacao.get("cep")),
        logradouro=_truncate(identificacao.get("logradouro"), 200),
        numero=_truncate(identificacao.get("numero"), 20),
        bairro=_truncate(identificacao.get("bairro"), 100),
        cidade=_truncate(identificacao.get("cidade"), 100),
        uf=_sanitize_uf(identificacao.get("uf")),
    )

    db.session.add(paciente)
    db.session.flush()

    logger.info("Paciente criado via Google Forms: CPF=%s, nome=%s", cpf, paciente.nome)
    return paciente


def _enrich_patient(paciente: Pacientes, identificacao: dict) -> None:
    """
    Preenche campos vazios do paciente com dados do formulário.
    Atualiza nome, sexo e data de nascimento se estavam com placeholder.
    """
    updated = False

    # --- Nome: atualiza se era placeholder ---
    if paciente.nome in ("Pendente cadastro", "", None):
        nome_novo = _sanitize_nome(identificacao.get("nome"))
        if nome_novo and nome_novo != "Pendente cadastro":
            paciente.nome = nome_novo
            updated = True

    # --- Sexo: preenche se vazio ---
    if not paciente.sexo:
        sexo = _sanitize_sexo(identificacao.get("sexo"))
        if sexo:
            paciente.sexo = sexo
            updated = True

    # --- Data de nascimento: atualiza se era placeholder (1900-01-01) ---
    if paciente.data_de_nascimento == date(1900, 1, 1):
        data_nasc = parse_date(identificacao.get("data_nascimento"))
        if data_nasc and data_nasc != date(1900, 1, 1):
            paciente.data_de_nascimento = data_nasc
            updated = True

    # --- Campos de endereço/contato: preenche somente se vazio ---
    field_map = {
        "email": ("email", lambda v: _truncate(v, 200)),
        "cep": ("cep", _sanitize_cep),
        "logradouro": ("logradouro", lambda v: _truncate(v, 200)),
        "numero": ("numero", lambda v: _truncate(v, 20)),
        "bairro": ("bairro", lambda v: _truncate(v, 100)),
        "cidade": ("cidade", lambda v: _truncate(v, 100)),
        "uf": ("uf", _sanitize_uf),
    }

    for attr, (form_key, sanitizer) in field_map.items():
        if not getattr(paciente, attr, None):
            val = sanitizer(identificacao.get(form_key))
            if val:
                setattr(paciente, attr, val)
                updated = True

    # numero_de_contato (BigInteger)
    if not paciente.numero_de_contato:
        tel_raw = clean_phone(identificacao.get("telefone"))
        if tel_raw:
            paciente.numero_de_contato = int(tel_raw)
            updated = True

    if updated:
        logger.info("Paciente CPF=%s enriquecido com dados do formulário", paciente.cpf)


# ------------------------------------------------------------------ ASO lookup


def _find_pending_aso(cpf: str) -> SolicitacoesDeAso | None:
    """Busca o ASO mais recente deste CPF sem questionário vinculado."""
    aso_com_questionario = (
        db.session.query(AsoQuestionario.aso_id)
        .filter(AsoQuestionario.aso_id.isnot(None))
        .subquery()
    )

    return (
        SolicitacoesDeAso.query.filter(
            SolicitacoesDeAso.cpf_paciente == cpf,
            ~SolicitacoesDeAso.id.in_(aso_com_questionario),
        )
        .order_by(SolicitacoesDeAso.created_at.desc())
        .first()
    )


# ------------------------------------------------------------------ endpoint


@google_forms_webhook_bp.route("/aso", methods=["POST"])
def receive_aso_form():
    """Recebe resposta do Google Forms via GAS trigger."""

    if not _validate_api_key():
        logger.warning("Webhook ASO: API key inválida — IP: %s", request.remote_addr)
        return jsonify({"error": "Não autorizado"}), 401

    body = request.get_json(silent=True)
    if not body or not isinstance(body, dict):
        return jsonify({"error": "Body vazio ou JSON inválido"}), 400

    cpf = _safe_cpf(body.get("cpf"))
    if not cpf:
        return jsonify({"error": f"CPF inválido: {body.get('cpf')}"}), 422

    identificacao = body.get("identificacao") or {}
    if not isinstance(identificacao, dict):
        identificacao = {}

    anamnese_raw = body.get("anamnese") or {}
    if not isinstance(anamnese_raw, dict):
        anamnese_raw = {}

    logger.info("Webhook ASO recebido — CPF: %s", cpf)

    try:
        _find_or_create_patient(cpf, identificacao)

        template = build_anamnese_template()
        anamnese_merged = _merge_anamnese_responses(template, anamnese_raw)

        aso = _find_pending_aso(cpf)

        # Atualiza pendente existente se houver
        existing = AsoQuestionario.query.filter_by(
            cpf_paciente=cpf,
            aso_id=None,
        ).first()

        if existing:
            existing.anamnese = anamnese_merged
            if aso:
                existing.vincular_aso(aso.id)
            db.session.commit()

            return (
                jsonify(
                    {
                        "status": "atualizado",
                        "questionario_id": existing.id,
                        "aso_id": existing.aso_id,
                    }
                ),
                200,
            )

        # Cria novo questionário
        questionario = AsoQuestionario(
            aso_id=aso.id if aso else None,
            cpf_paciente=cpf,
            status="vinculado" if aso else "pendente",
            origem="google_forms",
            anamnese=anamnese_merged,
            exame_clinico={},
            created_by="google_forms",
        )

        db.session.add(questionario)
        db.session.commit()

        logger.info(
            "Questionário %s criado — status: %s, aso_id: %s",
            questionario.id,
            questionario.status,
            questionario.aso_id,
        )

        return (
            jsonify(
                {
                    "status": questionario.status,
                    "questionario_id": questionario.id,
                    "aso_id": questionario.aso_id,
                }
            ),
            201,
        )

    except Exception as exc:
        db.session.rollback()
        logger.error("Erro ao processar webhook ASO: %s", exc, exc_info=True)
        return jsonify({"error": "Erro interno ao processar formulário"}), 500
