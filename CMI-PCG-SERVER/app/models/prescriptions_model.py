"""
Tabela de receituários médicos (cabeçalho).

Tipos de receita suportados:
    SIMPLES            → Receita branca comum (validade 30 dias)
    CONTROLE_ESPECIAL  → Medicamentos C1/C5 (validade 30 dias, 2 vias)
    ANTIMICROBIANO     → Antibióticos (validade 10 dias, 2 vias, retenção)

Status:
    ATIVA     → Receita válida, pode ser dispensada
    DISPENSADA → Todos os itens foram dispensados
    CANCELADA  → Receita cancelada pelo prescritor
    VENCIDA    → Validade expirada (automático via consulta)

Referências:
    - Portaria SVS/MS 344/1998 (controlados)
    - RDC 20/2011 (antimicrobianos)
    - RDC 1000/2025 (receituário eletrônico)
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from app.database import db
from app.src.audit import AuditableMixin


# ── Constantes ───────────────────────────────────────────────────────────

TIPOS_RECEITA = {
    "SIMPLES": {"descricao": "Receita Simples", "vias": 1, "validade_padrao": 30},
    "CONTROLE_ESPECIAL": {
        "descricao": "Receita de Controle Especial",
        "vias": 2,
        "validade_padrao": 30,
    },
    "ANTIMICROBIANO": {
        "descricao": "Receita de Antimicrobiano",
        "vias": 2,
        "validade_padrao": 10,
    },
}

STATUS_RECEITA = ("ATIVA", "DISPENSADA", "CANCELADA", "VENCIDA")

VIAS_ADMINISTRACAO = (
    "ORAL",
    "SUBLINGUAL",
    "TOPICA",
    "INTRAVENOSA",
    "INTRAMUSCULAR",
    "SUBCUTANEA",
    "RETAL",
    "NASAL",
    "OFTALMICA",
    "OTICA",
    "INALATORIA",
    "VAGINAL",
    "TRANSDÉRMICA",
    "OUTRA",
)


class Receituarios(AuditableMixin, db.Model):
    """Receituários médicos (cabeçalho da prescrição)."""

    __tablename__ = "receituarios"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # Vínculos clínicos
    consulta_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("consultas.id", ondelete="SET NULL"),
        index=True,
    )
    cpf_paciente: str = db.Column(
        db.String(11),
        db.ForeignKey("pacientes.cpf", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    crm_medico: int = db.Column(
        db.BigInteger,
        db.ForeignKey("medicos.crm", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Classificação
    tipo_receita: str = db.Column(
        db.String(25),
        nullable=False,
        default="SIMPLES",
        index=True,
    )

    # Datas
    data_prescricao: date = db.Column(db.Date, nullable=False, index=True)
    validade_dias: int = db.Column(db.Integer, nullable=False, default=30)
    data_validade: date = db.Column(db.Date, nullable=False)

    # Conteúdo
    observacoes_gerais: str | None = db.Column(db.Text)
    orientacoes_paciente: str | None = db.Column(db.Text)

    # Status
    status: str = db.Column(
        db.String(20),
        nullable=False,
        default="ATIVA",
        index=True,
    )
    motivo_cancelamento: str | None = db.Column(db.Text)

    # Vias
    numero_vias: int = db.Column(db.Integer, nullable=False, default=1)

    # ── Relacionamentos ──────────────────────────────────────────────

    paciente = db.relationship(
        "Pacientes",
        foreign_keys=[cpf_paciente],
        backref=db.backref("receituarios", lazy="dynamic"),
        lazy="joined",
    )
    medico = db.relationship(
        "Medicos",
        foreign_keys=[crm_medico],
        backref=db.backref("receituarios", lazy="dynamic"),
        lazy="joined",
    )
    consulta = db.relationship(
        "Consultas",
        foreign_keys=[consulta_id],
        backref=db.backref("receituarios", lazy="dynamic"),
        lazy="joined",
    )
    itens = db.relationship(
        "ReceituarioItens",
        backref="receituario",
        lazy="joined",
        cascade="all, delete-orphan",
        order_by="ReceituarioItens.ordem",
    )

    # ── Propriedades calculadas ──────────────────────────────────────

    @property
    def vencida(self) -> bool:
        """Receita está vencida?"""
        from app.utils.timezone import get_today_sao_paulo

        return self.data_validade < get_today_sao_paulo()

    @property
    def status_efetivo(self) -> str:
        """Status real considerando validade."""
        if self.status == "CANCELADA":
            return "CANCELADA"
        if self.vencida and self.status == "ATIVA":
            return "VENCIDA"
        return self.status

    @property
    def total_itens(self) -> int:
        """Quantidade total de itens."""
        return len(self.itens) if self.itens else 0

    @property
    def total_dispensados(self) -> int:
        """Quantidade de itens já dispensados."""
        if not self.itens:
            return 0
        return sum(1 for i in self.itens if i.dispensado)

    @property
    def tipo_descricao(self) -> str:
        """Descrição legível do tipo de receita."""
        return TIPOS_RECEITA.get(self.tipo_receita, {}).get(
            "descricao", self.tipo_receita
        )

    # ── Serialização ─────────────────────────────────────────────────

    def to_dict(self, *, include_itens: bool = True) -> dict:
        """Serializa receituário para JSON."""
        result = {
            "id": self.id,
            # Vínculos
            "consulta_id": self.consulta_id,
            "cpf_paciente": self.cpf_paciente,
            "crm_medico": self.crm_medico,
            # Paciente
            "nome_paciente": self.paciente.nome if self.paciente else None,
            # Médico
            "nome_medico": self.medico.nome if self.medico else None,
            "especialidade_medico": (
                self.medico.especialidade if self.medico else None
            ),
            # Tipo
            "tipo_receita": self.tipo_receita,
            "tipo_descricao": self.tipo_descricao,
            "numero_vias": self.numero_vias,
            # Datas
            "data_prescricao": (
                self.data_prescricao.isoformat() if self.data_prescricao else None
            ),
            "data_prescricao_br": (
                self.data_prescricao.strftime("%d/%m/%Y")
                if self.data_prescricao
                else None
            ),
            "validade_dias": self.validade_dias,
            "data_validade": (
                self.data_validade.isoformat() if self.data_validade else None
            ),
            "data_validade_br": (
                self.data_validade.strftime("%d/%m/%Y") if self.data_validade else None
            ),
            # Status
            "status": self.status,
            "status_efetivo": self.status_efetivo,
            "vencida": self.vencida,
            "motivo_cancelamento": self.motivo_cancelamento,
            # Conteúdo
            "observacoes_gerais": self.observacoes_gerais,
            "orientacoes_paciente": self.orientacoes_paciente,
            # Resumo
            "total_itens": self.total_itens,
            "total_dispensados": self.total_dispensados,
            # Auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

        if include_itens and self.itens:
            result["itens"] = [item.to_dict() for item in self.itens]

        return result

    def to_dict_resumo(self) -> dict:
        """Versão resumida para listagens."""
        return {
            "id": self.id,
            "cpf_paciente": self.cpf_paciente,
            "nome_paciente": self.paciente.nome if self.paciente else None,
            "crm_medico": self.crm_medico,
            "nome_medico": self.medico.nome if self.medico else None,
            "tipo_receita": self.tipo_receita,
            "tipo_descricao": self.tipo_descricao,
            "data_prescricao_br": (
                self.data_prescricao.strftime("%d/%m/%Y")
                if self.data_prescricao
                else None
            ),
            "status": self.status_efetivo,
            "total_itens": self.total_itens,
            "total_dispensados": self.total_dispensados,
        }

    def __repr__(self) -> str:
        return (
            f"<Receituario id={self.id} "
            f"tipo={self.tipo_receita} "
            f"paciente={self.cpf_paciente}>"
        )
