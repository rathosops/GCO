"""
Modelo RefreshToken - Controle de sessões e refresh tokens.

Armazena informações sobre tokens de refresh ativos para:
- Gerenciamento de sessões múltiplas (dispositivos)
- Revogação de tokens
- Auditoria de acessos

NOTA: Removido @dataclass para compatibilidade com Flask-SQLAlchemy 3.x + SQLAlchemy 2.0.
"""

from __future__ import annotations

from datetime import datetime

from app.database import db
from app.src.audit import AuditableMixin


class RefreshToken(AuditableMixin, db.Model):
    """
    Controle de refresh tokens e sessões.

    Cada refresh token representa uma sessão ativa em um dispositivo.
    """

    __tablename__ = "refresh_tokens"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Identificador único do token (JWT ID)
    jti = db.Column(db.String(36), unique=True, nullable=False, index=True)

    # Usuário dono do token
    staff_id = db.Column(
        db.BigInteger,
        db.ForeignKey("staff.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Informações do dispositivo/sessão
    device_info = db.Column(db.String(500))
    user_agent = db.Column(db.String(500))
    ip_address = db.Column(db.String(45))  # IPv6 max length

    # Controle de tempo
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    expires_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
    )
    last_used_at = db.Column(db.DateTime(timezone=True))

    # Revogação
    revoked_at = db.Column(db.DateTime(timezone=True))
    revoked_by = db.Column(
        db.BigInteger,
        db.ForeignKey("staff.id", ondelete="SET NULL"),
    )
    revoke_reason = db.Column(db.String(200))

    # Relacionamento - especificar foreign_keys para evitar ambiguidade
    # staff_id é o DONO do token
    # revoked_by é quem REVOGOU (auditoria, não precisa de relationship)
    staff = db.relationship(
        "Staff",
        back_populates="refresh_tokens",
        foreign_keys=[staff_id],  # IMPORTANTE: usar staff_id, não revoked_by
    )

    def __repr__(self) -> str:
        status = "REVOKED" if self.is_revoked else "ACTIVE"
        return f"<RefreshToken {self.jti[:8]}... ({status})>"

    @property
    def is_revoked(self) -> bool:
        """Verifica se o token foi revogado."""
        return self.revoked_at is not None

    @property
    def is_expired(self) -> bool:
        """Verifica se o token expirou."""
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Verifica se o token é válido (não revogado e não expirado)."""
        return not self.is_revoked and not self.is_expired

    def revoke(self, revoked_by: int | None = None, reason: str | None = None) -> None:
        """Revoga este token."""
        self.revoked_at = datetime.utcnow()
        self.revoked_by = revoked_by
        self.revoke_reason = reason

    def update_last_used(self) -> None:
        """Atualiza timestamp de último uso."""
        self.last_used_at = datetime.utcnow()

    def to_dict(self) -> dict:
        """Converte para dicionário (sessão)."""
        return {
            "id": self.id,
            "device_info": self.device_info,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": (
                self.last_used_at.isoformat() if self.last_used_at else None
            ),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_current": False,  # Será sobrescrito no controller
        }

    @classmethod
    def get_by_jti(cls, jti: str) -> "RefreshToken | None":
        """Busca token pelo JTI."""
        return cls.query.filter_by(jti=jti).first()

    @classmethod
    def get_active_by_staff(cls, staff_id: int) -> list["RefreshToken"]:
        """Retorna tokens ativos de um usuário."""
        return (
            cls.query.filter(
                cls.staff_id == staff_id,
                cls.revoked_at.is_(None),
                cls.expires_at > datetime.utcnow(),
            )
            .order_by(cls.created_at.desc())
            .all()
        )

    @classmethod
    def revoke_all_by_staff(
        cls,
        staff_id: int,
        revoked_by: int | None = None,
        reason: str = "logout_all",
    ) -> int:
        """Revoga todos os tokens de um usuário. Retorna quantidade revogada."""
        now = datetime.utcnow()
        result = cls.query.filter(
            cls.staff_id == staff_id,
            cls.revoked_at.is_(None),
        ).update(
            {
                "revoked_at": now,
                "revoked_by": revoked_by,
                "revoke_reason": reason,
            }
        )
        db.session.commit()
        return result

    @classmethod
    def cleanup_expired(cls) -> int:
        """Remove tokens expirados há mais de 7 dias. Retorna quantidade removida."""
        from datetime import timedelta

        cutoff = datetime.utcnow() - timedelta(days=7)
        result = cls.query.filter(cls.expires_at < cutoff).delete()
        db.session.commit()
        return result