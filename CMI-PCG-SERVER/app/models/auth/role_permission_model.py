"""
Modelos de relacionamento N:N para permissões.

- RolePermission: Permissões associadas a perfis
- StaffPermission: Permissões individuais por usuário
CORREÇÃO: Adicionado foreign_keys explícitos para evitar AmbiguousForeignKeysError
em tabelas com múltiplos FKs para a mesma tabela pai.
"""

from __future__ import annotations

from datetime import datetime

from app.database import db
from app.src.audit import AuditableMixin


class RolePermission(AuditableMixin, db.Model):
    """
    Relacionamento N:N entre Roles e Permissions.

    Define quais permissões cada perfil possui por padrão.
    """

    __tablename__ = "role_permissions"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    role_id = db.Column(
        db.BigInteger,
        db.ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id = db.Column(
        db.BigInteger,
        db.ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Auditoria
    granted_by = db.Column(
        db.BigInteger,
        db.ForeignKey("staff.id", ondelete="SET NULL"),
    )
    granted_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Relacionamentos - especificar foreign_keys para evitar ambiguidade
    role = db.relationship(
        "Role",
        back_populates="role_permissions",
        foreign_keys=[role_id],
    )
    permission = db.relationship(
        "Permission",
        back_populates="role_permissions",
        foreign_keys=[permission_id],
    )

    # Constraint única para evitar duplicatas
    __table_args__ = (
        db.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )

    def __repr__(self) -> str:
        return f"<RolePermission role={self.role_id} perm={self.permission_id}>"


class StaffPermission(db.Model):
    """
    Permissões individuais por usuário.

    Permite ajustes finos além do perfil:
    - is_grant=True: Concede permissão adicional
    - is_grant=False: Nega permissão (override do perfil)
    """

    __tablename__ = "staff_permissions"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    staff_id = db.Column(
        db.BigInteger,
        db.ForeignKey("staff.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id = db.Column(
        db.BigInteger,
        db.ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # True = concede, False = nega (override)
    is_grant = db.Column(db.Boolean, default=True, nullable=False)

    # Auditoria
    granted_by = db.Column(
        db.BigInteger,
        db.ForeignKey("staff.id", ondelete="SET NULL"),
    )
    granted_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    reason = db.Column(db.String(500))

    # Relacionamentos - especificar foreign_keys para evitar ambiguidade
    # staff_id é o usuário que RECEBE a permissão
    # granted_by é quem CONCEDEU a permissão (auditoria)
    staff = db.relationship(
        "Staff",
        back_populates="individual_permissions",
        foreign_keys=[staff_id],  # IMPORTANTE: usar staff_id, não granted_by
    )
    permission = db.relationship(
        "Permission",
        back_populates="staff_permissions",
        foreign_keys=[permission_id],
    )

    # Constraint única
    __table_args__ = (
        db.UniqueConstraint("staff_id", "permission_id", name="uq_staff_permission"),
    )

    def __repr__(self) -> str:
        grant_type = "GRANT" if self.is_grant else "DENY"
        return f"<StaffPermission {grant_type} staff={self.staff_id} perm={self.permission_id}>"

    def to_dict(self) -> dict:
        """Converte para dicionário."""
        return {
            "id": self.id,
            "permission_code": self.permission.code if self.permission else None,
            "permission_name": self.permission.name if self.permission else None,
            "is_grant": self.is_grant,
            "granted_at": self.granted_at.isoformat() if self.granted_at else None,
            "reason": self.reason,
        }
