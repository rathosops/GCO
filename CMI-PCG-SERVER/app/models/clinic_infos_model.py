"""Tabela de informações da clínica"""

from app.database import db
from app.src.audit import AuditableMixin


class ClinicaInfos(AuditableMixin, db.Model):
    """Tabela de informações da clínica"""

    __tablename__ = "clinica_infos"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str | None = db.Column(db.String)
    cnpj_clinica: int = db.Column(db.BigInteger, unique=True, nullable=False)
    telefone_fixo: int | None = db.Column(db.BigInteger)
    telefone_celular: int | None = db.Column(db.BigInteger)
    endereco: str | None = db.Column(db.String)
    website: str | None = db.Column(db.String)

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "cnpj_clinica": self.cnpj_clinica,
            "telefone_fixo": self.telefone_fixo,
            "telefone_celular": self.telefone_celular,
            "endereco": self.endereco,
            "website": self.website,
            # Campos de auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    def __repr__(self):
        return f"<ClinicaInfos {self.nome} - CNPJ {self.cnpj_clinica}>"
