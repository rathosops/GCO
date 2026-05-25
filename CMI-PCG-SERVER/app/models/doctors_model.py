"""Tabela de médicos"""

from dataclasses import dataclass
from datetime import date
from app.database import db


@dataclass
class Medicos(db.Model):
    """Tabela dos médicos que trabalham na clínica"""

    __tablename__ = "medicos"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str = db.Column(db.String, nullable=False)
    data_de_nascimento: date = db.Column(db.Date, nullable=False)
    especialidade: str | None = db.Column(db.String)
    cpf: int = db.Column(db.BigInteger, unique=True, nullable=False)
    crm: int = db.Column(db.BigInteger, unique=True, nullable=False)
    sexo: str = db.Column(db.String, nullable=False)
    rqe: int | None = db.Column(db.BigInteger)

    def __repr__(self):
        return f"<Médico {self.nome} ({self.crm}) - {self.especialidade}>"
