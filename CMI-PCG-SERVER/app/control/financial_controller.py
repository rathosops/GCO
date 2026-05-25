"""Controller responsável pela geração de PDFs de relatórios financeiros."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Iterable, List, Dict, Any, Tuple

import pendulum
from flask import Blueprint, request

from app.models.payments_model import Pagamentos
from app.models.medical_appointments_model import Consultas
from app.models.patients_model import Pacientes
from app.models.exam_request_model import SolicitacoesDeExames
from app.control.base_pdf_report import BasePdfReport

financial_bp = Blueprint("financial", __name__)

TZ_AMERICA_SAO_PAULO = pendulum.timezone("America/Sao_Paulo")

MONTH_NAMES_PT_BR = {
    1: "Janeiro",
    2: "Fevereiro",
    3: "Março",
    4: "Abril",
    5: "Maio",
    6: "Junho",
    7: "Julho",
    8: "Agosto",
    9: "Setembro",
    10: "Outubro",
    11: "Novembro",
    12: "Dezembro",
}


def parse_data(data_str: str | None) -> datetime | None:
    """
    Converte uma string de data (YYYY-MM-DD) para objeto datetime.

    Args:
        data_str: Data no formato "YYYY-MM-DD".

    Returns:
        datetime | None: Objeto datetime correspondente ou None se inválido.
    """
    if not data_str:
        return None
    try:
        return datetime.strptime(data_str, "%Y-%m-%d")
    except (TypeError, ValueError):
        return None


class FinancialPdfReport(BasePdfReport):
    """
    Classe responsável por gerar relatórios financeiros em PDF.

    Tipos suportados: all, company, insurance, patient, others, exams.
    """

    TEMPLATE_PATHS = {
        "company": "financial_requests/company_financial_report.html",
        "insurance": "financial_requests/insurance_financial_report.html",
        "patient": "financial_requests/patient_financial_report.html",
        "others": "financial_requests/others_financial_report.html",
        "exams": "financial_requests/exams_request_financial_report.html",
        "all": "financial_requests/full_financial_report.html",
    }

    def __init__(
        self,
        data_inicio: datetime,
        data_fim: datetime,
        tipo: str = "all",
        filtro_id: str | None = None,
    ) -> None:
        """
        Inicializa o relatório com parâmetros básicos.

        Args:
            data_inicio: Data inicial do filtro.
            data_fim: Data final do filtro.
            tipo: Tipo de relatório.
            filtro_id: Identificador para filtro (CPF ou CNPJ).
        """
        self.data_inicio = data_inicio
        self.data_fim = data_fim
        self.tipo = tipo
        self.filtro_id = filtro_id

        self.context: Dict[str, Any] = {}
        self.template_path = self.TEMPLATE_PATHS.get(tipo, self.TEMPLATE_PATHS["all"])
        self.filename = (
            f"relatorio_{tipo}_{data_inicio:%Y%m%d}_ate_{data_fim:%Y%m%d}.pdf"
        )

    # =========================
    # Métodos privados de busca
    # =========================

    def _buscar_pagamentos_por_cpfs(self, cpfs: Iterable[str]) -> List[Pagamentos]:
        """Retorna pagamentos de uma lista de CPFs no intervalo de datas."""
        return Pagamentos.query.filter(
            Pagamentos.cpf.in_(list(cpfs)),
            Pagamentos.data.between(self.data_inicio, self.data_fim),
        ).all()

    def _buscar_consultas_por_cpfs(self, cpfs: Iterable[str]) -> List[Consultas]:
        """Retorna consultas de uma lista de CPFs no intervalo de datas."""
        return Consultas.query.filter(
            Consultas.cpf_paciente.in_(list(cpfs)),
            Consultas.data.between(self.data_inicio, self.data_fim),
        ).all()

    def _buscar_exames_por_cpfs(
        self, cpfs: Iterable[str]
    ) -> List[SolicitacoesDeExames]:
        """Retorna exames faturados de uma lista de CPFs no intervalo de datas."""
        return SolicitacoesDeExames.query.filter(
            SolicitacoesDeExames.cpf_paciente.in_(list(cpfs)),
            SolicitacoesDeExames.data.between(self.data_inicio, self.data_fim),
            SolicitacoesDeExames.status == "FATURADO",
        ).all()

    def _buscar_pagamentos_por_cpf(self, cpf: str) -> List[Pagamentos]:
        """Retorna pagamentos de um CPF específico no intervalo de datas."""
        return Pagamentos.query.filter(
            Pagamentos.cpf == cpf,
            Pagamentos.data.between(self.data_inicio, self.data_fim),
        ).all()

    def _buscar_consultas_por_cpf(self, cpf: str) -> List[Consultas]:
        """Retorna consultas de um CPF específico no intervalo de datas."""
        return Consultas.query.filter(
            Consultas.cpf_paciente == cpf,
            Consultas.data.between(self.data_inicio, self.data_fim),
        ).all()

    # =========================
    # Métodos auxiliares de resumo
    # =========================

    def _build_mes_referencia_label(self) -> str:
        """
        Constrói label de mês de referência com base em data_inicio.

        Exemplo: "Janeiro de 2025".
        """
        mes = self.data_inicio.month
        ano = self.data_inicio.year
        nome_mes = MONTH_NAMES_PT_BR.get(mes, str(mes))
        return f"{nome_mes} de {ano}"

    @staticmethod
    def _calcula_resumo_por_tipo(
        pagamentos: Iterable[Pagamentos],
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Calcula totais por tipo de pagamento e quantidade de lançamentos.

        Retorna:
            (resumo, total_lancamentos)

            resumo: lista de dicts:
            [
                {
                    "tipo": "PIX",
                    "quantidade": 15,
                    "total_bruto": 1000.0,
                    "total_descontos": 50.0,
                    "total_liquido": 950.0,
                    "percentual_liquido": 42.5,
                },
                ...
            ]

            total_lancamentos: soma das quantidades (len(pagamentos))
        """
        acumulado: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"quantidade": 0, "total_bruto": 0.0, "total_descontos": 0.0}
        )

        for pagamento in pagamentos:
            tipo = (pagamento.tipo or "OUTRO").upper()
            valor = float(pagamento.valor or 0)
            desconto = float(pagamento.valor_desconto or 0)

            acumulado[tipo]["quantidade"] += 1
            acumulado[tipo]["total_bruto"] += valor
            acumulado[tipo]["total_descontos"] += desconto

        resumo: List[Dict[str, Any]] = []
        total_liquido_geral = 0.0
        total_lancamentos = 0

        for tipo, valores in acumulado.items():
            quantidade = int(valores["quantidade"])
            total_bruto = valores["total_bruto"]
            total_descontos = valores["total_descontos"]
            total_liquido = total_bruto - total_descontos

            total_liquido_geral += total_liquido
            total_lancamentos += quantidade

            resumo.append(
                {
                    "tipo": tipo,
                    "quantidade": quantidade,
                    "total_bruto": total_bruto,
                    "total_descontos": total_descontos,
                    "total_liquido": total_liquido,
                    "percentual_liquido": 0.0,
                }
            )

        if total_liquido_geral > 0:
            for item in resumo:
                item["percentual_liquido"] = round(
                    (item["total_liquido"] / total_liquido_geral) * 100, 2
                )

        resumo.sort(key=lambda item: item["total_liquido"], reverse=True)
        return resumo, total_lancamentos

    @staticmethod
    def _calcula_resumo_pix_por_tipo_pessoa(
        pagamentos: Iterable[Pagamentos],
    ) -> List[Dict[str, Any]]:
        """
        Calcula totais de pagamentos PIX agrupados por tipo de pessoa (PF/PJ).

        Retorna lista de dicts com: tipo_pessoa, quantidade, total_bruto,
        total_descontos, total_liquido, percentual_liquido.
        """
        acumulado: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"quantidade": 0, "total_bruto": 0.0, "total_descontos": 0.0}
        )

        for pagamento in pagamentos:
            if (pagamento.tipo or "").upper() != "PIX":
                continue

            tipo_pessoa = (pagamento.tipo_pessoa_pix or "NAO_INFORMADO").upper()
            valor = float(pagamento.valor or 0)
            desconto = float(pagamento.valor_desconto or 0)

            acumulado[tipo_pessoa]["quantidade"] += 1
            acumulado[tipo_pessoa]["total_bruto"] += valor
            acumulado[tipo_pessoa]["total_descontos"] += desconto

        if not acumulado:
            return []

        resumo: List[Dict[str, Any]] = []
        total_liquido_geral = 0.0

        for tipo_pessoa, valores in acumulado.items():
            quantidade = int(valores["quantidade"])
            total_bruto = valores["total_bruto"]
            total_descontos = valores["total_descontos"]
            total_liquido = total_bruto - total_descontos

            total_liquido_geral += total_liquido

            resumo.append(
                {
                    "tipo_pessoa": tipo_pessoa,
                    "quantidade": quantidade,
                    "total_bruto": total_bruto,
                    "total_descontos": total_descontos,
                    "total_liquido": total_liquido,
                    "percentual_liquido": 0.0,
                }
            )

        if total_liquido_geral > 0:
            for item in resumo:
                item["percentual_liquido"] = round(
                    (item["total_liquido"] / total_liquido_geral) * 100, 2
                )

        # Ordena: PF primeiro, depois PJ, depois não informado
        ordem = {"PF": 0, "PJ": 1}
        resumo.sort(key=lambda x: ordem.get(x["tipo_pessoa"], 99))

        return resumo

    @staticmethod
    def _top_n_from_pagamentos(
        pagamentos: Iterable[Pagamentos],
        key_func,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """Calcula top N agrupando por uma chave (empresa, convênio, paciente)."""
        acumulado: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"quantidade": 0, "total_liquido": 0.0}
        )

        for pagamento in pagamentos:
            nome = key_func(pagamento)
            if not nome:
                continue

            valor = float(pagamento.valor or 0)
            desconto = float(pagamento.valor_desconto or 0)
            liquido = valor - desconto

            acumulado[nome]["quantidade"] += 1
            acumulado[nome]["total_liquido"] += liquido

        resultado: List[Dict[str, Any]] = [
            {
                "nome": nome,
                "quantidade": int(dados["quantidade"]),
                "total_liquido": float(dados["total_liquido"]),
            }
            for nome, dados in acumulado.items()
        ]

        resultado.sort(key=lambda item: item["total_liquido"], reverse=True)
        return resultado[:limit]

    @staticmethod
    def _calcula_pacientes_atendidos(pagamentos: Iterable[Pagamentos]) -> int:
        """Calcula número de pacientes distintos atendidos no período."""
        identificadores: set[tuple[str, Any]] = set()

        for pagamento in pagamentos:
            if pagamento.cpf:
                identificadores.add(("cpf", pagamento.cpf))
            elif pagamento.paciente and getattr(pagamento.paciente, "id", None):
                identificadores.add(("id", pagamento.paciente.id))
            elif getattr(pagamento, "nome_do_paciente", None):
                nome = (pagamento.nome_do_paciente or "").strip()
                if nome:
                    identificadores.add(("nome", nome))

        return len(identificadores)

    # =========================
    # Contexto para o template
    # =========================

    def build_context(self) -> None:
        """Constrói o contexto a ser injetado no template de relatório."""
        pagamentos: List[Pagamentos] = []
        exames: List[SolicitacoesDeExames] = []
        consultas: List[Consultas] = []

        if self.tipo in {"company", "insurance"}:
            campo = "empresa_id" if self.tipo == "company" else "convenio_id"

            pacientes = Pacientes.query.filter(
                getattr(Pacientes, campo) == int(self.filtro_id)
            ).all()
            cpfs = [p.cpf for p in pacientes if p.cpf]

            pagamentos = self._buscar_pagamentos_por_cpfs(cpfs)

            if self.tipo == "insurance":
                consultas = self._buscar_consultas_por_cpfs(cpfs)
                exames = self._buscar_exames_por_cpfs(cpfs)

        elif self.tipo == "patient":
            filtro = str(self.filtro_id)
            pagamentos = self._buscar_pagamentos_por_cpf(filtro)
            consultas = self._buscar_consultas_por_cpf(filtro)

        elif self.tipo == "others":
            pagamentos = Pagamentos.query.filter(
                Pagamentos.cpf.is_(None),
                Pagamentos.empresa_id.is_(None),
                Pagamentos.convenio_id.is_(None),
                Pagamentos.data.between(self.data_inicio, self.data_fim),
            ).all()

        elif self.tipo == "exams":
            exames = SolicitacoesDeExames.query.filter(
                SolicitacoesDeExames.data.between(self.data_inicio, self.data_fim),
                SolicitacoesDeExames.status == "FATURADO",
            ).all()

        elif self.tipo == "all":
            pagamentos = Pagamentos.query.filter(
                Pagamentos.data.between(self.data_inicio, self.data_fim)
            ).all()

        # Cálculos de totais
        valor_pagamentos = sum(float(p.valor or 0) for p in pagamentos)
        valor_exames = sum(float(e.soma_dos_valores or 0) for e in exames)
        valor_descontos = sum(float(p.valor_desconto or 0) for p in pagamentos)

        total_bruto = valor_pagamentos + valor_exames
        total_liquido = total_bruto - valor_descontos

        # Resumos
        resumo_por_tipo, total_lancamentos = self._calcula_resumo_por_tipo(pagamentos)
        resumo_pix_por_tipo_pessoa = self._calcula_resumo_pix_por_tipo_pessoa(
            pagamentos
        )

        # KPIs
        num_pacientes_atendidos = self._calcula_pacientes_atendidos(pagamentos)

        ticket_medio_pagamento = (
            total_liquido / total_lancamentos if total_lancamentos > 0 else None
        )
        ticket_medio_paciente = (
            total_liquido / num_pacientes_atendidos
            if num_pacientes_atendidos > 0
            else None
        )

        # Comparativo com período anterior (somente para "all")
        comparativo_pct = None
        possui_comparativo = False
        if self.tipo == "all":
            delta = self.data_fim - self.data_inicio
            prev_fim = self.data_inicio - timedelta(days=1)
            prev_inicio = prev_fim - delta

            pagamentos_prev = Pagamentos.query.filter(
                Pagamentos.data.between(prev_inicio, prev_fim)
            ).all()
            exames_prev = SolicitacoesDeExames.query.filter(
                SolicitacoesDeExames.data.between(prev_inicio, prev_fim),
                SolicitacoesDeExames.status == "FATURADO",
            ).all()

            prev_pagamentos = sum(float(p.valor or 0) for p in pagamentos_prev)
            prev_exames = sum(float(e.soma_dos_valores or 0) for e in exames_prev)
            prev_descontos = sum(float(p.valor_desconto or 0) for p in pagamentos_prev)

            total_liquido_prev = (prev_pagamentos + prev_exames) - prev_descontos

            if total_liquido_prev > 0:
                comparativo_pct = round(
                    ((total_liquido - total_liquido_prev) / total_liquido_prev) * 100,
                    2,
                )
                possui_comparativo = True

        # Top N clientes (apenas para "all")
        top_empresas: List[Dict[str, Any]] = []
        top_convenios: List[Dict[str, Any]] = []
        top_pacientes: List[Dict[str, Any]] = []

        if self.tipo == "all":
            top_empresas = self._top_n_from_pagamentos(
                pagamentos,
                key_func=lambda p: (
                    p.nome_empresa
                    or (
                        p.empresa.nome
                        if p.empresa and getattr(p.empresa, "nome", None)
                        else None
                    )
                ),
            )
            top_convenios = self._top_n_from_pagamentos(
                pagamentos,
                key_func=lambda p: (
                    p.nome_convenio
                    or (
                        p.convenio.nome
                        if p.convenio and getattr(p.convenio, "nome", None)
                        else None
                    )
                ),
            )
            top_pacientes = self._top_n_from_pagamentos(
                pagamentos,
                key_func=lambda p: (
                    p.paciente.nome
                    if p.paciente and getattr(p.paciente, "nome", None)
                    else (p.nome_do_paciente or None)
                ),
            )

        possui_observacoes = any((p.descricao or "").strip() for p in pagamentos)

        gerado_em = pendulum.now(TZ_AMERICA_SAO_PAULO).format("DD/MM/YYYY HH:mm")

        self.context = {
            "data_inicio": self.data_inicio.strftime("%d/%m/%Y"),
            "data_fim": self.data_fim.strftime("%d/%m/%Y"),
            "tipo_relatorio": self.tipo,
            "mes_referencia": self._build_mes_referencia_label(),
            "pagamentos": pagamentos,
            "consultas": consultas,
            "exames": exames,
            "total_recebido": total_bruto,
            "total_descontos": valor_descontos,
            "resumo_por_tipo": resumo_por_tipo,
            "resumo_pix_por_tipo_pessoa": resumo_pix_por_tipo_pessoa,
            "possui_observacoes": possui_observacoes,
            "gerado_em": gerado_em,
            "total_lancamentos": total_lancamentos,
            # KPIs
            "faturamento_bruto": total_bruto,
            "faturamento_liquido": total_liquido,
            "ticket_medio_pagamento": ticket_medio_pagamento,
            "ticket_medio_paciente": ticket_medio_paciente,
            "num_pacientes_atendidos": num_pacientes_atendidos,
            "comparativo_liquido_anterior_pct": comparativo_pct,
            "possui_comparativo_anterior": possui_comparativo,
            # Top N clientes
            "top_empresas": top_empresas,
            "top_convenios": top_convenios,
            "top_pacientes": top_pacientes,
        }


@financial_bp.route("/relatorio_financeiro")
def relatorio_financeiro():
    """
    Rota para geração do PDF com o relatório financeiro.

    Query params: data_inicio, data_fim, tipo, filtro_id.
    """
    data_inicio = parse_data(request.args.get("data_inicio"))
    data_fim = parse_data(request.args.get("data_fim"))
    tipo = (request.args.get("tipo") or "all").lower()
    filtro_id = request.args.get("filtro_id")

    if not data_inicio or not data_fim:
        return "Datas inválidas", 400

    try:
        pdf_report = FinancialPdfReport(
            data_inicio, data_fim, tipo=tipo, filtro_id=filtro_id
        )
        return pdf_report.generate_response()
    except ValueError as exc:
        return str(exc), 400
    except Exception as exc:  # pylint: disable=broad-except
        return f"Erro ao gerar PDF: {str(exc)}", 500
