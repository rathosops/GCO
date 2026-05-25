"""Tabela de exames disponíveis na clínica"""

from dataclasses import dataclass
from app.database import db


@dataclass
class ExamesClinica(db.Model):
    """Tabela de exames disponíveis na clínica"""

    __tablename__ = "exames_clinica"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    exame: str | None = db.Column(db.String)

    def __repr__(self):
        return f"<Exame {self.exame}>"
