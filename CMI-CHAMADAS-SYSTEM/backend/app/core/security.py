"""
Módulo de segurança e autenticação JWT.

Fornece funções para hash de senhas e geração/validação de tokens.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica se a senha em texto plano corresponde ao hash armazenado.

    Args:
        plain_password: Senha em texto plano.
        hashed_password: Hash da senha armazenado (bcrypt).

    Returns:
        True se a senha corresponde, False caso contrário.
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    """
    Gera hash bcrypt da senha.

    Args:
        password: Senha em texto plano.

    Returns:
        Hash bcrypt da senha como string UTF-8.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Cria token JWT de acesso.

    Args:
        data: Dados a serem codificados no token (payload).
        expires_delta: Tempo de expiração customizado. Se não for informado,
            usa `settings.access_token_expire_minutes`.

    Returns:
        Token JWT codificado como string.
    """
    to_encode = data.copy()
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """
    Decodifica e valida token JWT.

    Args:
        token: Token JWT a ser decodificado.

    Returns:
        Payload do token se válido, None caso contrário.
    """
    try:
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
    except JWTError:
        # Token inválido / expirado / malformado
        return None
