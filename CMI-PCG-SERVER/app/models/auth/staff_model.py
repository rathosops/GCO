"""
Modelo Staff - Usuários do sistema.

Tabela centralizada para todos que podem fazer login:
- Médicos, enfermeiros, atendentes, admins, etc.
- Vinculação opcional com tabelas específicas (medicos, enfermeiros, etc.)
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB

from app.database import db
from app.src.audit import AuditableMixin

if TYPE_CHECKING:
    from app.models.auth.role_model import Role


class Staff(AuditableMixin, db.Model):
    """
    Tabela de funcionários/usuários do sistema.

    Centraliza autenticação e pode vincular a tabelas específicas
    como médicos, enfermeiros, etc.
    """

    __tablename__ = "staff"

    # --- Identificação ---
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    senha_hash = db.Column(db.String(255), nullable=False)

    # --- Dados pessoais ---
    nome = db.Column(db.String(255), nullable=False)
    cpf = db.Column(db.BigInteger, unique=True, nullable=False, index=True)
    telefone = db.Column(db.String(20))

    # --- Registro profissional ---
    # Ex: "CRESS/SP 12345", "COREN-SP 54321", etc.
    registro_profissional = db.Column(db.String(50), nullable=True, index=True)

    # --- Tipo e vínculos ---
    staff_type = db.Column(
        db.String(50),
        nullable=False,
        default="outro",
        index=True,
    )

    # Vínculos opcionais com tabelas específicas
    medico_id = db.Column(
        db.BigInteger,
        db.ForeignKey("medicos.id", ondelete="SET NULL"),
        nullable=True,
    )
    enfermeiro_id = db.Column(
        db.BigInteger,
        db.ForeignKey("enfermeiros.id", ondelete="SET NULL"),
        nullable=True,
    )
    atendente_id = db.Column(
        db.BigInteger,
        db.ForeignKey("atendentes.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- Perfil de acesso ---
    role_id = db.Column(
        db.BigInteger,
        db.ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # --- Flags ---
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_master = db.Column(db.Boolean, default=False, nullable=False)

    # --- Controle de acesso ---
    last_login = db.Column(db.DateTime(timezone=True))
    login_attempts = db.Column(db.Integer, default=0, nullable=False)
    locked_until = db.Column(db.DateTime(timezone=True))

    # --- Metadados ---
    metadata_extra = db.Column(JSONB, default=dict)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    created_by = db.Column(
        db.BigInteger,
        db.ForeignKey("staff.id", ondelete="SET NULL"),
    )

    # --- Relacionamentos ---
    # Existem múltiplos caminhos FK entre staff e roles:
    # 1. Staff.role_id -> roles.id (este relationship)
    # 2. Role.created_by -> staff.id (inverso)
    role = db.relationship(
        "Role",
        back_populates="staff_members",
        lazy="joined",
        foreign_keys=[role_id],  # Especificar qual FK usar
    )

    medico = db.relationship(
        "Medicos",
        foreign_keys=[medico_id],
        backref=db.backref("staff_user", uselist=False),
        lazy="joined",
    )
    enfermeiro = db.relationship(
        "Enfermeiros",
        foreign_keys=[enfermeiro_id],
        backref=db.backref("staff_user", uselist=False),
        lazy="joined",
    )
    atendente = db.relationship(
        "Atendentes",
        foreign_keys=[atendente_id],
        backref=db.backref("staff_user", uselist=False),
        lazy="joined",
    )

    # Permissões individuais (além do perfil)
    individual_permissions = db.relationship(
        "StaffPermission",
        back_populates="staff",
        lazy="dynamic",
        cascade="all, delete-orphan",
        foreign_keys="StaffPermission.staff_id",  # Especificar FK
    )

    # Refresh tokens ativos
    refresh_tokens = db.relationship(
        "RefreshToken",
        back_populates="staff",
        lazy="dynamic",
        cascade="all, delete-orphan",
        foreign_keys="RefreshToken.staff_id",  # Especificar FK
    )

    def __repr__(self) -> str:
        return f"<Staff {self.nome} ({self.email}) - {self.staff_type}>"

    def to_dict(self, include_permissions: bool = False) -> dict:
        """Converte para dicionário (para API responses)."""
        result = {
            "id": self.id,
            "email": self.email,
            "nome": self.nome,
            "cpf": self.cpf,
            "telefone": self.telefone,
            "registro_profissional": self.registro_profissional,
            "staff_type": self.staff_type,
            "role": (
                {
                    "id": self.role.id,
                    "name": self.role.name,
                    "slug": self.role.slug,
                }
                if self.role
                else None
            ),
            "is_active": self.is_active,
            "is_master": self.is_master,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        # Adiciona dados do vínculo específico
        if self.medico:
            result["medico"] = {
                "id": self.medico.id,
                "crm": self.medico.crm,
                "especialidade": self.medico.especialidade,
            }
        if self.enfermeiro:
            result["enfermeiro"] = {
                "id": self.enfermeiro.id,
            }
        if self.atendente:
            result["atendente"] = {
                "id": self.atendente.id,
            }

        if include_permissions:
            result["permissions"] = self.get_all_permissions()

        return result

    def to_jwt_identity(self) -> dict:
        """Dados mínimos para incluir no JWT payload."""
        return {
            "id": self.id,
            "email": self.email,
            "nome": self.nome,
            "staff_type": self.staff_type,
            "role_slug": self.role.slug if self.role else None,
            "is_master": self.is_master,
            "registro_profissional": self.registro_profissional,
        }

    def get_all_permissions(self) -> list[str]:
        """Retorna todas as permissões do usuário."""
        from app.src.auth.constants import expand_permission_wildcards

        if self.is_master:
            return list(expand_permission_wildcards(["*"]))

        # Permissões do perfil
        role_permissions = set()
        if self.role:
            role_perms = [rp.permission.code for rp in self.role.role_permissions]
            role_permissions = expand_permission_wildcards(role_perms)

        granted = set()
        denied = set()

        for sp in self.individual_permissions:
            if sp.is_grant:
                granted.add(sp.permission.code)
            else:
                denied.add(sp.permission.code)

        final_permissions = (role_permissions | granted) - denied
        return sorted(final_permissions)

    def has_permission(self, permission_code: str) -> bool:
        """Verifica se usuário tem uma permissão específica."""
        if self.is_master:
            return True
        return permission_code in self.get_all_permissions()

    def has_any_permission(self, *permission_codes: str) -> bool:
        """Verifica se usuário tem pelo menos uma das permissões."""
        if self.is_master:
            return True
        user_permissions = set(self.get_all_permissions())
        return bool(user_permissions & set(permission_codes))

    def has_all_permissions(self, *permission_codes: str) -> bool:
        """Verifica se usuário tem todas as permissões."""
        if self.is_master:
            return True
        user_permissions = set(self.get_all_permissions())
        return set(permission_codes).issubset(user_permissions)

    def is_locked(self) -> bool:
        """Verifica se a conta está bloqueada por tentativas de login."""
        if not self.locked_until:
            return False
        return datetime.utcnow() < self.locked_until

    def can_manage(self, other_staff: "Staff") -> bool:
        """Verifica se este usuário pode gerenciar outro."""
        if self.is_master:
            return True

        if self.id == other_staff.id:
            return False

        if not self.role or not other_staff.role:
            return False

        return self.role.hierarchy_level > other_staff.role.hierarchy_level


@event.listens_for(Staff, "before_update")
def receive_before_update(mapper, connection, target):
    """Atualiza timestamp antes de cada update."""
    target.updated_at = datetime.utcnow()