"""Controller para prontuários médicos"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import or_, cast
from sqlalchemy.types import String as SAString

from app.models.patients_model import Pacientes
from app.models.medical_appointments_model import Consultas

prontuarios_bp = Blueprint("prontuarios", __name__)

DATE_FORMATS = ("%d/%m/%Y", "%Y-%m-%d")


# =============================================================================
# Helpers
# =============================================================================
def _json_error(message: str, status_code: int = 400):
    return jsonify({"error": message}), status_code


def only_digits(value: Any) -> str:
    if value is None:
        return ""
    return "".join(ch for ch in str(value) if ch.isdigit())


def clean_cpf_str(value: Any) -> Optional[str]:
    """
    Retorna CPF como string com exatamente 11 dígitos (sem pontuação),
    ou None se inválido.
    """
    digits = only_digits(value)
    if len(digits) != 11:
        return None
    return digits


def parse_date(value: str | None):
    if not value:
        return None
    value = value.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _is_string_column(model, column_name: str) -> bool:
    """
    Detecta se a coluna do model é do tipo String/VARCHAR, para evitar CAST
    desnecessário e preservar índice quando possível.
    """
    try:
        col = model.__table__.c.get(column_name)
        if col is None:
            return False
        return isinstance(col.type, SAString)
    except Exception:
        return False


def _cpf_equals(model, column_name: str, cpf_digits: str):
    """
    Gera condição SQLAlchemy tolerante a inconsistências de tipo.
    - Se a coluna for String: compara direto (melhor chance de usar índice).
    - Caso contrário: compara pelo CAST(col AS TEXT) = :cpf
    """
    col = model.__table__.c.get(column_name)
    if col is None:
        # fallback defensivo (não deveria acontecer)
        return cast(getattr(model, column_name), SAString) == cpf_digits

    if _is_string_column(model, column_name):
        # Comparação direta string = string (evita o seu erro atual)
        return col == cpf_digits

    # Coluna numérica (ou outro tipo): compara por CAST para texto
    # (tolerante a cenários onde o CPF foi salvo como BIGINT)
    return cast(col, SAString) == cpf_digits


# =============================================================================
# Routes
# =============================================================================
@prontuarios_bp.route("/prontuarios", methods=["GET"])
def get_prontuario():
    """
    Retorna prontuário (paciente + consultas/anamneses)

    Query params:
      - cpf (obrigatório)
      - data_inicio, data_fim (opcionais)
      - tipo, crm_medico, busca (opcionais)
    """
    try:
        cpf_digits = clean_cpf_str(request.args.get("cpf"))
        if cpf_digits is None:
            return _json_error(
                "CPF do paciente é obrigatório e deve ter 11 dígitos", 400
            )

        # Busca paciente com tolerância de tipo (varchar vs bigint)
        paciente = Pacientes.query.filter(
            _cpf_equals(Pacientes, "cpf", cpf_digits)
        ).first()
        if not paciente:
            return _json_error("Paciente não encontrado", 404)

        # Busca consultas do paciente (mesma tolerância)
        query = Consultas.query.filter(
            _cpf_equals(Consultas, "cpf_paciente", cpf_digits)
        )

        if data_inicio := parse_date(request.args.get("data_inicio")):
            query = query.filter(Consultas.data >= data_inicio)

        if data_fim := parse_date(request.args.get("data_fim")):
            query = query.filter(Consultas.data <= data_fim)

        if tipo := request.args.get("tipo"):
            tipo = tipo.strip()
            if tipo:
                query = query.filter(Consultas.tipo.ilike(f"%{tipo}%"))

        if crm_medico := request.args.get("crm_medico"):
            crm_digits = only_digits(crm_medico)
            if crm_digits:
                query = query.filter(Consultas.crm_medico == int(crm_digits))

        if busca := request.args.get("busca"):
            b = busca.strip()
            if b:
                query = query.filter(
                    or_(
                        Consultas.anamnese.ilike(f"%{b}%"),
                        Consultas.procedimentos.ilike(f"%{b}%"),
                    )
                )

        consultas = query.order_by(
            Consultas.data.desc(),
            Consultas.hora_consulta.desc(),
        ).all()

        return jsonify(
            {
                "paciente": paciente.to_dict(),
                "consultas": [c.to_dict() for c in consultas],
            }
        )

    except Exception:
        current_app.logger.error("Erro ao gerar prontuário JSON", exc_info=True)
        return _json_error("Erro ao buscar prontuário", 500)
