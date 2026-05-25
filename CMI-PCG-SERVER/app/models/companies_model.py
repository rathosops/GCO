"""
Tabela de empresas — Módulo Ocupacional.

Campos para atender NR-4, NR-7 e NR-9:
- CNAE e grau de risco (classificação NR-4)
- Razão social vs nome fantasia
- Endereço completo (para cabeçalho de ASO/PCMSO)
- Contato do RH (para convocações de periódicos)
- Status ativo/inativo
- Faturamento posterior (cobrança consolidada mensal)
"""

from app.database import db
from app.src.audit import AuditableMixin


class Empresas(AuditableMixin, db.Model):
    """Tabela de empresas conveniadas com a clínica."""

    __tablename__ = "empresas"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # ── Identificação ────────────────────────────────────────────────
    cnpj: int = db.Column(db.BigInteger, unique=True, nullable=False)
    razao_social: str = db.Column(db.String(300), nullable=False)
    nome: str = db.Column(db.String(300), nullable=False)  # nome fantasia

    # ── Classificação ocupacional (NR-4) ─────────────────────────────
    cnae: str | None = db.Column(db.String(10), index=True)
    cnae_descricao: str | None = db.Column(db.String(300))
    grau_risco: int | None = db.Column(db.SmallInteger)  # 1 a 4

    # ── Endereço ─────────────────────────────────────────────────────
    cep: str | None = db.Column(db.String(8))
    logradouro: str | None = db.Column(db.String(300))
    numero: str | None = db.Column(db.String(20))
    complemento: str | None = db.Column(db.String(100))
    bairro: str | None = db.Column(db.String(100))
    cidade: str | None = db.Column(db.String(100))
    uf: str | None = db.Column(db.String(2))

    # ── Contato geral ────────────────────────────────────────────────
    numero_para_contato: int | None = db.Column(db.BigInteger)
    email: str | None = db.Column(db.String(200))

    # ── Contato RH (convocações de periódicos) ───────────────────────
    contato_rh_nome: str | None = db.Column(db.String(200))
    contato_rh_telefone: int | None = db.Column(db.BigInteger)
    contato_rh_email: str | None = db.Column(db.String(200))

    # ── Fiscal ───────────────────────────────────────────────────────
    inscricao_estadual: str | None = db.Column(db.String(20))
    inscricao_municipal: str | None = db.Column(db.String(20))

    # ── Status ───────────────────────────────────────────────────────
    ativo: bool = db.Column(db.Boolean, nullable=False, server_default="true")

    # ── Observações ──────────────────────────────────────────────────
    observacoes: str | None = db.Column(db.Text)

    # ── Faturamento posterior (cobrança consolidada mensal) ──────────
    faturamento_posterior: bool = db.Column(
        db.Boolean,
        nullable=False,
        server_default="false",
        doc="Empresa com cobrança consolidada: atendimento gratuito + fatura mensal.",
    )
    dia_faturamento: int | None = db.Column(
        db.SmallInteger,
        doc="Dia do mês para corte/cobrança (1-31). NULL = sem dia fixo.",
    )
    valor_por_consulta: float | None = db.Column(
        db.Float,
        doc="Valor unitário cobrado por consulta realizada.",
    )
    valor_por_aso: float | None = db.Column(
        db.Float,
        doc="Mantido por compatibilidade. Ignorado quando aso_embutido_na_consulta=True.",
    )
    aso_embutido_na_consulta: bool = db.Column(
        db.Boolean,
        nullable=False,
        server_default="true",
        doc="ASO incluso no valor_por_consulta. Default True — reavaliado futuramente.",
    )
    observacoes_faturamento: str | None = db.Column(
        db.Text,
        doc="Observações sobre o acordo de faturamento com a empresa.",
    )

    # ── Relacionamentos ──────────────────────────────────────────────
    setores = db.relationship(
        "SetoresEmpresa",
        back_populates="empresa",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    cargos = db.relationship(
        "CargosEmpresa",
        back_populates="empresa",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    vinculos = db.relationship(
        "VinculosEmpregado",
        back_populates="empresa",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self, *, include_pacientes: bool = False, compact: bool = False):
        """Serializa empresa."""
        if compact:
            return {
                "id": self.id,
                "cnpj": self.cnpj,
                "nome": self.nome,
                "razao_social": self.razao_social,
                "ativo": self.ativo,
                "faturamento_posterior": self.faturamento_posterior or False,
            }

        result = {
            "id": self.id,
            "cnpj": self.cnpj,
            "razao_social": self.razao_social,
            "nome": self.nome,
            "cnae": self.cnae,
            "cnae_descricao": self.cnae_descricao,
            "grau_risco": self.grau_risco,
            "cep": self.cep,
            "logradouro": self.logradouro,
            "numero": self.numero,
            "complemento": self.complemento,
            "bairro": self.bairro,
            "cidade": self.cidade,
            "uf": self.uf,
            "numero_para_contato": self.numero_para_contato,
            "email": self.email,
            "contato_rh_nome": self.contato_rh_nome,
            "contato_rh_telefone": self.contato_rh_telefone,
            "contato_rh_email": self.contato_rh_email,
            "inscricao_estadual": self.inscricao_estadual,
            "inscricao_municipal": self.inscricao_municipal,
            "ativo": self.ativo,
            "observacoes": self.observacoes,
            # Faturamento posterior
            "faturamento_posterior": self.faturamento_posterior or False,
            "dia_faturamento": self.dia_faturamento,
            "valor_por_consulta": self.valor_por_consulta,
            "valor_por_aso": self.valor_por_aso,
            "aso_embutido_na_consulta": self.aso_embutido_na_consulta,
            "observacoes_faturamento": self.observacoes_faturamento,
            # Auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

        if include_pacientes:
            result["pacientes"] = [
                {
                    "id": p.id,
                    "nome": p.nome,
                    "cpf": p.cpf,
                    "email": p.email,
                    "numero_de_contato": p.numero_de_contato,
                }
                for p in self.pacientes
            ]

        return result

    def __repr__(self):
        return f"<Empresa {self.nome} (CNPJ={self.cnpj})>"
