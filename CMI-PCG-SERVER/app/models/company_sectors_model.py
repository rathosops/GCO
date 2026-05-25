"""
Setores de empresa — Módulo Ocupacional.

Cada empresa pode ter N setores. Cada setor carrega riscos
ocupacionais que são herdados pelos trabalhadores alocados nele,
pré-preenchendo o ASO automaticamente.
"""

from app.database import db
from app.src.audit import AuditableMixin


class SetoresEmpresa(AuditableMixin, db.Model):
    """Setores vinculados a uma empresa."""

    __tablename__ = "empresa_setores"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    empresa_id: int = db.Column(
        db.BigInteger,
        db.ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nome: str = db.Column(db.String(200), nullable=False)
    descricao: str | None = db.Column(db.Text)

    # Riscos ocupacionais do setor (JSON livre)
    # {fisico: "Ruído", quimico: "Poeira", biologico: "", ...}
    riscos_ocupacionais: dict = db.Column(db.JSON, default=dict)

    ativo: bool = db.Column(db.Boolean, nullable=False, server_default="true")

    # ── Relacionamentos ──────────────────────────────────────────────
    empresa = db.relationship("Empresas", back_populates="setores")
    cargos = db.relationship(
        "CargosEmpresa",
        back_populates="setor",
        lazy="dynamic",
    )

    __table_args__ = (
        db.UniqueConstraint("empresa_id", "nome", name="uq_setor_empresa_nome"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "empresa_id": self.empresa_id,
            "nome": self.nome,
            "descricao": self.descricao,
            "riscos_ocupacionais": self.riscos_ocupacionais or {},
            "ativo": self.ativo,
        }

    def __repr__(self):
        return f"<Setor {self.nome} (Empresa={self.empresa_id})>"