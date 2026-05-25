"""
Modelo de Solicitações de ASO (Atestado de Saúde Ocupacional).

Conforme NR-7 item 7.5.19.1, o ASO deve conter no mínimo:
  I.   Razão social e CNPJ da organização
  II.  Nome completo, CPF e função do empregado
  III. Riscos ocupacionais (perigos/fatores de risco do PGR)
  IV.  Procedimentos médicos realizados (exames complementares)
  V.   Definição de apto ou inapto para a função
  VI.  Data e número de registro profissional do médico

Referências:
  - NR-7 (Portaria MTP nº 567/2022)
  - CLT art. 168
  - Resolução CFM nº 2.297/2021
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any

from app.database import db
from app.utils.timezone import get_now_sao_paulo


# ---------------------------------------------------------------------------
# Constantes (evita magic strings no código)
# ---------------------------------------------------------------------------

TIPOS_EXAME = (
    "ADMISSIONAL",
    "PERIODICO",
    "RETORNO_AO_TRABALHO",
    "MUDANCA_DE_FUNCAO",
    "DEMISSIONAL",
)

CONCLUSOES = (
    "APTO",
    "INAPTO",
    "APTO_COM_RESTRICOES",
)


@dataclass
class SolicitacoesDeAso(db.Model):
    """Tabela de solicitações de ASO (Atestado de Saúde Ocupacional)."""

    __tablename__ = "solicitacoes_de_asos"

    # --- PK ---
    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # --- FKs (mantém BigInteger para compatibilidade com tabelas existentes) ---
    cpf_paciente: int = db.Column(
        db.BigInteger,
        db.ForeignKey("pacientes.cpf"),
        nullable=False,
        index=True,
    )
    cnpj_empresa: int = db.Column(
        db.BigInteger,
        db.ForeignKey("empresas.cnpj"),
        nullable=False,
        index=True,
    )
    crm_medico: int = db.Column(
        db.BigInteger,
        db.ForeignKey("medicos.crm"),
        nullable=False,
        index=True,
    )

    # --- Campos NR-7 obrigatórios ---
    tipo_exame: str = db.Column(
        db.String(30),
        nullable=False,
        default="ADMISSIONAL",
    )
    funcao_paciente: str = db.Column(
        db.String(200),
        nullable=False,
        default="Não informado",
    )
    setor: str | None = db.Column(db.String(200))
    conclusao: str = db.Column(
        db.String(30),
        nullable=False,
        default="APTO",
    )
    restricoes: str | None = db.Column(db.Text)

    # --- Campos JSON para dados estruturados ---
    # {fisico: str, quimico: str, biologico: str, ergonomico: str, acidente: str}
    riscos_ocupacionais: dict = db.Column(db.JSON, default=dict)
    # {exames: [str, ...]}
    exames_complementares: dict = db.Column(db.JSON, default=dict)
    # {nr7: str, nr9: str, nr15: str, nr16: str, nr17: str, nr35: str}
    normas_regulamentadoras: dict = db.Column(db.JSON, default=dict)

    # --- Campos adicionais ---
    manipulacao_alimentos: str | None = db.Column(db.String(30))
    observacoes: str | None = db.Column(db.Text)

    # --- Data/hora da emissão ---
    data: date = db.Column(db.Date, nullable=False)
    hora: time = db.Column(db.Time, nullable=False)

    # --- Auditoria ---
    created_at: datetime = db.Column(
        db.DateTime(timezone=True),
        default=get_now_sao_paulo,
        nullable=False,
    )
    updated_at: datetime = db.Column(
        db.DateTime(timezone=True),
        default=get_now_sao_paulo,
        onupdate=get_now_sao_paulo,
        nullable=False,
    )
    created_by: str | None = db.Column(db.String(100))

    # --- Relacionamentos ---
    paciente = db.relationship("Pacientes", backref="asos", lazy=True)
    empresa = db.relationship("Empresas", backref="asos", lazy=True)
    medico = db.relationship("Medicos", backref="asos", lazy=True)

    def __repr__(self) -> str:
        return (
            f"<ASO {self.id} | {self.tipo_exame} | "
            f"CPF={self.cpf_paciente} | {self.conclusao} | {self.data}>"
        )

    def to_dict(self, *, include_relations: bool = False) -> dict[str, Any]:
        """Serializa o ASO para JSON."""
        result: dict[str, Any] = {
            "id": self.id,
            "cpf_paciente": self.cpf_paciente,
            "cnpj_empresa": self.cnpj_empresa,
            "crm_medico": self.crm_medico,
            "tipo_exame": self.tipo_exame,
            "funcao_paciente": self.funcao_paciente,
            "setor": self.setor,
            "conclusao": self.conclusao,
            "restricoes": self.restricoes,
            "riscos_ocupacionais": self.riscos_ocupacionais or {},
            "exames_complementares": self.exames_complementares or {},
            "normas_regulamentadoras": self.normas_regulamentadoras or {},
            "manipulacao_alimentos": self.manipulacao_alimentos,
            "observacoes": self.observacoes,
            "data": self.data.isoformat() if self.data else None,
            "hora": self.hora.strftime("%H:%M") if self.hora else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
        }

        if include_relations:
            if self.paciente:
                result["paciente_nome"] = self.paciente.nome
            if self.empresa:
                result["empresa_nome"] = self.empresa.nome
            if self.medico:
                result["medico_nome"] = self.medico.nome
                result["medico_especialidade"] = getattr(
                    self.medico,
                    "especialidade",
                    None,
                )

        return result
