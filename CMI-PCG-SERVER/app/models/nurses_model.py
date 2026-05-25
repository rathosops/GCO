"""Tabela de enfermeiros"""

from dataclasses import dataclass
from app.database import db


@dataclass
class Enfermeiros(db.Model):
    """Tabela de enfermeiros da clínica"""

    __tablename__ = "enfermeiros"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str = db.Column(db.String, nullable=False)
    cpf: int = db.Column(db.Integer, nullable=False, unique=True)

    def __repr__(self):
        return f"<Enfermeiro {self.nome} - CPF {self.cpf}>"
