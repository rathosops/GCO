"""Tabela de assistentes sociais."""

from dataclasses import dataclass
from datetime import date

from app.database import db


@dataclass
class AssistentesSociais(db.Model):
    """Tabela dos assistentes sociais que trabalham na clínica."""

    __tablename__ = "assistentes_sociais"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str = db.Column(db.String, nullable=False)
    data_de_nascimento: date = db.Column(db.Date, nullable=False)
    cpf: str = db.Column(db.String(11), unique=True, nullable=False, index=True)
    cress: str = db.Column(db.String(20), unique=True, nullable=False, index=True)
    sexo: str = db.Column(db.String(1), nullable=False)
    telefone: int | None = db.Column(db.BigInteger)
    email: str | None = db.Column(db.String)
    ativo: bool = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self) -> dict:
        """Serializa para JSON."""
        return {
            "id": self.id,
            "nome": self.nome,
            "data_de_nascimento": (
                self.data_de_nascimento.isoformat()
                if self.data_de_nascimento
                else None
            ),
            "data_de_nascimento_br": (
                self.data_de_nascimento.strftime("%d/%m/%Y")
                if self.data_de_nascimento
                else None
            ),
            "cpf": self.cpf,
            "cress": self.cress,
            "sexo": self.sexo,
            "telefone": self.telefone,
            "email": self.email,
            "ativo": self.ativo,
        }

    def __repr__(self) -> str:
        return f"<AssistenteSocial {self.nome} (CRESS {self.cress})>"
