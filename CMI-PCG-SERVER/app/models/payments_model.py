# app/models/payments_model.py
"""Tabela de pagamentos"""

from datetime import date

from app.database import db
from app.src.audit import AuditableMixin


class Pagamentos(AuditableMixin, db.Model):
    """
    Tabela de pagamentos realizados por pacientes, empresas e convênios.

    Atributos principais:
        - tipo: forma de pagamento (PIX, DINHEIRO, CRÉDITO, etc).
        - tipo_pessoa_pix: tipo de pessoa do pagador para pagamentos PIX:
            * 'PF' -> Pessoa Física
            * 'PJ' -> Pessoa Jurídica
        - conta_destinada_pix: conta de destino para pagamentos PIX:
            * 'PF' -> Conta Pessoa Física
            * 'PJ' -> Conta Pessoa Jurídica
        - valor: valor bruto do pagamento.
        - possui_desconto: indica se houve desconto aplicado.
        - valor_desconto: valor do desconto (quando houver).
        - data: data do pagamento.
        - origem: origem do pagamento (PACIENTE, EMPRESA, CONVÊNIO, etc).
        - vinculado_nota_fiscal: indica se o pagamento está vinculado a uma NF.
        - numero_nota_fiscal: número da nota fiscal (quando vinculado).
    """

    __tablename__ = "pagamentos"

    id: int = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    tipo: str = db.Column(db.String, nullable=False)

    tipo_pessoa_pix: str | None = db.Column(
        db.String(2),
        nullable=True,
        doc="Tipo de pessoa do pagador PIX: 'PF' ou 'PJ'.",
    )

    conta_destinada_pix: str | None = db.Column(
        db.String(2),
        nullable=True,
        doc="Conta de destino PIX: 'PF' (pessoa física) ou 'PJ' (pessoa jurídica).",
    )

    valor: float = db.Column(db.Float, nullable=False)
    possui_desconto: bool | None = db.Column(db.Boolean)
    valor_desconto: float | None = db.Column(db.Float)
    data: date = db.Column(db.Date, nullable=False)
    nome_do_paciente: str | None = db.Column(db.String)

    # Chaves estrangeiras
    cpf: str | None = db.Column(db.String(11), db.ForeignKey("pacientes.cpf"))
    empresa_id: int | None = db.Column(db.BigInteger, db.ForeignKey("empresas.id"))
    convenio_id: int | None = db.Column(db.BigInteger, db.ForeignKey("convenios.id"))

    origem: str = db.Column(db.String, nullable=False)
    nome_empresa: str | None = db.Column(db.String)
    nome_convenio: str | None = db.Column(db.String)
    descricao: str | None = db.Column(db.String)
    qtd_parcelas_credito: int | None = db.Column(db.BigInteger)

    # Campos de nota fiscal
    vinculado_nota_fiscal: bool | None = db.Column(
        db.Boolean,
        nullable=True,
        default=False,
        doc="Indica se o pagamento está vinculado a uma nota fiscal.",
    )
    numero_nota_fiscal: str | None = db.Column(
        db.String(50),
        nullable=True,
        doc="Número da nota fiscal vinculada ao pagamento.",
    )

    # Relacionamentos
    paciente = db.relationship("Pacientes", backref="pagamentos", lazy=True)
    empresa = db.relationship("Empresas", backref="pagamentos", lazy=True)
    convenio = db.relationship("Convenios", backref="pagamentos", lazy=True)

    def to_dict(self) -> dict:
        """
        Converte a instância de Pagamentos em um dicionário serializável para JSON.

        Returns:
            dict: Representação do pagamento, incluindo campos derivados
            de relacionamentos (empresa, convênio).
        """
        return {
            "id": self.id,
            "tipo": self.tipo,
            "tipo_pessoa_pix": self.tipo_pessoa_pix,
            "conta_destinada_pix": self.conta_destinada_pix,
            "valor": self.valor,
            "possui_desconto": self.possui_desconto,
            "valor_desconto": self.valor_desconto,
            "data": self.data.strftime("%Y-%m-%d") if self.data else None,
            "nome_do_paciente": self.nome_do_paciente,
            "cpf": self.cpf,
            "empresa_id": self.empresa_id,
            "convenio_id": self.convenio_id,
            "cnpj_empresa": self.empresa.cnpj if self.empresa else None,
            "nome_empresa": self.empresa.nome if self.empresa else None,
            "cnpj_convenio": self.convenio.cnpj if self.convenio else None,
            "nome_convenio": self.convenio.nome if self.convenio else None,
            "origem": self.origem,
            "descricao": self.descricao,
            "qtd_parcelas_credito": self.qtd_parcelas_credito,
            # Campos de nota fiscal
            "vinculado_nota_fiscal": self.vinculado_nota_fiscal or False,
            "numero_nota_fiscal": self.numero_nota_fiscal,
            # Campos de auditoria
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_id": self.created_by_id,
            "updated_by_id": self.updated_by_id,
        }

    def __repr__(self) -> str:
        """Retorna representação textual útil para logs e debug."""
        return f"<Pagamento {self.tipo} - R${self.valor:.2f} em {self.data}>"
