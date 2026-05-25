"""Create the initial administrator user from environment variables."""

import os
import sys

from sqlalchemy.exc import SQLAlchemyError

from app import models as _models  # noqa: F401
from app.core.database import SessionLocal
from app.modules.auth.exceptions import UserAlreadyExistsError
from app.modules.auth.models import UserRole
from app.modules.auth.schemas import CreateUserCommand
from app.modules.auth.service import AuthService

USERNAME_ENV = "GCO_ADMIN_USERNAME"
DISPLAY_NAME_ENV = "GCO_ADMIN_DISPLAY_NAME"
PASSWORD_ENV = "GCO_ADMIN_PASSWORD"


def main() -> int:
    """Create an administrator user without embedding default credentials."""

    username = os.getenv(USERNAME_ENV, "admin").strip()
    display_name = os.getenv(DISPLAY_NAME_ENV, "Administrador").strip()
    password = os.getenv(PASSWORD_ENV)

    if not password:
        print(f"Erro: defina {PASSWORD_ENV} com a senha inicial.", file=sys.stderr)
        return 2

    command = CreateUserCommand(
        username=username,
        display_name=display_name,
        password=password,
        role=UserRole.ADMIN,
    )

    try:
        with SessionLocal() as session:
            user = AuthService(session).create_user(command)
    except UserAlreadyExistsError:
        print(f"Usuario '{username}' ja existe.", file=sys.stderr)
        return 1
    except SQLAlchemyError as exc:
        print(f"Erro ao criar usuario: {exc}", file=sys.stderr)
        return 1

    print(f"Usuario admin criado: {user.username}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
