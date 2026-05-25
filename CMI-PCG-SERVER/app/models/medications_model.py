"""
Tabela de medicamentos (catálogo).

Dados fixos do medicamento: nome, princípio ativo, forma farmacêutica,
classificação ANVISA, estoque mínimo/máximo.

Lotes (com validade e código de barras) ficam em medication_batches_model.
"""

from __future__ import annotations

from typing import Optional

from app.database import db
from app.src.audit import AuditableMixin


# Classificações ANVISA (Portaria 344/1998)
CLASSIFICACOES_ANVISA = {
    "LIVRE": "Venda livre (sem receita)",
    "SOB_PRESCRICAO": "Sob prescrição médica (tarja vermelha)",
    "A1": "Entorpecentes - Lista A1",
    "A2": "Entorpecentes - Lista A2",
    "A3": "Psicotrópicos - Lista A3",
    "B1": "Psicotrópicos - Lista B1",
    "B2": "Psicotrópicos - Lista B2",
    "C1": "Outras substâncias sujeitas a controle especial",
    "C2": "Retinoides de uso sistêmico",
    "C3": "Imunossupressores",
    "C4": "Anti-retrovirais",
    "C5": "Anabolizantes",
}

FORMAS_FARMACEUTICAS = (
    "COMPRIMIDO",
    "CAPSULA",
    "SOLUCAO_ORAL",
    "SOLUCAO_INJETAVEL",
    "POMADA",
    "CREME",
    "GEL",
    "SUSPENSAO",
    "GOTAS",
    "SPRAY",
    "SUPOSITORIO",
    "ADESIVO",
    "PO",
    "XAROPE",
    "OUTRO",
)

UNIDADES_MEDIDA = (
    "UN",  # Unidade
    "CP",  # Comprimido
    "CAP",  # Cápsula
    "ML",  # Mililitro
    "MG",  # Miligrama
    "G",  # Grama
    "AMP",  # Ampola
    "FR",  # Frasco
    "BIS",  # Bisnaga
    "CX",  # Caixa
    "ENV",  # Envelope
)


class Medicamentos(AuditableMixin, db.Model):
    """Catálogo de medicamentos disponíveis na clínica."""

    __tablename__ = "medicamentos"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Identificação
    nome_comercial: str = db.Column(db.String(300), nullable=False, index=True)
    principio_ativo: str = db.Column(db.String(300), nullable=False, index=True)
    apresentacao: str | None = db.Column(
        db.String(300),
        doc="Ex: '500mg cx c/ 20 comprimidos'",
    )

    # Classificação
    forma_farmaceutica: str | None = db.Column(db.String(30))
    unidade_medida: str = db.Column(db.String(10), nullable=False, default="UN")
    concentracao: str | None = db.Column(
        db.String(50),
        doc="Ex: '500mg', '10mg/ml'",
    )

    # ANVISA / Regulatório
    classificacao_anvisa: str = db.Column(
        db.String(20),
        nullable=False,
        default="LIVRE",
        index=True,
        doc="Classificação Portaria 344/1998: LIVRE, SOB_PRESCRICAO, A1..C5",
    )
    registro_anvisa: str | None = db.Column(
        db.String(20),
        doc="Número de registro na ANVISA",
    )
    requer_receita_especial: bool = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        doc="True se classificação ∈ {A1,A2,A3,B1,B2,C1,C2,C3,C4,C5}",
    )

    # Fabricante
    fabricante: str | None = db.Column(db.String(200))

    # Controle de estoque
    estoque_minimo: int = db.Column(
        db.Integer,
        nullable=False,
        default=5,
        doc="Quantidade mínima antes de alerta de reposição",
    )
    estoque_maximo: int = db.Column(
        db.Integer,
        nullable=False,
        default=100,
        doc="Quantidade máxima recomendada em estoque",
    )

    # Status
    ativo: bool = db.Column(db.Boolean, nullable=False, default=True)
    observacoes: str | None = db.Column(db.Text)

    # Relacionamentos
    lotes = db.relationship(
        "MedicamentoLotes",
        backref="medicamento",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    @property
    def is_controlado(self) -> bool:
        """Retorna True se medicamento é de controle especial."""
        return self.classificacao_anvisa not in ("LIVRE", "SOB_PRESCRICAO")

    @property
    def estoque_total(self) -> int:
        """Soma quantidade disponível de todos os lotes ativos."""
        from app.models.medication_batches_model import MedicamentoLotes

        result = (
            db.session.query(
                db.func.coalesce(db.func.sum(MedicamentoLotes.quantidade_atual), 0)
            )
            .filter(
                MedicamentoLotes.medicamento_id == self.id,
                MedicamentoLotes.ativo.is_(True),
            )
            .scalar()
        )
        return int(result)

    @property
    def abaixo_minimo(self) -> bool:
        """Verifica se estoque está abaixo do mínimo."""
        return self.estoque_total < self.estoque_minimo

    def to_dict(self, *, include_estoque: bool = True) -> dict:
        """Serializa medicamento para JSON."""
        result = {
            "id": self.id,
            "nome_comercial": self.nome_comercial,
            "principio_ativo": self.principio_ativo,
            "apresentacao": self.apresentacao,
            "forma_farmaceutica": self.forma_farmaceutica,
            "unidade_medida": self.unidade_medida,
            "concentracao": self.concentracao,
            "classificacao_anvisa": self.classificacao_anvisa,
            "classificacao_anvisa_desc": CLASSIFICACOES_ANVISA.get(
                self.classificacao_anvisa, ""
            ),
            "registro_anvisa": self.registro_anvisa,
            "requer_receita_especial": self.requer_receita_especial,
            "is_controlado": self.is_controlado,
            "fabricante": self.fabricante,
            "estoque_minimo": self.estoque_minimo,
            "estoque_maximo": self.estoque_maximo,
            "ativo": self.ativo,
            "observacoes": self.observacoes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

        if include_estoque:
            total = self.estoque_total
            result["estoque_total"] = total
            result["abaixo_minimo"] = total < self.estoque_minimo
            result["acima_maximo"] = total > self.estoque_maximo

        return result

    def __repr__(self) -> str:
        return f"<Medicamento {self.nome_comercial} ({self.principio_ativo})>"
