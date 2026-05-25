"""Modelo de solicitações de exames.

Armazena o histórico de solicitações de exames feitas para pacientes,
incluindo status de acompanhamento e valores.

CORREÇÃO IMPORTANTE:
    cpf_paciente agora é String(11) para consistência com Pacientes.cpf
    e preservação de zeros à esquerda.
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import ClassVar

import sqlalchemy as sa

from app.database import db
from app.src.audit import AuditableMixin


class SolicitacoesDeExames(AuditableMixin, db.Model):
    """Tabela de solicitações de exames da clínica."""

    __tablename__ = "solicitacoes_de_exames"

    # ── Status válidos ───────────────────────────────────────────────────
    STATUS_PENDENTE = "PENDENTE"
    STATUS_FATURADO = "FATURADO"
    STATUS_EXTERNO = "EXTERNO"
    STATUS_CANCELADO = "CANCELADO"
    STATUS_VALIDOS: ClassVar[set[str]] = {
        STATUS_PENDENTE,
        STATUS_FATURADO,
        STATUS_EXTERNO,
        STATUS_CANCELADO,
    }

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # ── Dados do paciente ────────────────────────────────────────────────
    # FIX: String(11) para consistência com Pacientes.cpf (preserva zeros)
    cpf_paciente: str = db.Column(
        db.String(11),
        db.ForeignKey("pacientes.cpf"),
        nullable=False,
        index=True,
    )
    nome_paciente: str = db.Column(db.String(200), nullable=False)

    # ── Data e hora da solicitação ───────────────────────────────────────
    data: date = db.Column(db.Date, nullable=False, index=True)
    hora: time = db.Column(db.Time, nullable=False)

    # ── Exames solicitados ───────────────────────────────────────────────
    exames: str = db.Column(db.Text, nullable=False)
    exames_ids: str | None = db.Column(db.String(500), nullable=True)

    # ── Valores (Numeric para precisão monetária) ────────────────────────
    soma_dos_valores: float = db.Column(
        db.Numeric(10, 2),
        nullable=False,
        default=0.0,
    )
    valor_desconto: float = db.Column(
        db.Numeric(10, 2),
        nullable=True,
        default=0.0,
    )
    valor_final: float = db.Column(db.Numeric(10, 2), nullable=True)

    # ── Status e observações ─────────────────────────────────────────────
    status: str = db.Column(
        db.String(20),
        nullable=False,
        default=STATUS_PENDENTE,
    )
    observacoes: str | None = db.Column(db.Text, nullable=True)

    # ── Médico solicitante (opcional) ────────────────────────────────────
    crm_medico: int | None = db.Column(db.BigInteger, nullable=True)
    nome_medico: str | None = db.Column(db.String(200), nullable=True)

    # ── Timestamps timezone-aware ────────────────────────────────────────
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

    # ── Relacionamento ───────────────────────────────────────────────────
    paciente = db.relationship(
        "Pacientes",
        foreign_keys=[cpf_paciente],
        backref="solicitacoes_de_exames",
        lazy=True,
    )

    def __repr__(self) -> str:
        return f"<SolicitacaoExame {self.id} - {self.nome_paciente}>"

    def to_dict(self) -> dict:
        """Serializa a solicitação para dicionário."""
        return {
            "id": self.id,
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": self.nome_paciente,
            "data": self.data.isoformat() if self.data else None,
            "hora": self.hora.strftime("%H:%M") if self.hora else None,
            "exames": self.exames,
            "exames_ids": self.exames_ids,
            "soma_dos_valores": float(self.soma_dos_valores or 0),
            "valor_desconto": float(self.valor_desconto or 0),
            "valor_final": float(
                self.valor_final
                if self.valor_final is not None
                else (self.soma_dos_valores or 0)
            ),
            "status": self.status,
            "observacoes": self.observacoes,
            "crm_medico": self.crm_medico,
            "nome_medico": self.nome_medico,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    @classmethod
    def validar_status(cls, status: str) -> bool:
        """Valida se o status é válido."""
        return status.upper() in cls.STATUS_VALIDOS
