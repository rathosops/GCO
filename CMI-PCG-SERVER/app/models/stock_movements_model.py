"""
Tabela de movimentações de estoque.

Log imutável de toda entrada, saída, ajuste, dispensação e descarte.
Cada movimentação altera a quantidade_atual do lote correspondente.

Tipos de movimentação:
    ENTRADA     → Recebimento de fornecedor
    SAIDA       → Saída genérica
    DISPENSACAO → Dispensação a paciente (com CPF e consulta opcional)
    AJUSTE_POS  → Ajuste positivo (inventário/correção)
    AJUSTE_NEG  → Ajuste negativo (inventário/correção)
    DESCARTE    → Descarte por validade/avaria
    TRANSFERENCIA → Transferência entre locais
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from app.database import db
from app.src.audit import AuditableMixin


TIPOS_MOVIMENTACAO = (
    "ENTRADA",
    "SAIDA",
    "DISPENSACAO",
    "AJUSTE_POS",
    "AJUSTE_NEG",
    "DESCARTE",
    "TRANSFERENCIA",
)

# Tipos que incrementam estoque
TIPOS_ENTRADA = frozenset({"ENTRADA", "AJUSTE_POS"})
# Tipos que decrementam estoque
TIPOS_SAIDA = frozenset(
    {"SAIDA", "DISPENSACAO", "AJUSTE_NEG", "DESCARTE", "TRANSFERENCIA"}
)

MOTIVOS_DESCARTE = (
    "VENCIDO",
    "AVARIADO",
    "CONTAMINADO",
    "RECALL",
    "OUTRO",
)


class MovimentacoesEstoque(AuditableMixin, db.Model):
    """Log imutável de movimentações de estoque."""

    __tablename__ = "movimentacoes_estoque"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Vínculo com lote
    lote_id: int = db.Column(
        db.BigInteger,
        db.ForeignKey("medicamento_lotes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Tipo e quantidade
    tipo: str = db.Column(
        db.String(20),
        nullable=False,
        index=True,
        doc="ENTRADA, SAIDA, DISPENSACAO, AJUSTE_POS, AJUSTE_NEG, DESCARTE, TRANSFERENCIA",
    )
    quantidade: int = db.Column(
        db.Integer,
        nullable=False,
        doc="Sempre positivo; a direção é definida pelo tipo",
    )

    # Saldo após movimentação (snapshot)
    saldo_anterior: int = db.Column(
        db.Integer,
        nullable=False,
        doc="Quantidade do lote ANTES desta movimentação",
    )
    saldo_posterior: int = db.Column(
        db.Integer,
        nullable=False,
        doc="Quantidade do lote APÓS esta movimentação",
    )

    # Data da movimentação
    data_movimentacao: date = db.Column(db.Date, nullable=False, index=True)

    # Dispensação (quando tipo == DISPENSACAO)
    cpf_paciente: str | None = db.Column(
        db.String(11),
        db.ForeignKey("pacientes.cpf", ondelete="SET NULL"),
        index=True,
        doc="CPF do paciente (dispensação)",
    )
    consulta_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("consultas.id", ondelete="SET NULL"),
        doc="Consulta vinculada (opcional)",
    )
    crm_medico_prescritor: int | None = db.Column(
        db.BigInteger,
        doc="CRM do médico que prescreveu (dispensação controlados)",
    )

    # Fornecedor (quando tipo == ENTRADA)
    fornecedor_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("fornecedores.id", ondelete="SET NULL"),
    )
    nota_fiscal: str | None = db.Column(db.String(50))

    # Descarte (quando tipo == DESCARTE)
    motivo_descarte: str | None = db.Column(
        db.String(20),
        doc="VENCIDO, AVARIADO, CONTAMINADO, RECALL, OUTRO",
    )

    # Observações livres
    observacoes: str | None = db.Column(db.Text)

    # Relacionamentos
    lote = db.relationship("MedicamentoLotes", backref="movimentacoes", lazy="joined")
    paciente = db.relationship("Pacientes", backref="dispensacoes", lazy="joined")
    consulta = db.relationship("Consultas", backref="dispensacoes", lazy="joined")
    fornecedor = db.relationship("Fornecedores", backref="movimentacoes", lazy="joined")

    def to_dict(self) -> dict:
        """Serializa movimentação para JSON."""
        # Nome do medicamento via lote
        med_nome = None
        med_id = None
        numero_lote = None
        if self.lote:
            numero_lote = self.lote.numero_lote
            med_id = self.lote.medicamento_id
            if self.lote.medicamento:
                med_nome = self.lote.medicamento.nome_comercial

        return {
            "id": self.id,
            "lote_id": self.lote_id,
            "numero_lote": numero_lote,
            "medicamento_id": med_id,
            "medicamento_nome": med_nome,
            "tipo": self.tipo,
            "quantidade": self.quantidade,
            "saldo_anterior": self.saldo_anterior,
            "saldo_posterior": self.saldo_posterior,
            "data_movimentacao": (
                self.data_movimentacao.isoformat() if self.data_movimentacao else None
            ),
            "data_movimentacao_br": (
                self.data_movimentacao.strftime("%d/%m/%Y")
                if self.data_movimentacao
                else None
            ),
            # Dispensação
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": (self.paciente.nome if self.paciente else None),
            "consulta_id": self.consulta_id,
            "crm_medico_prescritor": self.crm_medico_prescritor,
            # Entrada
            "fornecedor_id": self.fornecedor_id,
            "fornecedor_nome": (self.fornecedor.nome if self.fornecedor else None),
            "nota_fiscal": self.nota_fiscal,
            # Descarte
            "motivo_descarte": self.motivo_descarte,
            # Geral
            "observacoes": self.observacoes,
            # Auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by_id": self.created_by_id,
        }

    def __repr__(self) -> str:
        return (
            f"<Movimentacao {self.tipo} "
            f"lote={self.lote_id} "
            f"qtd={self.quantidade}>"
        )
