"""
Modelo Role - Perfis de acesso.

Define os diferentes perfis (admin, médico, atendente, etc.)
com suas permissões associadas.

NOTA: Removido @dataclass para compatibilidade com Flask-SQLAlchemy 3.x + SQLAlchemy 2.0.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import event

from app.database import db
from app.src.audit import AuditableMixin

if TYPE_CHECKING:
    from app.models.auth.staff_model import Staff


class Role(AuditableMixin, db.Model):
    """
    Perfis de acesso do sistema.

    Exemplos: master, admin, médico, enfermeiro, atendente, etc.
    """

    __tablename__ = "roles"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Identificação
    slug = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))

    # Hierarquia (maior = mais privilégios)
    hierarchy_level = db.Column(db.Integer, default=0, nullable=False)

    # Perfis do sistema não podem ser deletados
    is_system = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Metadados
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
    # CORREÇÃO: Especificar foreign_keys explicitamente para evitar ambiguidade
    # Existem múltiplos caminhos FK entre staff e roles:
    # 1. Staff.role_id -> roles.id (este relationship)
    # 2. Role.created_by -> staff.id (auditoria)
    staff_members = db.relationship(
        "Staff",
        back_populates="role",
        lazy="dynamic",
        foreign_keys="Staff.role_id",  # CORREÇÃO: Especificar qual FK usar
    )

    role_permissions = db.relationship(
        "RolePermission",
        back_populates="role",
        lazy="joined",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Role {self.name} (level={self.hierarchy_level})>"

    def to_dict(self, include_permissions: bool = False) -> dict:
        """Converte para dicionário."""
        result = {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "hierarchy_level": self.hierarchy_level,
            "is_system": self.is_system,
            "is_active": self.is_active,
            "staff_count": self.staff_members.count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        if include_permissions:
            result["permissions"] = [rp.permission.code for rp in self.role_permissions]

        return result

    def get_permissions(self) -> list[str]:
        """Retorna lista de códigos de permissão deste perfil."""
        return [rp.permission.code for rp in self.role_permissions]

    def has_permission(self, permission_code: str) -> bool:
        """Verifica se este perfil tem uma permissão."""
        return permission_code in self.get_permissions()

    def can_manage(self, other_role: "Role") -> bool:
        """Verifica se este perfil pode gerenciar outro."""
        return self.hierarchy_level > other_role.hierarchy_level


@event.listens_for(Role, "before_update")
def receive_before_update(mapper, connection, target):
    """Atualiza timestamp antes de cada update."""
    target.updated_at = datetime.utcnow()