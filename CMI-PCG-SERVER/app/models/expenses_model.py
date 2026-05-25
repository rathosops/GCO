# app/models/expenses_model.py
"""
Tabela de despesas da clínica.

Categorias baseadas em boas práticas de gestão financeira para
clínicas médicas: custos fixos/variáveis, centros de custo,
recorrência e rastreamento de fornecedores/notas fiscais.
"""

from datetime import date

from sqlalchemy import and_, case, func

from app.database import db
from app.src.audit import AuditableMixin


class Despesas(AuditableMixin, db.Model):
    """
    Registro de despesas operacionais e não-operacionais da clínica.

    Atributos principais:
        - descricao: descrição livre da despesa.
        - categoria: classificação funcional (PESSOAL, MATERIAIS_INSUMOS, etc).
        - tipo_custo: FIXO ou VARIAVEL.
        - valor: valor bruto da despesa.
        - data_vencimento: data de vencimento do pagamento.
        - data_pagamento: data em que foi efetivamente pago (nullable).
        - status: PENDENTE, PAGA, CANCELADA, ATRASADA, PARCIAL.
        - recorrencia: UNICA, MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL.
        - centro_custo: agrupamento lógico (ADMINISTRATIVO, CLINICO, etc).
        - forma_pagamento: PIX, BOLETO, DEBITO_AUTOMATICO, etc.
        - fornecedor_nome: nome do fornecedor/prestador.
        - numero_documento: NF, boleto, recibo, etc.
    """

    __tablename__ = "despesas"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # ── Descrição ────────────────────────────────────────────────────
    descricao: str = db.Column(
        db.String(500),
        nullable=False,
        doc="Descrição livre da despesa.",
    )
    observacoes: str | None = db.Column(
        db.Text,
        nullable=True,
        doc="Observações adicionais ou justificativa.",
    )

    # ── Classificação ────────────────────────────────────────────────
    categoria: str = db.Column(
        db.String(50),
        nullable=False,
        index=True,
        doc=(
            "Categoria funcional: PESSOAL, ALUGUEL_INFRAESTRUTURA, "
            "MATERIAIS_INSUMOS, EQUIPAMENTOS, SERVICOS_TERCEIRIZADOS, "
            "UTILIDADES, IMPOSTOS_TAXAS, MARKETING, MANUTENCAO, "
            "SEGUROS, EDUCACAO_TREINAMENTO, ADMINISTRATIVO, OUTROS."
        ),
    )
    tipo_custo: str = db.Column(
        db.String(10),
        nullable=False,
        server_default="FIXO",
        doc="FIXO ou VARIAVEL.",
    )
    centro_custo: str | None = db.Column(
        db.String(50),
        nullable=True,
        index=True,
        doc=(
            "Centro de custo: ADMINISTRATIVO, CLINICO, LABORATORIO, "
            "FARMACIA, SERVICOS_TERCEIRIZADOS, IMAGEM, RECEPCAO, "
            "LIMPEZA, TI, GERAL."
        ),
    )

    # ── Valores ──────────────────────────────────────────────────────
    valor: float = db.Column(
        db.Numeric(12, 2),
        nullable=False,
        doc="Valor bruto contratado/cadastrado.",
    )
    valor_desconto: float | None = db.Column(
        db.Numeric(12, 2),
        nullable=True,
        doc="Desconto obtido (pagamento antecipado, negociação, etc).",
    )
    valor_juros_multa: float | None = db.Column(
        db.Numeric(12, 2),
        nullable=True,
        doc="Juros ou multa por atraso.",
    )
    valor_pago: float | None = db.Column(
        db.Numeric(12, 2),
        nullable=True,
        doc="Valor efetivamente pago (pode diferir do valor original).",
    )

    # ── Datas ────────────────────────────────────────────────────────
    data_competencia: date = db.Column(
        db.Date,
        nullable=False,
        index=True,
        doc="Mês/ano de competência da despesa (regime de competência).",
    )
    data_vencimento: date = db.Column(
        db.Date,
        nullable=False,
        index=True,
        doc="Data de vencimento do pagamento.",
    )
    data_pagamento: date | None = db.Column(
        db.Date,
        nullable=True,
        doc="Data em que foi efetivamente pago.",
    )

    # ── Status e recorrência ─────────────────────────────────────────
    status: str = db.Column(
        db.String(20),
        nullable=False,
        server_default="PENDENTE",
        index=True,
        doc="PENDENTE, PAGA, CANCELADA, ATRASADA, PARCIAL.",
    )
    recorrencia: str = db.Column(
        db.String(15),
        nullable=False,
        server_default="UNICA",
        doc="UNICA, MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL.",
    )
    despesa_pai_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("despesas.id", ondelete="SET NULL"),
        nullable=True,
        doc="Referência à despesa original que gerou esta recorrência.",
    )

    # ── Pagamento ────────────────────────────────────────────────────
    forma_pagamento: str | None = db.Column(
        db.String(30),
        nullable=True,
        doc=(
            "PIX, BOLETO, DEBITO_AUTOMATICO, TRANSFERENCIA, "
            "CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO, CHEQUE."
        ),
    )
    conta_saida: str | None = db.Column(
        db.String(50),
        nullable=True,
        doc="Conta bancária de saída (ex: 'Bradesco PJ', 'Caixa PJ').",
    )

    # ── Fornecedor / Documento ───────────────────────────────────────
    fornecedor_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("fornecedores.id", ondelete="SET NULL"),
        nullable=True,
        doc="Referência ao fornecedor cadastrado.",
    )
    fornecedor_nome: str | None = db.Column(
        db.String(300),
        nullable=True,
        doc="Nome do fornecedor/prestador (desnormalizado para buscas).",
    )
    fornecedor_cnpj_cpf: str | None = db.Column(
        db.String(14),
        nullable=True,
        doc="CNPJ ou CPF do fornecedor (apenas dígitos).",
    )
    numero_documento: str | None = db.Column(
        db.String(100),
        nullable=True,
        doc="Número da NF, boleto, recibo ou outro documento fiscal.",
    )
    tipo_documento: str | None = db.Column(
        db.String(30),
        nullable=True,
        doc="NOTA_FISCAL, BOLETO, RECIBO, FATURA, GUIA, OUTROS.",
    )

    # ── Rateio / Empresa ─────────────────────────────────────────────
    empresa_id: int | None = db.Column(
        db.BigInteger,
        db.ForeignKey("empresas.id", ondelete="SET NULL"),
        nullable=True,
        doc="Empresa vinculada (quando despesa é específica de um cliente).",
    )

    # ── Relacionamentos ──────────────────────────────────────────────
    fornecedor = db.relationship(
        "Fornecedores",
        backref="despesas",
        lazy=True,
        foreign_keys=[fornecedor_id],
    )
    empresa = db.relationship(
        "Empresas",
        backref="despesas",
        lazy=True,
        foreign_keys=[empresa_id],
    )
    despesa_pai = db.relationship(
        "Despesas",
        remote_side="Despesas.id",
        backref="recorrencias",
        lazy=True,
    )

    # ── Índices compostos ────────────────────────────────────────────
    __table_args__ = (
        db.Index("ix_despesas_categoria_status", "categoria", "status"),
        db.Index("ix_despesas_vencimento_status", "data_vencimento", "status"),
        db.Index("ix_despesas_competencia", "data_competencia"),
    )

    # ── Cálculos / Serialização ─────────────────────────────────────

    @property
    def valor_liquido(self) -> float:
        """Valor estimado: valor - desconto + juros/multa."""
        base = float(self.valor or 0)
        desconto = float(self.valor_desconto or 0)
        juros = float(self.valor_juros_multa or 0)
        return base - desconto + juros

    @property
    def valor_efetivo(self) -> float:
        """
        Valor efetivo da despesa para fins de relatório.

        - PAGA com valor_pago definido → valor_pago (real, inclui ajustes)
        - Caso contrário → valor_liquido (estimativa: valor − desconto + juros)
        """
        if self.status == "PAGA" and self.valor_pago is not None:
            return float(self.valor_pago)
        return self.valor_liquido

    @classmethod
    def valor_efetivo_sql(cls):
        """
        Expressão SQL equivalente a `valor_efetivo`.

        Use em agregações para evitar somar `valor` cru, que ignora
        juros, descontos e ajustes feitos no momento do pagamento.

        Retorna:
            CASE
              WHEN status='PAGA' AND valor_pago IS NOT NULL THEN valor_pago
              ELSE valor + COALESCE(juros, 0) - COALESCE(desconto, 0)
            END
        """
        return case(
            (
                and_(cls.status == "PAGA", cls.valor_pago.isnot(None)),
                cls.valor_pago,
            ),
            else_=(
                cls.valor
                + func.coalesce(cls.valor_juros_multa, 0)
                - func.coalesce(cls.valor_desconto, 0)
            ),
        )

    def to_dict(self) -> dict:
        """Serializa para resposta da API."""
        return {
            "id": self.id,
            "descricao": self.descricao,
            "observacoes": self.observacoes,
            # Classificação
            "categoria": self.categoria,
            "tipo_custo": self.tipo_custo,
            "centro_custo": self.centro_custo,
            # Valores
            "valor": float(self.valor or 0),
            "valor_desconto": (
                float(self.valor_desconto) if self.valor_desconto else None
            ),
            "valor_juros_multa": (
                float(self.valor_juros_multa) if self.valor_juros_multa else None
            ),
            "valor_pago": (float(self.valor_pago) if self.valor_pago else None),
            "valor_liquido": self.valor_liquido,
            "valor_efetivo": self.valor_efetivo,
            # Datas
            "data_competencia": (
                self.data_competencia.isoformat() if self.data_competencia else None
            ),
            "data_vencimento": (
                self.data_vencimento.isoformat() if self.data_vencimento else None
            ),
            "data_pagamento": (
                self.data_pagamento.isoformat() if self.data_pagamento else None
            ),
            # Status e recorrência
            "status": self.status,
            "recorrencia": self.recorrencia,
            "despesa_pai_id": self.despesa_pai_id,
            # Pagamento
            "forma_pagamento": self.forma_pagamento,
            "conta_saida": self.conta_saida,
            # Fornecedor / Documento
            "fornecedor_id": self.fornecedor_id,
            "fornecedor_nome": (
                self.fornecedor_nome
                or (self.fornecedor.nome if self.fornecedor else None)
            ),
            "fornecedor_cnpj_cpf": self.fornecedor_cnpj_cpf,
            "numero_documento": self.numero_documento,
            "tipo_documento": self.tipo_documento,
            # Empresa
            "empresa_id": self.empresa_id,
            "empresa_nome": (self.empresa.nome if self.empresa else None),
            # Auditoria
            "created_at": (self.created_at.isoformat() if self.created_at else None),
            "updated_at": (self.updated_at.isoformat() if self.updated_at else None),
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    def __repr__(self) -> str:
        return (
            f"<Despesa {self.categoria} - R${float(self.valor or 0):.2f} "
            f"venc={self.data_vencimento} [{self.status}]>"
        )
