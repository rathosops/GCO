"""
Tabela de fornecedores de medicamentos.

Cadastro dos distribuidores/laboratórios que fornecem
medicamentos para o estoque da clínica.
"""

from __future__ import annotations

from app.database import db
from app.src.audit import AuditableMixin


class Fornecedores(AuditableMixin, db.Model):
    """Fornecedores de medicamentos da clínica."""

    __tablename__ = "fornecedores"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str = db.Column(db.String(200), nullable=False)
    cnpj: str = db.Column(db.String(14), unique=True, nullable=False, index=True)
    razao_social: str | None = db.Column(db.String(300))

    # Contato
    telefone: str | None = db.Column(db.String(20))
    email: str | None = db.Column(db.String(200))
    contato_responsavel: str | None = db.Column(db.String(200))

    # Endereço
    cep: str | None = db.Column(db.String(8))
    logradouro: str | None = db.Column(db.String(300))
    numero: str | None = db.Column(db.String(20))
    complemento: str | None = db.Column(db.String(200))
    bairro: str | None = db.Column(db.String(100))
    cidade: str | None = db.Column(db.String(100))
    uf: str | None = db.Column(db.String(2))

    # Status
    ativo: bool = db.Column(db.Boolean, nullable=False, default=True)
    observacoes: str | None = db.Column(db.Text)

    def to_dict(self) -> dict:
        """Serializa fornecedor para JSON."""
        return {
            "id": self.id,
            "nome": self.nome,
            "cnpj": self.cnpj,
            "razao_social": self.razao_social,
            "telefone": self.telefone,
            "email": self.email,
            "contato_responsavel": self.contato_responsavel,
            "cep": self.cep,
            "logradouro": self.logradouro,
            "numero": self.numero,
            "complemento": self.complemento,
            "bairro": self.bairro,
            "cidade": self.cidade,
            "uf": self.uf,
            "ativo": self.ativo,
            "observacoes": self.observacoes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    def __repr__(self) -> str:
        return f"<Fornecedor {self.nome} ({self.cnpj})>"
