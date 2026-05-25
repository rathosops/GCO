"""
Modelo Permission - Permissões granulares.

Cada permissão representa uma ação específica no sistema:
- pacientes.criar
- financeiro.ver
- admin.staff
- etc.

NOTA: Removido @dataclass para compatibilidade com Flask-SQLAlchemy 3.x + SQLAlchemy 2.0.
"""

from __future__ import annotations

from datetime import datetime

from app.database import db
from app.src.audit import AuditableMixin


class Permission(AuditableMixin, db.Model):
    """
    Permissões granulares do sistema.

    Formato do código: {modulo}.{acao}
    Exemplos: pacientes.criar, financeiro.ver, admin.staff
    """

    __tablename__ = "permissions"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Identificação
    code = db.Column(db.String(100), unique=True, nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.String(500))

    # Categorização
    module = db.Column(db.String(50), nullable=False, index=True)
    action = db.Column(db.String(50), nullable=False)

    # Controle
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Metadados
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Relacionamentos
    role_permissions = db.relationship(
        "RolePermission",
        back_populates="permission",
        lazy="dynamic",
    )

    staff_permissions = db.relationship(
        "StaffPermission",
        back_populates="permission",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<Permission {self.code}>"

    def to_dict(self) -> dict:
        """Converte para dicionário."""
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "module": self.module,
            "action": self.action,
            "is_active": self.is_active,
        }

    @classmethod
    def get_by_code(cls, code: str) -> "Permission | None":
        """Busca permissão por código."""
        return cls.query.filter_by(code=code).first()

    @classmethod
    def get_by_module(cls, module: str) -> list["Permission"]:
        """Busca permissões por módulo."""
        return cls.query.filter_by(module=module, is_active=True).all()

    @classmethod
    def get_all_modules(cls) -> list[str]:
        """Retorna lista de módulos únicos."""
        result = db.session.query(cls.module).distinct().order_by(cls.module).all()
        return [r[0] for r in result]