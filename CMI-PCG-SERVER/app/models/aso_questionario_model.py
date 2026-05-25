"""
Modelo de Questionário de Anamnese Ocupacional para ASO.

Armazena as respostas do questionário de saúde preenchido pelo
trabalhador via Google Forms (antes da consulta) ou diretamente
no sistema.

Suporta dois cenários:
  A) ASO já existe → aso_id preenchido, cpf_paciente redundante
  B) Form chega antes do ASO → aso_id=NULL, cpf_paciente para lookup

Estrutura JSON dos campos de perguntas:
  Cada grupo é uma lista de dicts:
    [{"texto": str, "resposta": "sim"|"nao"|null, "observacao": str}, ...]

Referências:
  - NR-7 (Portaria MTP nº 567/2022)
  - Resolução CFM nº 2.056/2013 (anamnese ocupacional)
  - CLT art. 168
  - Lei 13.146/2015 (Estatuto da Pessoa com Deficiência)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.database import db
from app.utils.timezone import get_now_sao_paulo


# ---------------------------------------------------------------------------
# Helper para construir perguntas padronizadas
# ---------------------------------------------------------------------------


def _pergunta(texto: str) -> dict[str, Any]:
    """Constrói dict padronizado de pergunta (DRY)."""
    return {"texto": texto, "resposta": None, "observacao": ""}


# ---------------------------------------------------------------------------
# Perguntas padrão por grupo (template vazio para novos questionários)
# ---------------------------------------------------------------------------

PERGUNTAS_CONDICOES_GERAIS: list[dict] = [
    _pergunta("Considera ter boa saúde atualmente?"),
    _pergunta("Alimenta-se bem / regularmente?"),
    _pergunta("Evacua normalmente?"),
    _pergunta("Urina normalmente?"),
    _pergunta("Enxerga bem?"),
    _pergunta("Ouve bem?"),
    _pergunta("Dorme bem?"),
    _pergunta("Considera-se pessoa calma?"),
]

PERGUNTAS_ANTECEDENTES: list[dict] = [
    # Lei 13.146/2015 — terminologia inclusiva
    _pergunta("É pessoa com deficiência (PcD)? Se sim, qual?"),
    _pergunta("Já realizou alguma cirurgia? Se sim, quais?"),
    _pergunta("Possui alguma alergia? Se sim, quais?"),
    _pergunta("Usa medicamentos regularmente? Se sim, quais?"),
    _pergunta("Doença mental ou transtorno psiquiátrico?"),
    _pergunta("Convulsões ou epilepsia?"),
    _pergunta("Varizes?"),
    _pergunta("Escarro com sangue (hemoptise)?"),
    _pergunta("Bronquite ou asma?"),
    _pergunta("Falta de ar (dispneia)?"),
    _pergunta("Diabetes?"),
    _pergunta("Diarreias frequentes?"),
    _pergunta("Problemas de pele (dermatoses)?"),
    _pergunta("Hérnias?"),
    _pergunta("Hemorróidas?"),
    _pergunta("Pressão alta (hipertensão)?"),
    _pergunta("Dores nas articulações / juntas?"),
    _pergunta("Dores nas costas (lombalgia)?"),
    _pergunta("Problemas cardíacos?"),
    _pergunta("Problemas renais?"),
    _pergunta("Problemas na coluna vertebral?"),
    _pergunta("Problemas de audição (zumbido, perda auditiva)?"),
    _pergunta("Problemas de visão (além de uso de óculos)?"),
    _pergunta("Doenças infecciosas ou contagiosas recentes?"),
    _pergunta("Já foi internado(a)? Se sim, motivo?"),
]

PERGUNTAS_HISTORICO_OCUPACIONAL: list[dict] = [
    _pergunta("Já sofreu acidente de trabalho? Se sim, descreva."),
    _pergunta("Apresenta limitação em função de acidente?"),
    _pergunta("Já esteve doente em razão do trabalho?"),
    _pergunta("Já recebeu auxílio-doença / acidentário (INSS)?"),
    _pergunta("Já esteve afastado por mais de 15 dias?"),
    _pergunta("Já trabalhou exposto a agentes nocivos (ruído, calor, químicos)?"),
    _pergunta("Já realizou exames periódicos em empregos anteriores?"),
]

PERGUNTAS_HABITOS: list[dict] = [
    _pergunta("Fuma ou já fumou? Se sim, há quanto tempo / frequência?"),
    _pergunta("Consome bebidas alcoólicas? Se sim, frequência?"),
    _pergunta("Usa ou já usou drogas ilícitas?"),
    _pergunta("Pratica atividade física regular?"),
]

# Seção E — exibida apenas para sexo feminino (no Forms via lógica condicional)
# Nota: pergunta sobre gravidez removida (discriminação em exame admissional,
# conforme art. 373-A CLT e Convenção OIT nº 111).
PERGUNTAS_FEMININAS: list[dict] = [
    _pergunta("Está amamentando?"),
    _pergunta("Ciclo menstrual regular?"),
    _pergunta("Número de gestações anteriores?"),
    _pergunta("Já teve aborto espontâneo?"),
    _pergunta("Última citologia oncótica (Papanicolau) — data?"),
]

PERGUNTAS_ANTECEDENTES_FAMILIARES: list[dict] = [
    _pergunta("Diabetes na família?"),
    _pergunta("Hipertensão na família?"),
    _pergunta("Doenças cardíacas na família (antes dos 50 anos)?"),
    _pergunta("Câncer na família?"),
    _pergunta("Doença mental na família?"),
    _pergunta("Outras doenças hereditárias?"),
]


def build_anamnese_template() -> dict[str, list[dict]]:
    """Retorna um template vazio da anamnese com todas as perguntas padrão."""
    return {
        "condicoes_gerais": [dict(p) for p in PERGUNTAS_CONDICOES_GERAIS],
        "antecedentes": [dict(p) for p in PERGUNTAS_ANTECEDENTES],
        "historico_ocupacional": [dict(p) for p in PERGUNTAS_HISTORICO_OCUPACIONAL],
        "habitos": [dict(p) for p in PERGUNTAS_HABITOS],
        "perguntas_femininas": [dict(p) for p in PERGUNTAS_FEMININAS],
        "antecedentes_familiares": [dict(p) for p in PERGUNTAS_ANTECEDENTES_FAMILIARES],
    }


@dataclass
class AsoQuestionario(db.Model):
    """
    Tabela de questionários de anamnese ocupacional.

    Vinculação flexível:
      - Se aso_id preenchido: vinculado diretamente ao ASO
      - Se aso_id NULL + cpf_paciente: questionário pendente (aguardando ASO)
    """

    __tablename__ = "aso_questionarios"

    # --- PK ---
    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # --- FK para ASO (NULLABLE: pode chegar antes do ASO ser criado) ---
    aso_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("solicitacoes_de_asos.id"),
        nullable=True,
        unique=True,
        index=True,
    )

    # --- CPF para lookup quando aso_id é NULL ---
    # String(11) para compatibilidade com pacientes.cpf (VARCHAR após migração)
    cpf_paciente: str | None = db.Column(
        db.String(11),
        db.ForeignKey("pacientes.cpf"),
        nullable=True,
        index=True,
    )

    # --- Status do questionário ---
    # pendente    → form recebido, aguardando ASO
    # vinculado   → vinculado a um ASO
    # completo    → médico finalizou o exame clínico
    status: str = db.Column(
        db.String(20),
        nullable=False,
        default="pendente",
    )

    # --- Respostas da anamnese (JSON estruturado por grupo) ---
    anamnese: dict = db.Column(db.JSON, nullable=False, default=build_anamnese_template)

    # --- Dados do exame clínico (preenchidos pelo médico) ---
    exame_clinico: dict = db.Column(db.JSON, default=dict)

    # --- Observações adicionais do médico ---
    observacoes_medicas: str | None = db.Column(db.Text)

    # --- Origem dos dados ---
    origem: str = db.Column(
        db.String(30),
        nullable=False,
        default="manual",
    )

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
    aso = db.relationship(
        "SolicitacoesDeAso",
        backref=db.backref("questionario", uselist=False, lazy=True),
        lazy=True,
    )
    paciente = db.relationship(
        "Pacientes",
        backref=db.backref("questionarios_aso", lazy=True),
        lazy=True,
        foreign_keys=[cpf_paciente],
    )

    def __repr__(self) -> str:
        return (
            f"<AsoQuestionario id={self.id} aso_id={self.aso_id} "
            f"cpf={self.cpf_paciente} status={self.status}>"
        )

    def vincular_aso(self, aso_id: int) -> None:
        """Vincula este questionário pendente a um ASO."""
        self.aso_id = aso_id
        self.status = "vinculado"

    def finalizar(self) -> None:
        """Marca como completo após médico finalizar exame clínico."""
        self.status = "completo"

    def to_dict(self) -> dict[str, Any]:
        """Serializa o questionário para JSON."""
        # Resolve nome do paciente via relacionamento (lazy load seguro)
        nome_paciente: str | None = None
        try:
            if self.paciente:
                nome_paciente = self.paciente.nome
            elif self.aso and self.aso.paciente:
                nome_paciente = self.aso.paciente.nome
        except Exception:
            pass

        return {
            "id": self.id,
            "aso_id": self.aso_id,
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": nome_paciente,
            "status": self.status,
            "origem": self.origem,
            "anamnese": self.anamnese or build_anamnese_template(),
            "exame_clinico": self.exame_clinico or {},
            "observacoes_medicas": self.observacoes_medicas,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
        }
