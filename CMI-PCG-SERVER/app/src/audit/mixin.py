"""
Mixin de auditoria para models SQLAlchemy (LEGACY-SAFE).

Adiciona campos de rastreamento automático:
- created_at: timestamp de criação
- updated_at: timestamp de última atualização
- created_by_id: ID do usuário que criou (LEGADO: Autenticadores.id)
- updated_by_id: ID do usuário que atualizou (LEGADO: Autenticadores.id)

IMPORTANTE (Rollback):
- NÃO usa ForeignKey("staff.id") para não depender do auth novo.
- Os campos continuam existindo para compatibilidade com schemas/migrations já aplicadas.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import BigInteger, DateTime
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import Mapped, mapped_column


def _utc_now() -> datetime:
    """Retorna datetime atual em UTC com timezone info."""
    return datetime.now(timezone.utc)


class AuditableMixin:
    """
    Mixin que adiciona campos de auditoria ao model.

    Campos adicionados automaticamente:
        - created_at: datetime da criação (UTC)
        - updated_at: datetime da última atualização (UTC)
        - created_by_id: (LEGADO) Autenticadores.id (nullable)
        - updated_by_id: (LEGADO) Autenticadores.id (nullable)

    Note:
        created_by_id e updated_by_id são preenchidos automaticamente
        pelos event listeners se houver usuário autenticado no contexto da request.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        nullable=False,
        doc="Data/hora de criação do registro (UTC)",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        onupdate=_utc_now,
        nullable=False,
        doc="Data/hora da última atualização (UTC)",
    )

    @declared_attr
    def created_by_id(cls) -> Mapped[Optional[int]]:
        """
        ID do usuário que criou o registro.

        LEGACY-SAFE:
        - Sem ForeignKey para staff.id.
        - Armazena Autenticadores.id.
        """
        return mapped_column(
            BigInteger,
            nullable=True,
            doc="ID do usuário que criou (LEGADO: Autenticadores.id)",
        )

    @declared_attr
    def updated_by_id(cls) -> Mapped[Optional[int]]:
        """
        ID do usuário que atualizou o registro por último.

        LEGACY-SAFE:
        - Sem ForeignKey para staff.id.
        - Armazena Autenticadores.id.
        """
        return mapped_column(
            BigInteger,
            nullable=True,
            doc="ID do usuário que atualizou (LEGADO: Autenticadores.id)",
        )
