"""
Tabela de lotes de medicamentos.

Cada lote possui:
- Código de barras (EAN-13)
- Data de validade
- Quantidade inicial e atual
- Cor de status baseada na proximidade do vencimento
- Vínculo com fornecedor

Regras de cor:
    🟢 VERDE: validade > 6 meses
    🟠 LARANJA: 3 a 6 meses
    🔴 VERMELHO: < 3 meses
    ⚫ VENCIDO: data de validade ultrapassada
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.database import db
from app.src.audit import AuditableMixin
from app.utils.timezone import get_today_sao_paulo


# Constantes de cor / faixas de validade (em dias)
COR_VERDE = "VERDE"  # > 180 dias
COR_LARANJA = "LARANJA"  # 90..180 dias
COR_VERMELHO = "VERMELHO"  # 1..89 dias
COR_VENCIDO = "VENCIDO"  # <= 0 dias

LIMITE_VERDE_DIAS = 180
LIMITE_LARANJA_DIAS = 90


def calcular_cor_validade(data_validade: date | None) -> str:
    """
    Retorna a cor do lote baseada na proximidade do vencimento.

    Args:
        data_validade: Data de validade do lote.

    Returns:
        String da cor: VERDE, LARANJA, VERMELHO ou VENCIDO.
    """
    if not data_validade:
        return COR_VERMELHO

    hoje = get_today_sao_paulo()
    dias_restantes = (data_validade - hoje).days

    if dias_restantes <= 0:
        return COR_VENCIDO
    if dias_restantes < LIMITE_LARANJA_DIAS:
        return COR_VERMELHO
    if dias_restantes < LIMITE_VERDE_DIAS:
        return COR_LARANJA
    return COR_VERDE


class MedicamentoLotes(AuditableMixin, db.Model):
    """Lotes individuais de medicamentos com rastreabilidade."""

    __tablename__ = "medicamento_lotes"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Vínculo com medicamento
    medicamento_id: int = db.Column(
        db.BigInteger,
        db.ForeignKey("medicamentos.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Identificação do lote
    numero_lote: str = db.Column(
        db.String(50),
        nullable=False,
        index=True,
        doc="Número do lote impresso na embalagem",
    )
    codigo_barras: str | None = db.Column(
        db.String(14),
        index=True,
        doc="Código de barras EAN-13 (ou EAN-14 para caixas)",
    )

    # Datas
    data_validade: date = db.Column(db.Date, nullable=False, index=True)
    data_fabricacao: date | None = db.Column(db.Date)

    # Quantidades
    quantidade_inicial: int = db.Column(
        db.Integer,
        nullable=False,
        doc="Quantidade recebida no momento da entrada",
    )
    quantidade_atual: int = db.Column(
        db.Integer,
        nullable=False,
        default=0,
        doc="Quantidade disponível atualmente",
    )

    # Valores
    preco_unitario: float | None = db.Column(
        db.Float,
        doc="Custo unitário de aquisição (R$)",
    )

    # Fornecedor
    fornecedor_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("fornecedores.id", ondelete="SET NULL"),
        index=True,
    )

    # Nota fiscal de entrada
    nota_fiscal_entrada: str | None = db.Column(db.String(50))

    # Localização física
    localizacao: str | None = db.Column(
        db.String(100),
        doc="Prateleira/gaveta/refrigerador",
    )

    # Status
    ativo: bool = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        doc="False quando lote é descartado ou totalmente consumido",
    )

    # Relacionamento
    fornecedor = db.relationship("Fornecedores", backref="lotes", lazy="joined")

    @property
    def cor_validade(self) -> str:
        """Cor do semáforo baseada na validade."""
        return calcular_cor_validade(self.data_validade)

    @property
    def dias_para_vencer(self) -> int:
        """Dias restantes até o vencimento (negativo = vencido)."""
        if not self.data_validade:
            return 0
        return (self.data_validade - get_today_sao_paulo()).days

    @property
    def vencido(self) -> bool:
        """True se lote está vencido."""
        return self.dias_para_vencer <= 0

    @property
    def disponivel(self) -> bool:
        """True se lote tem estoque e não está vencido nem inativo."""
        return self.ativo and not self.vencido and self.quantidade_atual > 0

    def to_dict(self) -> dict:
        """Serializa lote para JSON."""
        return {
            "id": self.id,
            "medicamento_id": self.medicamento_id,
            "numero_lote": self.numero_lote,
            "codigo_barras": self.codigo_barras,
            "data_validade": (
                self.data_validade.isoformat() if self.data_validade else None
            ),
            "data_validade_br": (
                self.data_validade.strftime("%d/%m/%Y") if self.data_validade else None
            ),
            "data_fabricacao": (
                self.data_fabricacao.isoformat() if self.data_fabricacao else None
            ),
            "quantidade_inicial": self.quantidade_inicial,
            "quantidade_atual": self.quantidade_atual,
            "preco_unitario": self.preco_unitario,
            "fornecedor_id": self.fornecedor_id,
            "fornecedor_nome": (self.fornecedor.nome if self.fornecedor else None),
            "nota_fiscal_entrada": self.nota_fiscal_entrada,
            "localizacao": self.localizacao,
            "ativo": self.ativo,
            # Campos calculados
            "cor_validade": self.cor_validade,
            "dias_para_vencer": self.dias_para_vencer,
            "vencido": self.vencido,
            "disponivel": self.disponivel,
            # Auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    def __repr__(self) -> str:
        return (
            f"<Lote {self.numero_lote} "
            f"med_id={self.medicamento_id} "
            f"qtd={self.quantidade_atual} "
            f"val={self.data_validade}>"
        )
