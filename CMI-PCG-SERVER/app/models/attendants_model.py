"""Tabela de atendentes"""

from dataclasses import dataclass
from app.database import db


@dataclass
class Atendentes(db.Model):
    """Tabela de atendentes da clínica"""

    __tablename__ = "atendentes"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str | None = db.Column(db.String)
    cpf: int | None = db.Column(db.BigInteger)

    def __repr__(self):
        return f"<Atendente {self.nome} - CPF {self.cpf}>"
