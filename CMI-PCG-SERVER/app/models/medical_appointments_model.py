"""
Model de consultas médicas.
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional

from app.database import db
from app.src.audit import AuditableMixin


class Consultas(AuditableMixin, db.Model):
    """Tabela de consultas médicas da clínica."""

    __tablename__ = "consultas"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Vínculos
    cpf_paciente: str | None = db.Column(
        db.String(11), db.ForeignKey("pacientes.cpf"), index=True
    )
    crm_medico: Optional[int] = db.Column(
        db.BigInteger, db.ForeignKey("medicos.crm"), index=True
    )

    # Data/hora
    data: date = db.Column(db.Date, nullable=False, index=True)
    hora_consulta: Optional[time] = db.Column(db.Time)

    # Tipo/Procedimento
    tipo: Optional[str] = db.Column(db.String, index=True)
    procedimentos: Optional[str] = db.Column(db.String)

    # Anamnese expandida
    anamnese: Optional[str] = db.Column(db.Text)
    queixa_principal: Optional[str] = db.Column(db.String(500))
    historia_doenca_atual: Optional[str] = db.Column(db.Text)
    exame_fisico: Optional[str] = db.Column(db.Text)

    # Diagnóstico e conduta
    diagnostico: Optional[str] = db.Column(db.String(500))
    cid: Optional[str] = db.Column(db.String(10))
    conduta: Optional[str] = db.Column(db.Text)

    # Prescrições
    houve_solicitacao_de_exame: Optional[bool] = db.Column(db.Boolean, default=False)
    houve_prescricao_medicamentos: Optional[bool] = db.Column(db.Boolean, default=False)
    medicamentos_prescrevidos: Optional[str] = db.Column(db.Text)

    # Retorno
    retorno_em: Optional[int] = db.Column(db.Integer)
    data_retorno: Optional[date] = db.Column(db.Date)

    # Observações internas
    observacoes_internas: Optional[str] = db.Column(db.Text)

    # Relacionamentos
    paciente = db.relationship(
        "Pacientes",
        foreign_keys=[cpf_paciente],
        lazy="joined",
        backref=db.backref("consultas", lazy="dynamic"),
    )
    medico = db.relationship(
        "Medicos",
        foreign_keys=[crm_medico],
        lazy="joined",
        backref=db.backref("consultas", lazy="dynamic"),
    )

    # =========================================================================
    # Helpers para dados relacionados (com fallback)
    # =========================================================================

    def _get_paciente_nome(self) -> Optional[str]:
        """Retorna nome do paciente com fallback para query direta."""
        if self.paciente and hasattr(self.paciente, "nome"):
            return self.paciente.nome

        if self.cpf_paciente:
            try:
                from app.models.patients_model import Pacientes

                pac = Pacientes.query.filter(Pacientes.cpf == self.cpf_paciente).first()
                if pac:
                    return pac.nome
            except Exception:
                pass

        return None

    def _get_paciente_data(self) -> Optional[dict]:
        """Retorna dados completos do paciente."""
        if self.paciente:
            return {
                "cpf": self.cpf_paciente,
                "nome": getattr(self.paciente, "nome", None),
                "sexo": getattr(self.paciente, "sexo", None),
                "data_nascimento": (
                    self.paciente.data_de_nascimento.isoformat()
                    if hasattr(self.paciente, "data_de_nascimento")
                    and self.paciente.data_de_nascimento
                    else None
                ),
            }

        if self.cpf_paciente:
            try:
                from app.models.patients_model import Pacientes

                pac = Pacientes.query.filter(Pacientes.cpf == self.cpf_paciente).first()
                if pac:
                    return {
                        "cpf": self.cpf_paciente,
                        "nome": pac.nome,
                        "sexo": getattr(pac, "sexo", None),
                        "data_nascimento": (
                            pac.data_de_nascimento.isoformat()
                            if hasattr(pac, "data_de_nascimento")
                            and pac.data_de_nascimento
                            else None
                        ),
                    }
            except Exception:
                pass

        return None

    def _get_medico_nome(self) -> Optional[str]:
        """Retorna nome do médico com fallback."""
        if self.medico and hasattr(self.medico, "nome"):
            return self.medico.nome

        if self.crm_medico:
            try:
                from app.models.doctors_model import Medicos

                med = Medicos.query.filter(Medicos.crm == self.crm_medico).first()
                if med:
                    return med.nome
            except Exception:
                pass

        return None

    def _get_medico_especialidade(self) -> Optional[str]:
        """Retorna especialidade do médico."""
        if self.medico and hasattr(self.medico, "especialidade"):
            return self.medico.especialidade

        if self.crm_medico:
            try:
                from app.models.doctors_model import Medicos

                med = Medicos.query.filter(Medicos.crm == self.crm_medico).first()
                if med:
                    return getattr(med, "especialidade", None)
            except Exception:
                pass

        return None

    def _get_medico_data(self) -> Optional[dict]:
        """Retorna dados completos do médico."""
        if self.medico:
            return {
                "crm": self.crm_medico,
                "nome": getattr(self.medico, "nome", None),
                "especialidade": getattr(self.medico, "especialidade", None),
            }

        if self.crm_medico:
            try:
                from app.models.doctors_model import Medicos

                med = Medicos.query.filter(Medicos.crm == self.crm_medico).first()
                if med:
                    return {
                        "crm": self.crm_medico,
                        "nome": med.nome,
                        "especialidade": getattr(med, "especialidade", None),
                    }
            except Exception:
                pass

        return None

    # =========================================================================
    # Serialização
    # =========================================================================

    def to_dict(self) -> dict:
        """Serializa consulta completa para JSON."""
        return {
            "id": self.id,
            # Paciente
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": self._get_paciente_nome(),
            "paciente": self._get_paciente_data(),
            # Médico
            "crm_medico": self.crm_medico,
            "nome_medico": self._get_medico_nome(),
            "especialidade_medico": self._get_medico_especialidade(),
            "medico": self._get_medico_data(),
            # Data/hora
            "data": self.data.isoformat() if self.data else None,
            "data_br": self.data.strftime("%d/%m/%Y") if self.data else None,
            "hora": (
                self.hora_consulta.strftime("%H:%M") if self.hora_consulta else None
            ),
            # Tipo
            "tipo": self.tipo,
            "procedimentos": self.procedimentos,
            # Anamnese
            "anamnese": self.anamnese,
            "queixa_principal": self.queixa_principal,
            "historia_doenca_atual": self.historia_doenca_atual,
            "exame_fisico": self.exame_fisico,
            # Diagnóstico
            "diagnostico": self.diagnostico,
            "cid": self.cid,
            "conduta": self.conduta,
            # Prescrições
            "houve_solicitacao_de_exame": self.houve_solicitacao_de_exame or False,
            "houve_prescricao_medicamentos": (
                self.houve_prescricao_medicamentos or False
            ),
            "medicamentos_prescrevidos": self.medicamentos_prescrevidos,
            # Retorno
            "retorno_em": self.retorno_em,
            "data_retorno": (
                self.data_retorno.isoformat() if self.data_retorno else None
            ),
            # Observações
            "observacoes_internas": self.observacoes_internas,
            # Auditoria (do AuditableMixin)
            "created_at": (self.created_at.isoformat() if self.created_at else None),
            "updated_at": (self.updated_at.isoformat() if self.updated_at else None),
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    def to_dict_resumo(self) -> dict:
        """Versão resumida para listagens."""
        return {
            "id": self.id,
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": self._get_paciente_nome(),
            "crm_medico": self.crm_medico,
            "nome_medico": self._get_medico_nome(),
            "data": self.data.isoformat() if self.data else None,
            "data_br": self.data.strftime("%d/%m/%Y") if self.data else None,
            "hora": (
                self.hora_consulta.strftime("%H:%M") if self.hora_consulta else None
            ),
            "tipo": self.tipo,
            "diagnostico": self.diagnostico,
            "anamnese_resumo": (
                self.anamnese[:200] + "..."
                if self.anamnese and len(self.anamnese) > 200
                else self.anamnese
            ),
        }

    def __repr__(self) -> str:
        return f"<Consulta id={self.id} paciente={self.cpf_paciente} data={self.data}>"
