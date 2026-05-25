# control/payment_invoice_report.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict

from flask import current_app

from app.control.base_pdf_report import BasePdfReport
from app.models.payments_model import Pagamentos
from app.models.patients_model import Pacientes
from app.models.companies_model import Empresas
from app.models.insurances_model import Convenios
from app.models.clinic_infos_model import ClinicaInfos
from app.utils.timezone import SAO_PAULO_TZ


@dataclass(frozen=True)
class InvoiceContext:
    """Contexto de dados que irão para o template da nota fiscal."""

    pagamento: Pagamentos
    paciente: Pacientes | None
    empresa: Empresas | None
    convenio: Convenios | None
    clinica: ClinicaInfos | None
    valor_liquido: float
    emitido_em: datetime


def _only_digits(value: object) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _format_cpf(cpf_int: int | str | None) -> str:
    if not cpf_int:
        return "—"
    s = str(cpf_int).zfill(11)
    if len(s) != 11:
        return str(cpf_int)
    return f"{s[:3]}.{s[3:6]}.{s[6:9]}-{s[9:]}"


def _format_cnpj(cnpj_int: int | None) -> str:
    if not cnpj_int:
        return "—"
    s = str(cnpj_int).zfill(14)
    if len(s) != 14:
        return str(cnpj_int)
    return f"{s[:2]}.{s[2:5]}.{s[5:8]}/{s[8:12]}-{s[12:]}"


def _format_currency(value: float | None) -> str:
    v = float(value or 0)
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _format_pix_person_type(value: str | None) -> str:
    """Formata tipo de pessoa PIX para exibição."""
    if value == "PF":
        return "Pessoa Física"
    if value == "PJ":
        return "Pessoa Jurídica"
    return "—"


class PaymentInvoicePdfReport(BasePdfReport):
    """
    Relatório PDF de nota fiscal individual de um pagamento.

    Reaproveita BasePdfReport (WeasyPrint + Jinja2).
    """

    template_path = "payment_invoices/payment_invoice.html"

    def __init__(self, pagamento: Pagamentos) -> None:
        self.pagamento = pagamento
        self.filename = f"nota_fiscal_pagamento_{pagamento.id}.pdf"
        self.context: Dict[str, Any] = {}

    def _resolve_paciente(self) -> Pacientes | None:
        if self.pagamento.paciente:
            return self.pagamento.paciente
        if self.pagamento.cpf:
            return Pacientes.query.filter_by(cpf=self.pagamento.cpf).first()
        return None

    def _resolve_empresa(self) -> Empresas | None:
        if self.pagamento.empresa:
            return self.pagamento.empresa
        if self.pagamento.empresa_id:
            return Empresas.query.get(self.pagamento.empresa_id)
        return None

    def _resolve_convenio(self) -> Convenios | None:
        if self.pagamento.convenio:
            return self.pagamento.convenio
        if self.pagamento.convenio_id:
            return Convenios.query.get(self.pagamento.convenio_id)
        return None

    def _resolve_clinica_infos(self) -> ClinicaInfos | None:
        return ClinicaInfos.query.order_by(ClinicaInfos.id.asc()).first()

    def build_context(self) -> None:
        pagamento = self.pagamento
        paciente = self._resolve_paciente()
        empresa = self._resolve_empresa()
        convenio = self._resolve_convenio()
        clinica = self._resolve_clinica_infos()

        desconto = float(pagamento.valor_desconto or 0)
        bruto = float(pagamento.valor or 0)
        liquido = bruto - desconto

        emitido_em = datetime.now(tz=SAO_PAULO_TZ)

        payer_tipo = pagamento.origem or "OUTROS"
        payer_nome = None
        payer_documento = None
        payer_documento_tipo = None

        if payer_tipo == "PACIENTE" and paciente:
            payer_nome = paciente.nome
            payer_documento = _format_cpf(paciente.cpf)
            payer_documento_tipo = "CPF"
        elif payer_tipo == "EMPRESA" and empresa:
            payer_nome = empresa.nome
            payer_documento = _format_cnpj(empresa.cnpj)
            payer_documento_tipo = "CNPJ"
        elif payer_tipo in {"CONVENIO", "CONVÊNIO"} and convenio:
            payer_nome = convenio.nome
            payer_documento = _format_cnpj(convenio.cnpj)
            payer_documento_tipo = "CNPJ"
        else:
            payer_nome = (
                pagamento.nome_do_paciente
                or pagamento.nome_empresa
                or pagamento.nome_convenio
                or "—"
            )
            if pagamento.cpf:
                payer_documento = _format_cpf(pagamento.cpf)
                payer_documento_tipo = "CPF"

        clinica_dict: Dict[str, Any] = {}
        if clinica:
            clinica_dict = {
                "nome": clinica.nome or "Clínica",
                "cnpj": _format_cnpj(clinica.cnpj_clinica),
                "telefone_fixo": _only_digits(clinica.telefone_fixo) or None,
                "telefone_celular": _only_digits(clinica.telefone_celular) or None,
                "endereco": clinica.endereco or "",
                "website": clinica.website or "",
            }

        paciente_cpf_formatado = None
        if paciente and getattr(paciente, "cpf", None):
            paciente_cpf_formatado = _format_cpf(paciente.cpf)

        invoice_ctx = InvoiceContext(
            pagamento=pagamento,
            paciente=paciente,
            empresa=empresa,
            convenio=convenio,
            clinica=clinica,
            valor_liquido=liquido,
            emitido_em=emitido_em,
        )

        self.context = {
            "invoice": invoice_ctx,
            "pagamento": pagamento,
            "paciente": paciente,
            "empresa": empresa,
            "convenio": convenio,
            "clinica": clinica_dict,
            "valor_bruto_formatado": _format_currency(bruto),
            "valor_desconto_formatado": (
                _format_currency(desconto) if desconto > 0 else None
            ),
            "valor_liquido_formatado": _format_currency(liquido),
            "emitido_em_str": emitido_em.strftime("%d/%m/%Y %H:%M"),
            "payer": {
                "tipo": payer_tipo,
                "nome": payer_nome,
                "documento": payer_documento,
                "documento_tipo": payer_documento_tipo,
            },
            # Campos PIX
            "tipo_pessoa_pix": pagamento.tipo_pessoa_pix,
            "tipo_pessoa_pix_formatado": _format_pix_person_type(
                pagamento.tipo_pessoa_pix
            ),
            "conta_destinada_pix": pagamento.conta_destinada_pix,
            "conta_destinada_pix_formatado": _format_pix_person_type(
                pagamento.conta_destinada_pix
            ),
            "descricao": pagamento.descricao or "",
            "data_pagamento_str": (
                pagamento.data.strftime("%d/%m/%Y") if pagamento.data else "—"
            ),
            "tipo_pagamento": pagamento.tipo,
            "paciente_cpf_formatado": paciente_cpf_formatado,
            "logo_path": "static/images/logo_cmi.png",
        }

        current_app.logger.debug(
            "[PaymentInvoicePdfReport] Contexto montado para pagamento %s",
            pagamento.id,
        )