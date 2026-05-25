"""
Utilitários de autenticação.

- Hash de senhas (Argon2id)
- Validação de senhas
- Helpers diversos
"""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Tuple

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from app.src.auth.constants import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    PASSWORD_REQUIRE_DIGIT,
    PASSWORD_REQUIRE_LOWERCASE,
    PASSWORD_REQUIRE_SPECIAL,
    PASSWORD_REQUIRE_UPPERCASE,
)

# Argon2id com parâmetros seguros (OWASP 2024)
_hasher = PasswordHasher(
    time_cost=3,  # Iterações
    memory_cost=65536,  # 64MB
    parallelism=4,  # Threads
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Gera hash seguro usando Argon2id."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verifica se a senha corresponde ao hash."""
    try:
        _hasher.verify(password_hash, password)
        return True
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """Verifica se o hash precisa ser atualizado."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except Exception:
        return True


def validate_password(password: str) -> Tuple[bool, list[str]]:
    """Valida força da senha."""
    errors = []

    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"Senha deve ter no mínimo {PASSWORD_MIN_LENGTH} caracteres")

    if len(password) > PASSWORD_MAX_LENGTH:
        errors.append(f"Senha deve ter no máximo {PASSWORD_MAX_LENGTH} caracteres")

    if PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        errors.append("Senha deve conter pelo menos uma letra maiúscula")

    if PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        errors.append("Senha deve conter pelo menos uma letra minúscula")

    if PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", password):
        errors.append("Senha deve conter pelo menos um número")

    if PASSWORD_REQUIRE_SPECIAL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        errors.append("Senha deve conter pelo menos um caractere especial")

    return (len(errors) == 0, errors)


def generate_temp_password(length: int = 16) -> str:
    """Gera senha temporária segura."""
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def utc_now() -> datetime:
    """Retorna datetime UTC timezone-aware (Python 3.12+)."""
    return datetime.now(timezone.utc)


# ============================================
# Validação de CPF
# ============================================


def validate_cpf(cpf: str | int) -> bool:
    """Valida CPF brasileiro."""
    cpf_str = "".join(filter(str.isdigit, str(cpf)))

    if len(cpf_str) != 11:
        return False

    if cpf_str == cpf_str[0] * 11:
        return False

    soma = sum(int(cpf_str[i]) * (10 - i) for i in range(9))
    resto = (soma * 10) % 11
    if resto == 10:
        resto = 0
    if resto != int(cpf_str[9]):
        return False

    soma = sum(int(cpf_str[i]) * (11 - i) for i in range(10))
    resto = (soma * 10) % 11
    if resto == 10:
        resto = 0
    if resto != int(cpf_str[10]):
        return False

    return True


def clean_cpf(cpf: str | int) -> int:
    """Remove formatação do CPF e retorna como inteiro."""
    return int("".join(filter(str.isdigit, str(cpf))))


def format_cpf(cpf: int | str) -> str:
    """Formata CPF: XXX.XXX.XXX-XX"""
    cpf_str = str(cpf).zfill(11)
    return f"{cpf_str[:3]}.{cpf_str[3:6]}.{cpf_str[6:9]}-{cpf_str[9:11]}"


# ============================================
# Helpers de Request
# ============================================


def get_client_ip() -> str:
    """Obtém IP real do cliente."""
    from flask import request

    headers = ["X-Forwarded-For", "X-Real-IP", "CF-Connecting-IP"]
    for header in headers:
        value = request.headers.get(header)
        if value:
            return value.split(",")[0].strip()

    return request.remote_addr or "unknown"


def get_device_info() -> str:
    """Extrai informação simplificada do dispositivo."""
    from flask import request

    user_agent = request.user_agent
    parts = []

    if user_agent.platform:
        parts.append(user_agent.platform.title())

    if user_agent.browser:
        browser = user_agent.browser.title()
        if user_agent.version:
            browser += f" {user_agent.version.split('.')[0]}"
        parts.append(browser)

    return " / ".join(parts) if parts else "Unknown Device"


# ============================================
# Sanitização
# ============================================


def sanitize_email(email: str) -> str:
    """Normaliza email (lowercase, trim)."""
    return email.lower().strip()


def only_digits(value: str | int | None) -> str:
    """Remove tudo exceto dígitos."""
    if value is None:
        return ""
    return "".join(filter(str.isdigit, str(value)))
