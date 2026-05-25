"""
Cargos/Funções de empresa — Módulo Ocupacional.

Cada cargo define:
- Exames obrigatórios (admissional, periódico, etc.)
- NRs aplicáveis
- Riscos específicos do cargo (herdados do setor + adicionais)
- Periodicidade dos exames

Esses dados pré-preenchem o ASO automaticamente quando
o trabalhador é selecionado.
"""

from app.database import db
from app.src.audit import AuditableMixin


class CargosEmpresa(AuditableMixin, db.Model):
    """Cargos/funções vinculados a uma empresa e opcionalmente a um setor."""

    __tablename__ = "empresa_cargos"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    empresa_id: int = db.Column(
        db.BigInteger,
        db.ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    setor_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("empresa_setores.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    nome: str = db.Column(db.String(200), nullable=False)
    cbo: str | None = db.Column(db.String(10))  # Classificação Brasileira de Ocupações
    descricao: str | None = db.Column(db.Text)

    # Riscos específicos do cargo (complementa riscos do setor)
    # {fisico: "Ruído acima de 85dB", quimico: "", ...}
    riscos_ocupacionais: dict = db.Column(db.JSON, default=dict)

    # Exames obrigatórios por tipo de ASO
    # {admissional: ["hemograma", "audiometria"], periodico: [...], ...}
    exames_obrigatorios: dict = db.Column(db.JSON, default=dict)

    # NRs aplicáveis ao cargo
    # {nr7: true, nr9: true, nr15: false, nr17: true, nr35: false}
    nrs_aplicaveis: dict = db.Column(db.JSON, default=dict)

    # Periodicidade do exame periódico (em meses)
    periodicidade_meses: int = db.Column(
        db.SmallInteger,
        nullable=False,
        server_default="12",
    )

    # Manipula alimentos (NR-36 / PCMSO)
    manipula_alimentos: bool = db.Column(
        db.Boolean,
        nullable=False,
        server_default="false",
    )

    ativo: bool = db.Column(db.Boolean, nullable=False, server_default="true")

    # ── Relacionamentos ──────────────────────────────────────────────
    empresa = db.relationship("Empresas", back_populates="cargos")
    setor = db.relationship("SetoresEmpresa", back_populates="cargos")

    __table_args__ = (
        db.UniqueConstraint(
            "empresa_id",
            "nome",
            name="uq_cargo_empresa_nome",
        ),
    )

    def to_dict(self, *, include_setor: bool = False):
        result = {
            "id": self.id,
            "empresa_id": self.empresa_id,
            "setor_id": self.setor_id,
            "nome": self.nome,
            "cbo": self.cbo,
            "descricao": self.descricao,
            "riscos_ocupacionais": self.riscos_ocupacionais or {},
            "exames_obrigatorios": self.exames_obrigatorios or {},
            "nrs_aplicaveis": self.nrs_aplicaveis or {},
            "periodicidade_meses": self.periodicidade_meses,
            "manipula_alimentos": self.manipula_alimentos,
            "ativo": self.ativo,
        }
        if include_setor and self.setor:
            result["setor"] = self.setor.to_dict()
        return result

    def get_riscos_completos(self) -> dict:
        """Retorna riscos do cargo + riscos herdados do setor (merge)."""
        riscos = dict(self.setor.riscos_ocupacionais or {}) if self.setor else {}
        for chave, valor in (self.riscos_ocupacionais or {}).items():
            if valor:  # Só sobrescreve se cargo tem valor preenchido
                riscos[chave] = valor
        return riscos

    def __repr__(self):
        return f"<Cargo {self.nome} (Empresa={self.empresa_id})>"
