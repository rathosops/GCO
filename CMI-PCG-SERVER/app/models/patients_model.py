"""Tabela de pacientes"""

from datetime import date

from app.database import db
from app.src.audit import AuditableMixin


class Pacientes(AuditableMixin, db.Model):
    """Tabela de pacientes da clínica"""

    __tablename__ = "pacientes"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    nome: str = db.Column(db.String, nullable=False)
    cpf: str = db.Column(db.String(11), unique=True, nullable=False, index=True)
    data_de_nascimento: date = db.Column(db.Date, nullable=False)

    sexo: str | None = db.Column(db.String(1))  # 'M' ou 'F'

    numero_de_contato: int | None = db.Column(db.BigInteger)
    email: str | None = db.Column(db.String)

    vinculado_a_empresa: bool | None = db.Column(db.Boolean)
    cnpj_empresa: int | None = db.Column(db.BigInteger, db.ForeignKey("empresas.cnpj"))

    vinculado_a_convenio: bool | None = db.Column(db.Boolean)
    cnpj_convenio: int | None = db.Column(
        db.BigInteger, db.ForeignKey("convenios.cnpj")
    )

    protocolo_imesc: str | None = db.Column(db.String(40))

    # Endereço
    cep: str | None = db.Column(db.String(8))
    logradouro: str | None = db.Column(db.String)
    numero: str | None = db.Column(db.String(20))
    complemento: str | None = db.Column(db.String)
    bairro: str | None = db.Column(db.String)
    cidade: str | None = db.Column(db.String)
    uf: str | None = db.Column(db.String(2))

    # Mantém compatibilidade atual. remover depois
    endereco: str | None = db.Column(db.String)

    # Relacionamentos
    empresa = db.relationship(
        "Empresas", foreign_keys=[cnpj_empresa], backref="pacientes", lazy=True
    )
    convenio = db.relationship(
        "Convenios", foreign_keys=[cnpj_convenio], backref="pacientes", lazy=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "cpf": self.cpf,
            "data_de_nascimento": self.data_de_nascimento.strftime("%d/%m/%Y"),
            "sexo": self.sexo,
            "numero_de_contato": self.numero_de_contato,
            "email": self.email,
            "vinculado_a_empresa": self.vinculado_a_empresa,
            "cnpj_empresa": self.cnpj_empresa,
            "vinculado_a_convenio": self.vinculado_a_convenio,
            "cnpj_convenio": self.cnpj_convenio,
            "protocolo_imesc": self.protocolo_imesc,
            "cep": self.cep,
            "logradouro": self.logradouro,
            "numero": self.numero,
            "complemento": self.complemento,
            "bairro": self.bairro,
            "cidade": self.cidade,
            "uf": self.uf,
            "endereco": self.endereco,
            # Campos de auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    def __repr__(self):
        return f"<Paciente {self.nome}>"
