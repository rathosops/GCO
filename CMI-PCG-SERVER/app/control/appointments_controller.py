"""
Controller de Agendamentos.

Objetivos:
- Seguro, previsível e fácil de manter (DRY/KISS).
- Validar entradas e retornar erros 400 claros (evitar 500).
- Suportar comparecimento (paciente_compareceu) e status coerente.
- Validar procedimento respeitando FK (procedimentos.nome).
- Validar feriados e fins de semana.

Rotas:
- GET    /agendamentos
- GET    /agendamentos/<id>
- POST   /agendamentos
- PUT    /agendamentos/<id>
- DELETE /agendamentos/<id>
- POST   /agendamentos/importar   (CSV)
- GET    /agendamentos/verificar-data
"""

from __future__ import annotations

from datetime import datetime, timedelta
from io import BytesIO
from typing import Any, Optional, Tuple

import csv
import logging
import pytz
import unicodedata
from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import DataError, IntegrityError

from app.database import db
from app.models.appointments_model import Agendamentos
from app.src.holidays_service import is_blocked_for_scheduling

# Se existir o model de procedimentos (normalmente é model/procedures_model.py),
# importe para validar a FK. Ajuste o import se o nome da classe for diferente.
try:
    from app.models.procedures_model import Procedimentos  # type: ignore
except Exception:  # pragma: no cover
    Procedimentos = None  # fallback (não recomendado em produção)

LOGGER = logging.getLogger(__name__)

agendamentos_bp = Blueprint("agendamentos", __name__)

FUSO_BRASIL = pytz.timezone("America/Sao_Paulo")

STATUS_ALLOWED = {"AGENDADO", "CONFIRMADO", "REALIZADO", "CANCELADO", "FALTOU"}
ALLOWED_IMPORT_EXTENSIONS = {".csv"}


# -----------------------------
# Helpers (DRY)
# -----------------------------
def _today() -> datetime.date:
    return datetime.now(FUSO_BRASIL).date()


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def _required_fields(
    payload: dict[str, Any], fields: list[str]
) -> Tuple[bool, Optional[str]]:
    missing = [f for f in fields if f not in payload or _is_blank(payload.get(f))]
    if missing:
        return False, f"Campo(s) obrigatório(s) faltando: {', '.join(missing)}"
    return True, None


def _parse_date(value: Any) -> Tuple[Optional[datetime.date], Optional[str]]:
    """
    Aceita:
      - "hoje", "amanha"
      - "YYYY-MM-DD"
    """
    s = "" if value is None else str(value).strip().lower()
    if s == "hoje":
        return _today(), None
    if s == "amanha":
        return _today() + timedelta(days=1), None

    try:
        return datetime.strptime(s, "%Y-%m-%d").date(), None
    except ValueError:
        return None, "Formato de data inválido. Use YYYY-MM-DD ou 'hoje'/'amanha'."


def _parse_time(value: Any) -> Tuple[Optional[datetime.time], Optional[str]]:
    """
    Aceita:
      - "HH:MM"
      - "HH:MM:SS"
    """
    if value is None:
        return None, "Hora não informada."

    s = str(value).strip()
    if _is_blank(s):
        return None, "Hora não informada."

    if len(s.split(":")) == 2:
        s = f"{s}:00"

    try:
        return datetime.strptime(s, "%H:%M:%S").time(), None
    except ValueError:
        return None, "Formato de hora inválido. Use HH:MM ou HH:MM:SS."


def _normalize_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)

    s = str(value).strip().lower()
    if s in {"true", "1", "sim", "yes"}:
        return True
    if s in {"false", "0", "nao", "não", "no"}:
        return False
    return None


def _normalize_bigint(value: Any) -> Optional[int]:
    """
    Converte valores para bigint com segurança:
    - "" / None -> None
    - string numérica -> int
    - int -> int
    - outros -> None
    """
    if value is None:
        return None
    if isinstance(value, int):
        return value

    s = str(value).strip()
    if s == "":
        return None

    # mantém só dígitos (útil para CPF/telefone com máscara)
    digits = "".join(ch for ch in s if ch.isdigit())
    if digits == "":
        return None

    try:
        return int(digits)
    except ValueError:
        return None


