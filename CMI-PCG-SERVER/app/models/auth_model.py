"""
Tabela de administradores (legado).
Mantido para compatibilidade com sistema antigo.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.database import db


@dataclass
class Autenticadores(db.Model):
    """Tabela de administradores da clínica (legado)."""

    __tablename__ = "autenticadores"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    usuario: str = db.Column(db.String, nullable=False, unique=True, index=True)
    senha: str = db.Column(db.String, nullable=False)
    tipo: str = db.Column(db.String, nullable=False)

    # Flag para identificar sistema legado
    _is_legacy: bool = True

    def __repr__(self):
        return f"<Autenticador {self.usuario}>"

    # =========================================
    # Interface compatível com Staff (mantida)
    # =========================================

    @property
    def email(self) -> str:
        return self.usuario

    @property
    def nome(self) -> str:
        return self.usuario

    @property
    def senha_hash(self) -> str:
        return self.senha

    @property
    def staff_type(self) -> str:
        return self.tipo

    @property
    def is_active(self) -> bool:
        return True

    @property
    def is_master(self) -> bool:
        return self.tipo == "admin"

    @property
    def role(self):
        """Legado não possui Role."""
        return None

    @property
    def login_attempts(self) -> int:
        return 0

    @login_attempts.setter
    def login_attempts(self, value: int) -> None:
        pass

    @property
    def locked_until(self):
        return None

    @locked_until.setter
    def locked_until(self, value) -> None:
        pass

    @property
    def last_login(self):
        return None

    @last_login.setter
    def last_login(self, value) -> None:
        pass

    def is_locked(self) -> bool:
        return False

    def has_permission(self, permission_code: str) -> bool:
        if self.is_master:
            return True
        return permission_code in self.get_all_permissions()

    def has_any_permission(self, *permission_codes: str) -> bool:
        if self.is_master:
            return True
        perms = set(self.get_all_permissions())
        return bool(perms & set(permission_codes))

    def has_all_permissions(self, *permission_codes: str) -> bool:
        if self.is_master:
            return True
        perms = set(self.get_all_permissions())
        return set(permission_codes).issubset(perms)

    def get_all_permissions(self) -> list[str]:
        from app.src.auth.constants import expand_permission_wildcards

        legacy_map = {
            "admin": ["*"],
            "medico": ["pacientes.*", "consultas.*", "prontuarios.*", "exames.*"],
            "atendente": [
                "pacientes.*",
                "agendamentos.*",
                "consultas.ver",
                "consultas.criar",
            ],
            "enfermeiro": [
                "pacientes.ver",
                "consultas.ver",
                "exames.ver",
                "procedimentos.*",
            ],
            "financeiro": ["financeiro.*", "pagamentos.*", "relatorios.financeiro"],
        }
        wildcards = legacy_map.get(self.tipo, [])
        return sorted(expand_permission_wildcards(wildcards))

    def to_jwt_identity(self) -> dict:
        return {
            "id": self.id,
            "email": self.usuario,
            "nome": self.usuario,
            "staff_type": self.tipo,
            "role_slug": self.tipo,
            "is_master": self.is_master,
            "is_legacy": True,
        }

    def to_dict(self, include_permissions: bool = False) -> dict:
        result = {
            "id": self.id,
            "email": self.usuario,
            "nome": self.usuario,
            "cpf": None,
            "telefone": None,
            "registro_profissional": None,
            "staff_type": self.tipo,
            "role": {"id": None, "name": self.tipo.title(), "slug": self.tipo},
            "is_active": True,
            "is_master": self.is_master,
            "is_legacy": True,
            "last_login": None,
            "created_at": None,
        }
        if include_permissions:
            result["permissions"] = self.get_all_permissions()
        return result
