"""
Vínculos empregatícios — Módulo Ocupacional.

Substitui o link raso paciente→cnpj_empresa por um registro
completo com: função, setor, cargo, data admissão, status,
matrícula e dados necessários para geração automática de ASO.

Um paciente pode ter múltiplos vínculos (empresas diferentes,
ou recontratação na mesma empresa).
"""

from __future__ import annotations

from datetime import date

from app.database import db
from app.src.audit import AuditableMixin


# Status possíveis do vínculo
STATUS_VINCULO = (
    "ATIVO",
    "AFASTADO",
    "FERIAS",
    "DESLIGADO",
)


class VinculosEmpregado(AuditableMixin, db.Model):
    """Vínculo entre paciente (trabalhador) e empresa."""

    __tablename__ = "vinculos_empregado"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # ── Referências ──────────────────────────────────────────────────
    paciente_id: int = db.Column(
        db.BigInteger,
        db.ForeignKey("pacientes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    empresa_id: int = db.Column(
        db.BigInteger,
        db.ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cargo_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("empresa_cargos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    setor_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("empresa_setores.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Dados do vínculo ─────────────────────────────────────────────
    matricula: str | None = db.Column(db.String(50))
    funcao: str = db.Column(db.String(200), nullable=False)
    data_admissao: date = db.Column(db.Date, nullable=False)
    data_desligamento: date | None = db.Column(db.Date)

    status: str = db.Column(
        db.String(20), nullable=False, server_default="ATIVO", index=True,
    )

    # ── Relacionamentos ──────────────────────────────────────────────
    paciente = db.relationship("Pacientes", backref="vinculos_empregado")
    empresa = db.relationship("Empresas", back_populates="vinculos")
    cargo = db.relationship("CargosEmpresa", lazy="joined")
    setor = db.relationship("SetoresEmpresa", lazy="joined")

    __table_args__ = (
        db.Index(
            "ix_vinculo_paciente_empresa_ativo",
            "paciente_id", "empresa_id", "status",
        ),
    )

    def to_dict(self, *, include_relations: bool = False):
        result = {
            "id": self.id,
            "paciente_id": self.paciente_id,
            "empresa_id": self.empresa_id,
            "cargo_id": self.cargo_id,
            "setor_id": self.setor_id,
            "matricula": self.matricula,
            "funcao": self.funcao,
            "data_admissao": (
                self.data_admissao.isoformat() if self.data_admissao else None
            ),
            "data_desligamento": (
                self.data_desligamento.isoformat()
                if self.data_desligamento else None
            ),
            "status": self.status,
        }
        if include_relations:
            if self.paciente:
                result["paciente_nome"] = self.paciente.nome
                result["paciente_cpf"] = self.paciente.cpf
            if self.empresa:
                result["empresa_nome"] = self.empresa.nome
                result["empresa_cnpj"] = self.empresa.cnpj
            if self.cargo:
                result["cargo_nome"] = self.cargo.nome
            if self.setor:
                result["setor_nome"] = self.setor.nome
        return result

    def __repr__(self):
        return (
            f"<Vinculo {self.funcao} | Pac={self.paciente_id} "
            f"| Emp={self.empresa_id} | {self.status}>"
        )