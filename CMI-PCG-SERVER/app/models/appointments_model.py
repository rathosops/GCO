"""Tabela de agendamentos"""

from datetime import date, time
from app.database import db
from app.src.audit import AuditableMixin


class Agendamentos(AuditableMixin, db.Model):
    """Tabela de agendamentos de pacientes"""

    __tablename__ = "agendamentos"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    dia: date = db.Column(db.Date, nullable=False)
    hora: time = db.Column(db.Time, nullable=False)

    cpf_paciente: int | None = db.Column(db.BigInteger, nullable=True)
    nome_paciente: str | None = db.Column(db.String, nullable=True)

    procedimento: str | None = db.Column(
        db.String, db.ForeignKey("procedimentos.nome"), nullable=True
    )

    numero_de_contato: int | None = db.Column(db.BigInteger, nullable=True)
    numero_de_protocolo: int | None = db.Column(db.BigInteger, nullable=True)

    status: str = db.Column(db.String, nullable=False, default="AGENDADO")
    observacoes: str | None = db.Column(db.Text, nullable=True)

    paciente_compareceu: bool | None = db.Column(db.Boolean, nullable=True)

    procedimento_rel = db.relationship(
        "Procedimentos",
        foreign_keys=[procedimento],
        backref="agendamentos",
        lazy=True,
        uselist=False,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "dia": self.dia.isoformat() if self.dia else None,
            "hora": self.hora.isoformat() if self.hora else None,
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": self.nome_paciente,
            "procedimento": self.procedimento,
            "numero_de_contato": self.numero_de_contato,
            "numero_de_protocolo": self.numero_de_protocolo,
            "status": self.status,
            "observacoes": self.observacoes,
            "paciente_compareceu": self.paciente_compareceu,
            # Campos de auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    def __repr__(self):
        return f"<Agendamento {self.nome_paciente} em {self.dia} às {self.hora}>"