def _normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _normalize_status(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip().upper()
    return s if s in STATUS_ALLOWED else None


def _status_from_attendance(compareceu: Optional[bool]) -> Optional[str]:
    if compareceu is True:
        return "REALIZADO"
    if compareceu is False:
        return "FALTOU"
    return None


def _strip_accents_lower(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.strip().lower()


def _normalize_procedimento_import(value: Any) -> Optional[str]:
    """
    Regra do IMPORT (CSV):
    - Se procedimento começar com "Deficiência" (ex.: "Deficiência Física", "Deficiência Visual"...),
      força "IMESC" para passar na FK (procedimentos.nome).
    - Caso contrário, retorna o procedimento normalizado (trim) sem alterar.
    """
    proc = _normalize_text(value)
    if not proc:
        return None

    proc_key = _strip_accents_lower(proc)
    if proc_key.startswith("deficiencia"):
        return "IMESC"

    return proc


def _resolve_procedimento_canon(
    procedimento: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """
    Resolve o procedimento para o valor CANÔNICO cadastrado em procedimentos.nome,
    aceitando variações de caixa/acentos na entrada.

    Retorna:
      - (canon, None) se ok
      - (None, erro) se inválido
    """
    if procedimento is None:
        return None, None

    if Procedimentos is None:
        # Se não conseguimos importar o model, melhor não deixar estourar 500:
        return (
            None,
            "Validação de procedimento indisponível (model Procedimentos não importado).",
        )

    proc_in = _normalize_text(procedimento)
    if not proc_in:
        return None, None

    # 1) tenta match exato (rápido)
    exact = (
        db.session.query(Procedimentos.nome)  # type: ignore[attr-defined]
        .filter(Procedimentos.nome == proc_in)  # type: ignore[attr-defined]
        .first()
    )
    if exact:
        return exact[0], None

    # 2) match case-insensitive
    lower_hit = (
        db.session.query(Procedimentos.nome)  # type: ignore[attr-defined]
        .filter(func.lower(Procedimentos.nome) == proc_in.lower())  # type: ignore[attr-defined]
        .first()
    )
    if lower_hit:
        return lower_hit[0], None

    # 3) fallback: match ignorando acentos também (em memória; tabela normalmente pequena)
    rows = db.session.query(Procedimentos.nome).all()  # type: ignore[attr-defined]
    target_key = _strip_accents_lower(proc_in)
    for (nome_db,) in rows:
        if _strip_accents_lower(nome_db) == target_key:
            return nome_db, None

    return None, (
        f"Procedimento inválido: '{proc_in}'. "
        "Cadastre esse procedimento na tabela 'procedimentos' antes de agendar."
    )


def _validate_not_holiday(dia: datetime.date) -> Tuple[bool, Optional[str]]:
    """
    Valida que a data não é feriado ou dia bloqueado.

    Returns:
        Tupla (válido, mensagem_erro)
    """
    blocked, motivo = is_blocked_for_scheduling(dia)
    if blocked:
        return False, f"Data {dia.isoformat()} bloqueada para agendamento: {motivo}"

    # Verifica fim de semana
    if dia.weekday() in (5, 6):
        day_name = "Sábado" if dia.weekday() == 5 else "Domingo"
        return False, f"Não é permitido agendar em {day_name}."

    return True, None


def _bad_request(message: str, code: int = 400):
    return jsonify({"error": message}), code


def _not_found(message: str = "Agendamento não encontrado"):
    return jsonify({"error": message}), 404


# -----------------------------
# CSV import helpers
# -----------------------------
def _normalize_header(value: str) -> str:
    """
    Normaliza header do CSV para matching:
    - lower
    - remove acentos
    - troca espaços por underscore
    """
    s = value.strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.replace(" ", "_")
    return s


def _guess_delimiter(sample: str) -> str:
    """
    Heurística simples (mais previsível que depender do csv.Sniffer em todos os casos).
    """
    candidates = [",", ";", "\t", "|"]
    counts = {c: sample.count(c) for c in candidates}
    best = max(counts, key=counts.get)
    return best if counts[best] > 0 else ","


def _decode_bytes(data: bytes) -> str:
    """
    Tenta decodificar de forma robusta (arquivos BR geralmente vêm em latin1/cp1252).
    """
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    # fallback: mantém algo decodificado (sem explodir 500)
    return data.decode("latin1", errors="replace")


def _parse_ddmmyyyy_hhmm(
    value: Any,
) -> Tuple[Optional[datetime.date], Optional[datetime.time], Optional[str]]:
    """
    Ex: "06/01/2026 11:45"
    """
    if value is None:
        return None, None, "Data Agendamento não informada."

    s = str(value).strip()
    if not s:
        return None, None, "Data Agendamento não informada."

    try:
        dt = datetime.strptime(s, "%d/%m/%Y %H:%M")
        return dt.date(), dt.time(), None
    except ValueError:
        return None, None, "Formato inválido de Data Agendamento. Use DD/MM/YYYY HH:MM."


def _map_external_status(raw: Optional[str]) -> Optional[str]:
    """
    Mapeia status do CSV (ex: 'Não iniciado') para os status do backend.
    """
    if raw is None:
        return None

    s = str(raw).strip().lower()
    if not s:
        return None

    mapping = {
        "nao iniciado": "AGENDADO",
        "não iniciado": "AGENDADO",
        "iniciado": "CONFIRMADO",
        "confirmado": "CONFIRMADO",
        "finalizado": "REALIZADO",
        "realizado": "REALIZADO",
        "cancelado": "CANCELADO",
        "faltou": "FALTOU",
    }
    return mapping.get(s)


def _parse_nao_compareceu(value: Any) -> Optional[bool]:
    """
    No CSV de exemplo, 'Não Compareceu' pode vir com HTML (fa-times/fa-check),
    ou com textos do tipo Sim/Não.
    Retorno: paciente_compareceu (True/False) ou None.
    """
    if value is None:
        return None

    s = str(value).strip().lower()
    if not s:
        return None

    # HTML icons comuns
    if "fa-check" in s:
        # "Não Compareceu" == True => paciente_compareceu == False
        return False
    if "fa-times" in s:
        # geralmente significa "não", mas é ambíguo no seu export (muito comum vir sempre times).
        # não vamos afirmar comparecimento automaticamente.
        return None

    b = _normalize_bool(s)
    if b is True:
        return False
    if b is False:
        return True
    return None


def _file_has_allowed_extension(filename: str) -> bool:
    lower = (filename or "").lower().strip()
    return any(lower.endswith(ext) for ext in ALLOWED_IMPORT_EXTENSIONS)


# -----------------------------
# Rotas
# -----------------------------
@agendamentos_bp.route("/agendamentos", methods=["GET"])
def get_agendamentos():
    """
    Filtros suportados (querystring):
    - dia: YYYY-MM-DD | hoje | amanha
    - nome_paciente: busca parcial (ilike)
    - cpf_paciente: busca exata (bigint)
    - status: AGENDADO|CONFIRMADO|REALIZADO|CANCELADO|FALTOU
    - procedimento: nome exato
    - paciente_compareceu: true/false/1/0/sim/nao
    """
    nome = _normalize_text(request.args.get("nome_paciente"))
    cpf = _normalize_bigint(request.args.get("cpf_paciente"))
    dia_raw = request.args.get("dia")

    status = _normalize_status(request.args.get("status"))
    procedimento = _normalize_text(request.args.get("procedimento"))
    compareceu = _normalize_bool(request.args.get("paciente_compareceu"))

    query = Agendamentos.query

    if nome:
        query = query.filter(Agendamentos.nome_paciente.ilike(f"%{nome}%"))
    if cpf is not None:
        query = query.filter(Agendamentos.cpf_paciente == cpf)
    if dia_raw:
        dia, err = _parse_date(dia_raw)
        if err:
            return _bad_request(err)
        query = query.filter(Agendamentos.dia == dia)

    if status:
        query = query.filter(Agendamentos.status == status)
    if procedimento:
        query = query.filter(Agendamentos.procedimento == procedimento)
    if compareceu is not None:
        query = query.filter(Agendamentos.paciente_compareceu == compareceu)

    agendamentos = query.order_by(Agendamentos.hora.asc()).all()
    return jsonify([ag.to_dict() for ag in agendamentos]), 200


@agendamentos_bp.route("/agendamentos/<int:agendamento_id>", methods=["GET"])
def get_agendamento_by_id(agendamento_id: int):
    ag = Agendamentos.query.get(agendamento_id)
    if not ag:
        return _not_found()
    return jsonify(ag.to_dict()), 200


@agendamentos_bp.route("/agendamentos", methods=["POST"])
def create_agendamento():
    """
    Cria um agendamento.

    Regras:
    - dia/hora/nome_paciente obrigatórios
    - não aceita dia passado
    - não aceita feriados ou fins de semana
    - procedimento (se vier) deve existir em procedimentos.nome (FK)
    - cpf/telefone/protocolo vazios viram NULL
    - paciente_compareceu pode implicar status REALIZADO/FALTOU
    """
    payload = request.json or {}
    ok, err = _required_fields(payload, ["dia", "hora", "nome_paciente"])
    if not ok:
        return _bad_request(err or "Dados inválidos.")

    dia, err = _parse_date(payload.get("dia"))
    if err:
        return _bad_request(err)
    hora, err = _parse_time(payload.get("hora"))
    if err:
        return _bad_request(err)

    if dia < _today():
        return _bad_request("Não é possível agendar para datas passadas.")

    # Verifica se é feriado ou dia bloqueado
    ok, err = _validate_not_holiday(dia)
    if not ok:
        return _bad_request(err)

    # Normaliza/resolve procedimento para o CANÔNICO cadastrado, aceitando variações de caixa/acentos.
    procedimento_norm = _normalize_text(payload.get("procedimento"))
    procedimento_canon, err = _resolve_procedimento_canon(procedimento_norm)
    if err:
        return _bad_request(err)
    procedimento = procedimento_canon

    compareceu = _normalize_bool(payload.get("paciente_compareceu"))
    status_in = _normalize_status(payload.get("status")) or "AGENDADO"
    auto_status = _status_from_attendance(compareceu)
    if auto_status and status_in in {"AGENDADO", None}:
        status_in = auto_status

    ag = Agendamentos(
        dia=dia,
        hora=hora,
        cpf_paciente=_normalize_bigint(payload.get("cpf_paciente")),
        nome_paciente=_normalize_text(payload.get("nome_paciente")),
        procedimento=procedimento,
        numero_de_contato=_normalize_bigint(payload.get("numero_de_contato")),
        numero_de_protocolo=_normalize_bigint(payload.get("numero_de_protocolo")),
        status=status_in,
        observacoes=_normalize_text(payload.get("observacoes")),
        paciente_compareceu=compareceu,
    )

    try:
        db.session.add(ag)
        db.session.commit()
        return (
            jsonify({"message": "Agendamento criado", "agendamento": ag.to_dict()}),
            201,
        )
    except (DataError, IntegrityError) as exc:
        db.session.rollback()
        LOGGER.exception("Erro de validação ao criar agendamento")
        # FK/Bigint/etc: devolve mensagem controlada (sem 500)
        return _bad_request(_humanize_db_error(exc), 400)
    except Exception as exc:  # pragma: no cover
        db.session.rollback()
        LOGGER.exception("Erro inesperado ao criar agendamento")
        return jsonify({"error": str(exc)}), 500


@agendamentos_bp.route("/agendamentos/<int:agendamento_id>", methods=["PUT"])
def update_agendamento(agendamento_id: int):
    """
    Atualiza agendamento de forma parcial.

    Regras:
    - se atualizar dia, não pode ser passado nem feriado
    - se atualizar procedimento, valida FK
    - se atualizar paciente_compareceu e não vier status, autoajusta para REALIZADO/FALTOU
    - se vier status explícito válido, respeita
    """
    ag = Agendamentos.query.get(agendamento_id)
    if not ag:
        return _not_found()

    payload = request.json or {}

    if "dia" in payload and not _is_blank(payload.get("dia")):
        dia, err = _parse_date(payload.get("dia"))
        if err:
            return _bad_request(err)
        if dia < _today():
            return _bad_request("Não é possível mover agendamento para datas passadas.")
        # Verifica se é feriado ou dia bloqueado
        ok, err = _validate_not_holiday(dia)
        if not ok:
            return _bad_request(err)
        ag.dia = dia

    if "hora" in payload and not _is_blank(payload.get("hora")):
        hora, err = _parse_time(payload.get("hora"))
        if err:
            return _bad_request(err)
        ag.hora = hora

    if "cpf_paciente" in payload:
        ag.cpf_paciente = _normalize_bigint(payload.get("cpf_paciente"))

    if "nome_paciente" in payload:
        ag.nome_paciente = _normalize_text(payload.get("nome_paciente"))

    if "numero_de_contato" in payload:
        ag.numero_de_contato = _normalize_bigint(payload.get("numero_de_contato"))

    if "numero_de_protocolo" in payload:
        ag.numero_de_protocolo = _normalize_bigint(payload.get("numero_de_protocolo"))

    if "observacoes" in payload:
        ag.observacoes = _normalize_text(payload.get("observacoes"))

    if "procedimento" in payload:
        procedimento_norm = _normalize_text(payload.get("procedimento"))
        procedimento_canon, err = _resolve_procedimento_canon(procedimento_norm)
        if err:
            return _bad_request(err)
        ag.procedimento = procedimento_canon

    comparecimento_set = False
    if "paciente_compareceu" in payload:
        ag.paciente_compareceu = _normalize_bool(payload.get("paciente_compareceu"))
        comparecimento_set = True

    status_explicit = None
    if "status" in payload:
        status_explicit = _normalize_status(payload.get("status"))
        if payload.get("status") and status_explicit is None:
            return _bad_request(
                f"Status inválido. Use um de: {', '.join(sorted(STATUS_ALLOWED))}."
            )

    if status_explicit:
        ag.status = status_explicit
    elif comparecimento_set:
        auto = _status_from_attendance(ag.paciente_compareceu)
        if auto:
            ag.status = auto

    try:
        db.session.commit()
        return (
            jsonify({"message": "Agendamento atualizado", "agendamento": ag.to_dict()}),
            200,
        )
    except (DataError, IntegrityError) as exc:
        db.session.rollback()
        LOGGER.exception("Erro de validação ao atualizar agendamento")
        return _bad_request(_humanize_db_error(exc), 400)
    except Exception as exc:  # pragma: no cover
        db.session.rollback()
        LOGGER.exception("Erro inesperado ao atualizar agendamento")
        return jsonify({"error": str(exc)}), 500


@agendamentos_bp.route("/agendamentos/<int:agendamento_id>", methods=["DELETE"])
def delete_agendamento(agendamento_id: int):
    ag = Agendamentos.query.get(agendamento_id)
    if not ag:
        return _not_found()

    try:
        db.session.delete(ag)
        db.session.commit()
        return jsonify({"message": "Agendamento excluído"}), 200
    except Exception as exc:  # pragma: no cover
        db.session.rollback()
        LOGGER.exception("Erro ao excluir agendamento")
        return jsonify({"error": str(exc)}), 500


@agendamentos_bp.route("/agendamentos/verificar-data", methods=["GET"])
def check_date_availability():
    """
    Verifica se uma data está disponível para agendamento.

    Query params:
    - data: Data a verificar (YYYY-MM-DD ou 'hoje'/'amanha')

    Returns:
        JSON com status de disponibilidade
    """
    data_raw = request.args.get("data")
    if not data_raw:
        return _bad_request("Parâmetro 'data' é obrigatório.")

    dia, err = _parse_date(data_raw)
    if err:
        return _bad_request(err)

    # Verifica se é data passada
    if dia < _today():
        return (
            jsonify(
                {
                    "data": dia.isoformat(),
                    "disponivel": False,
                    "motivo": "Data no passado",
                }
            ),
            200,
        )

    # Verifica fim de semana
    is_weekend = dia.weekday() in (5, 6)
    if is_weekend:
        day_name = "Sábado" if dia.weekday() == 5 else "Domingo"
        return (
            jsonify(
                {
                    "data": dia.isoformat(),
                    "disponivel": False,
                    "motivo": f"Fim de semana ({day_name})",
                    "is_fim_de_semana": True,
                }
            ),
            200,
        )

    # Verifica feriados
    blocked, motivo = is_blocked_for_scheduling(dia)
    if blocked:
        return (
            jsonify(
                {
                    "data": dia.isoformat(),
                    "disponivel": False,
                    "motivo": f"Feriado: {motivo}",
                    "is_feriado": True,
                    "feriado_nome": motivo,
                }
            ),
            200,
        )

    return (
        jsonify(
            {
                "data": dia.isoformat(),
                "disponivel": True,
                "motivo": None,
            }
        ),
        200,
    )


@agendamentos_bp.route("/agendamentos/importar", methods=["POST"])
def import_agendamentos_csv():
    """
    Importa agendamentos via CSV (multipart/form-data):
    - campo: file

    Estratégia:
    - lê CSV (encoding robusto)
    - mapeia colunas conhecidas (ex: Protocolo, Data Agendamento, Nome, CPF, Serviço, Status, Não Compareceu)
    - upsert best-effort por (dia, hora, nome_paciente, numero_de_protocolo)
    - valida FK de procedimento; se não existir -> skip com erro claro
    """
    upsert_mode = (request.args.get("mode") or "upsert").lower().strip()
    if upsert_mode not in {"upsert"}:
        return _bad_request("Parâmetro 'mode' inválido. Use 'upsert'.")

    if "file" not in request.files:
        return _bad_request(
            "Arquivo não enviado. Envie multipart/form-data com campo 'file'."
        )

    uploaded = request.files["file"]
    filename = uploaded.filename or ""
    if not filename:
        return _bad_request("Nome de arquivo inválido.")
    if not _file_has_allowed_extension(filename):
        return _bad_request("Formato inválido. Envie um arquivo .csv")

    raw_bytes = uploaded.read()
    if not raw_bytes:
        return _bad_request("Arquivo CSV vazio.")

    try:
        text = _decode_bytes(raw_bytes)
        sample = text[:4096]
        delimiter = _guess_delimiter(sample)

        stream = BytesIO(text.encode("utf-8"))
        reader = csv.DictReader(
            (line.decode("utf-8") for line in stream.getvalue().splitlines(True)),
            delimiter=delimiter,
        )

        if not reader.fieldnames:
            return _bad_request("CSV sem cabeçalho (header).")

        header_map = {_normalize_header(h): h for h in reader.fieldnames if h}

        def get(row: dict[str, Any], *keys: str) -> Any:
            for k in keys:
                original = header_map.get(_normalize_header(k))
                if original and original in row:
                    return row.get(original)
            return None

        created = 0
        updated = 0
        skipped = 0
        errors: list[dict[str, Any]] = []

        for idx, row in enumerate(reader, start=2):  # 2 = linha após header
            try:
                protocolo_raw = get(
                    row, "Protocolo", "numero_de_protocolo", "protocolo"
                )
                data_ag_raw = get(row, "Data Agendamento", "data_agendamento", "data")
                nome_raw = get(row, "Nome", "nome", "nome_paciente", "paciente")
                cpf_raw = get(row, "CPF", "cpf", "cpf_paciente")
                servico_raw = get(row, "Serviço", "Servico", "servico", "procedimento")
                status_raw = get(row, "Status", "status")
                nao_compareceu_raw = get(
                    row, "Não Compareceu", "Nao Compareceu", "nao_compareceu"
                )

                nome_paciente = _normalize_text(nome_raw)
                if not nome_paciente:
                    skipped += 1
                    errors.append({"line": idx, "error": "Nome ausente."})
                    continue

                dia, hora, err = _parse_ddmmyyyy_hhmm(data_ag_raw)
                if err:
                    skipped += 1
                    errors.append({"line": idx, "error": err})
                    continue
                if dia is None or hora is None:
                    skipped += 1
                    errors.append({"line": idx, "error": "Data/Hora ausentes."})
                    continue

                procedimento_in = _normalize_procedimento_import(servico_raw)
                procedimento_canon, err_fk = _resolve_procedimento_canon(
                    procedimento_in
                )
                if err_fk:
                    skipped += 1
                    errors.append({"line": idx, "error": err_fk})
                    continue
                procedimento = procedimento_canon

                numero_de_protocolo = _normalize_bigint(protocolo_raw)
                cpf_paciente = _normalize_bigint(cpf_raw)

                paciente_compareceu = _parse_nao_compareceu(nao_compareceu_raw)
                mapped_status = _map_external_status(status_raw)
                status_in = _normalize_status(mapped_status) if mapped_status else None
                if not status_in:
                    auto = _status_from_attendance(paciente_compareceu)
                    status_in = auto or "AGENDADO"

                # upsert: tenta achar existente por (dia, hora, nome, protocolo)
                existing = (
                    Agendamentos.query.filter(Agendamentos.dia == dia)
                    .filter(Agendamentos.hora == hora)
                    .filter(Agendamentos.nome_paciente == nome_paciente)
                    .filter(Agendamentos.numero_de_protocolo == numero_de_protocolo)
                    .first()
                )

                if existing:
                    existing.cpf_paciente = cpf_paciente
                    existing.procedimento = procedimento
                    existing.status = status_in
                    if paciente_compareceu is not None:
                        existing.paciente_compareceu = paciente_compareceu
                    if numero_de_protocolo is not None:
                        existing.numero_de_protocolo = numero_de_protocolo
                    updated += 1
                else:
                    ag = Agendamentos(
                        dia=dia,
                        hora=hora,
                        cpf_paciente=cpf_paciente,
                        nome_paciente=nome_paciente,
                        procedimento=procedimento,
                        numero_de_contato=None,
                        numero_de_protocolo=numero_de_protocolo,
                        status=status_in,
                        observacoes=None,
                        paciente_compareceu=paciente_compareceu,
                    )
                    db.session.add(ag)
                    created += 1

            except Exception as exc:  # linha ruim não derruba o batch
                LOGGER.exception("Falha ao importar linha %s", idx)
                skipped += 1
                errors.append({"line": idx, "error": str(exc)})

        db.session.commit()
        return (
            jsonify(
                {
                    "message": "Importação concluída",
                    "created": created,
                    "updated": updated,
                    "skipped": skipped,
                    "errors": errors[:50],  # limita pra não explodir payload
                }
            ),
            200,
        )

    except (DataError, IntegrityError) as exc:
        db.session.rollback()
        LOGGER.exception("Erro de banco durante importação CSV")
        return _bad_request(_humanize_db_error(exc), 400)
    except Exception as exc:  # pragma: no cover
        db.session.rollback()
        LOGGER.exception("Erro inesperado durante importação CSV")
        return jsonify({"error": "Erro interno do servidor", "details": str(exc)}), 500


# -----------------------------
# Erros de banco "humanizados"
# -----------------------------
def _humanize_db_error(exc: Exception) -> str:
    """
    Converte erros comuns do banco em mensagens curtas e úteis.
    """
    msg = str(exc)

    # FK de procedimento
    if "ForeignKeyViolation" in msg or "violates foreign key constraint" in msg:
        if "agendamentos_procedimentos_fk" in msg or "Key (procedimento)" in msg:
            return (
                "Procedimento inválido (FK). Cadastre o procedimento na tabela 'procedimentos' "
                "antes de criar o agendamento."
            )
        return "Violação de integridade (FK). Verifique dados relacionados."

    # bigint inválido
    if "invalid input syntax for type bigint" in msg:
        return (
            "Campo numérico inválido. Verifique CPF/telefone/protocolo: "
            "envie apenas números ou deixe vazio."
        )

    return "Erro de validação no banco. Verifique os campos enviados."
