"""Modelo de exames da clínica.

Campos:
    - id: Identificador único (auto-incremento)
    - codigo: Código único interno do exame (ex: EX0001)
    - codigo_parceiro: Código do exame no sistema do parceiro/laboratório
    - nome: Nome do exame
    - tipo: Categoria/tipo do exame (LABORATORIAL, IMAGEM, etc.)
    - valor_cmi: Valor de custo CMI
    - valor_venda: Valor de venda ao cliente
    - valor_parceiro: Valor cobrado pelo parceiro/laboratório
    - ativo: Se o exame está disponível para solicitação
    - created_at / updated_at: Timestamps timezone-aware (America/Sao_Paulo)
"""

from __future__ import annotations

import sqlalchemy as sa

from app.database import db
from app.src.audit import AuditableMixin


class Exames(AuditableMixin, db.Model):
    """Tabela de exames disponíveis na clínica."""

    __tablename__ = "exames"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Códigos únicos
    codigo: str | None = db.Column(
        db.String(20),
        unique=True,
        nullable=True,
        index=True,
    )
    codigo_parceiro: str | None = db.Column(
        db.String(50),
        nullable=True,
        index=True,
    )

    # Informações básicas
    nome: str = db.Column(db.String(200), nullable=False, index=True)
    tipo: str = db.Column(db.String(100), nullable=False, index=True)

    # Valores (Numeric para precisão monetária)
    valor_cmi: float = db.Column(db.Numeric(10, 2), default=0.0, nullable=False)
    valor_venda: float = db.Column(db.Numeric(10, 2), default=0.0, nullable=False)
    valor_parceiro: float = db.Column(db.Numeric(10, 2), default=0.0, nullable=False)

    # Status
    ativo: bool = db.Column(db.Boolean, default=True, nullable=False)

    # Timestamps timezone-aware (server-side)
    created_at = db.Column(
        db.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=sa.text("now()"),
        onupdate=sa.text("now()"),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Exame {self.codigo or self.id}: {self.nome}>"

    def to_dict(self) -> dict:
        """Serializa o exame para dicionário."""
        return {
            "id": self.id,
            "codigo": self.codigo,
            "codigo_parceiro": self.codigo_parceiro,
            "nome": self.nome,
            "tipo": self.tipo,
            "valor_cmi": float(self.valor_cmi or 0),
            "valor_venda": float(self.valor_venda or 0),
            "valor_parceiro": float(self.valor_parceiro or 0),
            "ativo": self.ativo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
            "margem": self._calcular_margem(),
            "margem_percentual": self._calcular_margem_percentual(),
        }

    def _calcular_margem(self) -> float:
        """Calcula margem bruta (venda - custo)."""
        venda = float(self.valor_venda or 0)
        custo = float(self.valor_cmi or 0)
        return round(venda - custo, 2)

    def _calcular_margem_percentual(self) -> float:
        """Calcula margem percentual."""
        venda = float(self.valor_venda or 0)
        custo = float(self.valor_cmi or 0)
        if venda <= 0:
            return 0.0
        return round(((venda - custo) / venda) * 100, 2)
