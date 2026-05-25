"""
Controller para geração de PDFs de faturamento posterior.

Rotas:
  GET  /faturamento-posterior/empresas/<id>/relatorio-pdf
       Relatório de atendimentos do período

  GET  /faturamento-posterior/empresas/<id>/recibo-pdf
       Recibo de cobrança com valores justificados

Query params: data_inicio, data_fim (YYYY-MM-DD).
"""

from __future__ import annotations

import logging

from flask import Blueprint, jsonify, request

from app.control.base_pdf_report import BasePdfReport
from app.src.company_billing_service import company_billing_service
from app.utils.validators import parse_date

LOGGER = logging.getLogger(__name__)

faturamento_posterior_pdf_bp = Blueprint("faturamento_posterior_pdf", __name__)


# =========================================================================
# Helpers
# =========================================================================


def _json_error(msg: str, status: int = 400):
    return jsonify({"error": msg}), status


def _extract_periodo():
    """Extrai e valida data_inicio/data_fim dos query params."""
    data_inicio = parse_date(request.args.get("data_inicio"))
    data_fim = parse_date(request.args.get("data_fim"))

    if not data_inicio or not data_fim:
        return None, None, _json_error("Informe data_inicio e data_fim (YYYY-MM-DD).")

    if data_inicio > data_fim:
        return None, None, _json_error("data_inicio não pode ser posterior a data_fim.")

    return data_inicio, data_fim, None


# =========================================================================
# Classes PDF
# =========================================================================


class BillingReportPdf(BasePdfReport):
    """Relatório de atendimentos do período para empresa conveniada."""

    def __init__(self, ctx: dict):
        self.ctx = ctx
        self.context: dict = {}
        self.template_path = "company_billing/billing_report.html"
        nome = ctx.get("empresa", {}).get("nome", "empresa")
        self.filename = f"relatorio_faturamento_{nome.replace(' ', '_')}.pdf"

    def build_context(self) -> None:
        self.context = self.ctx


class BillingReceiptPdf(BasePdfReport):
    """Recibo de cobrança com valores justificados."""

    def __init__(self, ctx: dict):
        self.ctx = ctx
        self.context: dict = {}
        self.template_path = "company_billing/billing_receipt.html"
        nome = ctx.get("empresa", {}).get("nome", "empresa")
        self.filename = f"recibo_cobranca_{nome.replace(' ', '_')}.pdf"

    def build_context(self) -> None:
        self.context = self.ctx


# =========================================================================
# ROTAS
# =========================================================================


@faturamento_posterior_pdf_bp.route(
    "/faturamento-posterior/empresas/<int:empresa_id>/relatorio-pdf",
    methods=["GET"],
)
def gerar_relatorio_pdf(empresa_id: int):
    """Gera PDF de relatório de atendimentos do período."""
    data_inicio, data_fim, error = _extract_periodo()
    if error:
        return error

    try:
        ctx = company_billing_service.build_relatorio_context(
            empresa_id,
            data_inicio,
            data_fim,
        )
        if not ctx:
            return _json_error("Empresa não encontrada.", 404)

        pdf = BillingReportPdf(ctx)
        return pdf.generate_response()

    except Exception as exc:
        LOGGER.exception(
            "Erro ao gerar relatório PDF faturamento empresa %d",
            empresa_id,
        )
        return _json_error(f"Erro ao gerar PDF: {exc}", 500)


@faturamento_posterior_pdf_bp.route(
    "/faturamento-posterior/empresas/<int:empresa_id>/recibo-pdf",
    methods=["GET"],
)
def gerar_recibo_pdf(empresa_id: int):
    """Gera PDF de recibo de cobrança com valores justificados."""
    data_inicio, data_fim, error = _extract_periodo()
    if error:
        return error

    try:
        ctx = company_billing_service.build_recibo_context(
            empresa_id,
            data_inicio,
            data_fim,
        )
        if not ctx:
            return _json_error(
                "Empresa não encontrada ou sem faturamento posterior.",
                404,
            )

        pdf = BillingReceiptPdf(ctx)
        return pdf.generate_response()

    except Exception as exc:
        LOGGER.exception(
            "Erro ao gerar recibo PDF faturamento empresa %d",
            empresa_id,
        )
        return _json_error(f"Erro ao gerar PDF: {exc}", 500)
