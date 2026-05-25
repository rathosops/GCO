"""
Validadores e formatadores reutilizáveis.

DRY: Centraliza lógica de CPF, CNPJ, strings, floats usada em múltiplos
controllers (patients, exams, exam_requests, payments, aso...).

Regra fundamental:
    CPF  → SEMPRE String(11), com zeros à esquerda preservados.
    CNPJ → SEMPRE String(14), com zeros à esquerda preservados.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
import unicodedata


# Formatos aceitos para parsing de datas (mais específico primeiro)
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y")


# ── Dígitos / strings ───────────────────────────────────────────────────


def only_digits(value: Any) -> str:
    """Extrai apenas dígitos de qualquer valor."""
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def normalize_string(value: Any) -> str | None:
    """Normaliza string: strip + coalesce vazio → None."""
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def normalize_float(value: Any) -> float | None:
    """Converte valor para float, retornando None se inválido."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_bool(value: Any) -> bool | None:
    """
    Converte valores comuns em booleano.

    Aceita bool, int (0/1) e strings ("true", "false", "sim", "não"...).
    """
    if value is None or value == "":
        return None

    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        return bool(value) if value in (0, 1) else None

    v = str(value).strip().lower()
    if v in {"true", "1", "sim", "yes"}:
        return True
    if v in {"false", "0", "nao", "não", "no"}:
        return False
    return None


# ── Datas ────────────────────────────────────────────────────────────────


def parse_date(value: Any) -> date | None:
    """Converte string de data para date. Aceita YYYY-MM-DD e DD/MM/YYYY."""
    if not value:
        return None

    s = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def calculate_age(birth_date: date) -> int:
    """Calcula idade a partir da data de nascimento."""
    today = date.today()
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


# ── CPF ──────────────────────────────────────────────────────────────────


def clean_cpf(value: Any) -> str:
    """
    Limpa CPF e retorna como string de 11 dígitos (com zfill).

    Raises:
        ValueError: Se não tiver exatamente 11 dígitos.
    """
    digits = only_digits(value)
    # zfill garante zeros à esquerda para CPFs que foram armazenados como int
    digits = digits.zfill(11)

    if len(digits) != 11:
        raise ValueError("CPF deve conter exatamente 11 dígitos")
    return digits


def format_cpf(value: Any) -> str:
    """Formata CPF para exibição: XXX.XXX.XXX-XX."""
    digits = only_digits(value)
    digits = digits.zfill(11) if digits else ""

    if len(digits) != 11:
        return digits or ""
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:11]}"


def is_valid_cpf(value: Any) -> bool:
    """Valida CPF (formato, não dígitos verificadores)."""
    try:
        clean_cpf(value)
        return True
    except ValueError:
        return False


# ── CNPJ ─────────────────────────────────────────────────────────────────


def clean_cnpj(value: Any) -> str:
    """
    Limpa CNPJ e retorna como string de 14 dígitos (com zfill).

    Raises:
        ValueError: Se não tiver exatamente 14 dígitos.
    """
    digits = only_digits(value)
    digits = digits.zfill(14)

    if len(digits) != 14:
        raise ValueError("CNPJ deve conter exatamente 14 dígitos")
    return digits


def format_cnpj(value: Any) -> str:
    """Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX."""
    digits = only_digits(value)
    digits = digits.zfill(14) if digits else ""

    if len(digits) != 14:
        return digits or ""
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}"


# ── CEP ──────────────────────────────────────────────────────────────────


def clean_cep(value: Any) -> str | None:
    """CEP → string com 8 dígitos. Retorna None se inválido."""
    if not value:
        return None
    digits = only_digits(value)
    return digits if len(digits) == 8 else None


def format_cep(value: Any) -> str | None:
    """Formata CEP: XXXXX-XXX."""
    if not value:
        return None
    digits = only_digits(value)
    if len(digits) != 8:
        return digits or None
    return f"{digits[:5]}-{digits[5:]}"


# ── Telefone ─────────────────────────────────────────────────────────────


def clean_phone(value: Any) -> str | None:
    """Telefone → string de dígitos. Retorna None se vazio."""
    digits = only_digits(value)
    return digits if digits else None


# ── Busca ────────────────────────────────────────────────────────────────


def normalize_for_search(value: Any) -> str:
    """
    Normaliza texto para busca: remove acentos, lowercase, espaços colapsados.

    Exemplos::
        "João da SILVA" → "joao da silva"
        "  MARIA  JOSÉ " → "maria jose"
        "café" → "cafe"
    """
    if not value:
        return ""
    nfd = unicodedata.normalize("NFD", str(value).strip())
    sem_acento = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return " ".join(sem_acento.lower().split())
