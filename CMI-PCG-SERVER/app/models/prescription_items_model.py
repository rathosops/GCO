"""
Tabela de itens do receituário médico.

Cada item representa um medicamento prescrito com posologia completa.
O item pode:
- Referenciar um medicamento do estoque (medicamento_id)
- Ser um medicamento externo (medicamento_id = NULL, nome preenchido)
- Ser marcado como amostra grátis (dispensado do estoque sem custo)
- Ser dispensado via farmácia interna (lote_id registrado)
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.database import db
from app.src.audit import AuditableMixin


class ReceituarioItens(AuditableMixin, db.Model):
    """Item individual de um receituário médico."""

    __tablename__ = "receituario_itens"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Vínculo com receituário
    receituario_id: int = db.Column(
        db.BigInteger,
        db.ForeignKey("receituarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Medicamento (nullable: pode ser externo ao estoque)
    medicamento_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("medicamentos.id", ondelete="SET NULL"),
        index=True,
    )

    # Dados da prescrição (sempre preenchidos)
    nome_medicamento: str = db.Column(db.String(300), nullable=False)
    principio_ativo: str | None = db.Column(db.String(300))
    concentracao: str | None = db.Column(db.String(100))
    forma_farmaceutica: str | None = db.Column(db.String(50))

    # Posologia
    via_administracao: str | None = db.Column(db.String(30))
    posologia: str = db.Column(
        db.Text,
        nullable=False,
        doc="Ex: 'Tomar 1 comprimido de 8 em 8 horas por 7 dias'",
    )
    quantidade: int | None = db.Column(
        db.Integer,
        doc="Quantidade total prescrita (caixas, frascos, etc.)",
    )
    unidade_quantidade: str | None = db.Column(
        db.String(20),
        doc="Unidade: CX, FR, CP, AMP...",
    )
    duracao_dias: int | None = db.Column(db.Integer)
    uso_continuo: bool = db.Column(db.Boolean, nullable=False, default=False)

    # Amostra grátis / dispensação
    is_amostra_gratis: bool = db.Column(db.Boolean, nullable=False, default=False)
    dispensado: bool = db.Column(db.Boolean, nullable=False, default=False)
    dispensado_lote_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("medicamento_lotes.id", ondelete="SET NULL"),
    )
    dispensado_quantidade: int | None = db.Column(db.Integer)
    dispensado_em: datetime | None = db.Column(db.DateTime(timezone=True))

    # Ordem no receituário
    ordem: int = db.Column(db.Integer, nullable=False, default=1)

    # Observações do item
    observacoes: str | None = db.Column(db.Text)

    # ── Relacionamentos ──────────────────────────────────────────────

    medicamento = db.relationship(
        "Medicamentos",
        foreign_keys=[medicamento_id],
        lazy="joined",
    )
    lote_dispensado = db.relationship(
        "MedicamentoLotes",
        foreign_keys=[dispensado_lote_id],
        lazy="joined",
    )

    # ── Propriedades ─────────────────────────────────────────────────

    @property
    def is_estoque_interno(self) -> bool:
        """Item referencia medicamento do estoque?"""
        return self.medicamento_id is not None

    @property
    def descricao_completa(self) -> str:
        """Descrição legível do medicamento prescrito."""
        partes = [self.nome_medicamento]
        if self.concentracao:
            partes.append(self.concentracao)
        if self.forma_farmaceutica:
            partes.append(f"({self.forma_farmaceutica})")
        return " ".join(partes)

    # ── Serialização ─────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Serializa item para JSON."""
        return {
            "id": self.id,
            "receituario_id": self.receituario_id,
            "medicamento_id": self.medicamento_id,
            "is_estoque_interno": self.is_estoque_interno,
            # Prescrição
            "nome_medicamento": self.nome_medicamento,
            "principio_ativo": self.principio_ativo,
            "concentracao": self.concentracao,
            "forma_farmaceutica": self.forma_farmaceutica,
            "descricao_completa": self.descricao_completa,
            # Posologia
            "via_administracao": self.via_administracao,
            "posologia": self.posologia,
            "quantidade": self.quantidade,
            "unidade_quantidade": self.unidade_quantidade,
            "duracao_dias": self.duracao_dias,
            "uso_continuo": self.uso_continuo,
            # Dispensação
            "is_amostra_gratis": self.is_amostra_gratis,
            "dispensado": self.dispensado,
            "dispensado_lote_id": self.dispensado_lote_id,
            "dispensado_quantidade": self.dispensado_quantidade,
            "dispensado_em": (
                self.dispensado_em.isoformat() if self.dispensado_em else None
            ),
            # Meta
            "ordem": self.ordem,
            "observacoes": self.observacoes,
            # Auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<ReceituarioItem id={self.id} " f"med={self.nome_medicamento}>"
