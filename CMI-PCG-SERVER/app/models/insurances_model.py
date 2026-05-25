"""Tabela de convênios"""

from app.database import db
from app.src.audit import AuditableMixin


class Convenios(AuditableMixin, db.Model):
    """Tabela de convênios aceitos pela clínica"""

    __tablename__ = "convenios"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str | None = db.Column(db.String)
    cnpj: int = db.Column(db.BigInteger, unique=True, nullable=False)
    numero_para_contato: int | None = db.Column(db.BigInteger)
    email: str | None = db.Column(db.String)
    emite_guia: bool | None = db.Column(db.Boolean)

    def to_dict(self, include_pacientes: bool = True):
        data = {
            "id": int(self.id),
            "nome": self.nome or "",
            "cnpj": str(self.cnpj),
            "numero_para_contato": (
                str(self.numero_para_contato) if self.numero_para_contato else None
            ),
            "email": self.email or "",
            "emite_guia": self.emite_guia,
        }

        # Adicionar pacientes vinculados
        if include_pacientes and self.pacientes:
            data["pacientes"] = [{"nome": p.nome, "cpf": p.cpf} for p in self.pacientes]
        else:
            data["pacientes"] = []

        return data

    def __repr__(self):
        return f"<Convênio {self.nome}>"
