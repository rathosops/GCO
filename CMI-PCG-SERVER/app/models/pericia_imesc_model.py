"""
Model de Perícias IMESC.

Fluxo:
1. Paciente chega e é cadastrado
2. Triagem com assistente social (parecer_social)
3. Avaliação médica (parecer_medico + conclusao)
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional

from app.database import db
from app.src.audit import AuditableMixin


class PericiaIMESC(AuditableMixin, db.Model):
    """Tabela de perícias IMESC."""

    __tablename__ = "pericias_imesc"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Protocolo IMESC (ex: "CLI - 12345")
    protocolo: str = db.Column(db.String(40), nullable=False, index=True)

    # Vínculos
    cpf_paciente: str = db.Column(
        db.String(11), db.ForeignKey("pacientes.cpf"), nullable=False, index=True
    )
    crm_medico: Optional[int] = db.Column(
        db.BigInteger, db.ForeignKey("medicos.crm"), index=True
    )
    cress_assistente: Optional[str] = db.Column(
        db.String(20), db.ForeignKey("assistentes_sociais.cress"), index=True
    )

    # Data/hora da perícia
    data_pericia: date = db.Column(db.Date, nullable=False, index=True)
    hora_pericia: Optional[time] = db.Column(db.Time)

    # Status do fluxo
    status: str = db.Column(
        db.String(30),
        nullable=False,
        default="aguardando_triagem",
        index=True,
    )
    # Valores: aguardando_triagem, aguardando_medico, concluido, cancelado

    # Parecer Social (assistente social)
    parecer_social: Optional[str] = db.Column(db.Text)
    data_parecer_social: Optional[datetime] = db.Column(db.DateTime(timezone=True))

    # Parecer Médico
    parecer_medico: Optional[str] = db.Column(db.Text)
    conclusao_medica: Optional[str] = db.Column(db.String(500))
    cid: Optional[str] = db.Column(db.String(10))
    data_parecer_medico: Optional[datetime] = db.Column(db.DateTime(timezone=True))

    # Observações gerais
    observacoes: Optional[str] = db.Column(db.Text)

    # Relacionamentos
    paciente = db.relationship(
        "Pacientes",
        foreign_keys=[cpf_paciente],
        lazy="joined",
        backref=db.backref("pericias_imesc", lazy="dynamic"),
    )
    medico = db.relationship(
        "Medicos",
        foreign_keys=[crm_medico],
        lazy="joined",
        backref=db.backref("pericias_imesc", lazy="dynamic"),
    )
    assistente_social = db.relationship(
        "AssistentesSociais",
        foreign_keys=[cress_assistente],
        lazy="joined",
        backref=db.backref("pericias_imesc", lazy="dynamic"),
    )

    def to_dict(self) -> dict:
        """Serializa para JSON."""
        return {
            "id": self.id,
            "protocolo": self.protocolo,
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": self.paciente.nome if self.paciente else None,
            "crm_medico": self.crm_medico,
            "nome_medico": self.medico.nome if self.medico else None,
            "cress_assistente": self.cress_assistente,
            "nome_assistente": (
                self.assistente_social.nome if self.assistente_social else None
            ),
            "data_pericia": (
                self.data_pericia.isoformat() if self.data_pericia else None
            ),
            "data_pericia_br": (
                self.data_pericia.strftime("%d/%m/%Y") if self.data_pericia else None
            ),
            "hora_pericia": (
                self.hora_pericia.strftime("%H:%M") if self.hora_pericia else None
            ),
            "status": self.status,
            "parecer_social": self.parecer_social,
            "data_parecer_social": (
                self.data_parecer_social.isoformat()
                if self.data_parecer_social
                else None
            ),
            "parecer_medico": self.parecer_medico,
            "conclusao_medica": self.conclusao_medica,
            "cid": self.cid,
            "data_parecer_medico": (
                self.data_parecer_medico.isoformat()
                if self.data_parecer_medico
                else None
            ),
            "observacoes": self.observacoes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": getattr(self, "created_by_id", None),
            "updated_by_id": getattr(self, "updated_by_id", None),
        }

    def to_dict_resumo(self) -> dict:
        """Versão resumida para listagens."""
        return {
            "id": self.id,
            "protocolo": self.protocolo,
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": self.paciente.nome if self.paciente else None,
            "data_pericia": (
                self.data_pericia.isoformat() if self.data_pericia else None
            ),
            "data_pericia_br": (
                self.data_pericia.strftime("%d/%m/%Y") if self.data_pericia else None
            ),
            "status": self.status,
            "nome_medico": self.medico.nome if self.medico else None,
            "nome_assistente": (
                self.assistente_social.nome if self.assistente_social else None
            ),
        }

    def __repr__(self) -> str:
        return f"<PericiaIMESC id={self.id} protocolo={self.protocolo} status={self.status}>"
