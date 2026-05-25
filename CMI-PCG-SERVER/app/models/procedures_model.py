"""Tabela de procedimentos"""

from dataclasses import dataclass
from app.database import db


@dataclass
class Procedimentos(db.Model):
    """Tabela de procedimentos disponíveis na clínica"""

    __tablename__ = "procedimentos"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str = db.Column(db.String, unique=True, nullable=False)

    def __repr__(self):
        return f"<Procedimento {self.nome}>"
