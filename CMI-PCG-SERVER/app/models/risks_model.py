"""Tabela de riscos"""

from dataclasses import dataclass
from app.database import db

@dataclass
class Riscos(db.Model):
    """Tabela de riscos cadastrados na clínica"""

    __tablename__ = "riscos"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str | None = db.Column(db.String)

    def __repr__(self):
        return f"<Risco {self.nome}>"
