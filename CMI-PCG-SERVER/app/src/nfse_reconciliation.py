"""
Serviço de reconciliação de NFS-e com pagamentos.

Responsabilidade: cruzar NFS-e extraídas do PDF com pagamentos
existentes no banco, usando CPF/CNPJ + valor + data como chave
de matching.

Não faz I/O de PDF — recebe dados já parseados.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from flask import current_app
from sqlalchemy import and_

from app.database import db
from app.models.payments_model import Pagamentos
from app.src.nfse_pdf_parser import NfsePdfParseResult, NfseRecord


@dataclass(frozen=True)
class MatchResult:
    """Resultado do match de uma NFS-e com um pagamento."""

    nfse_numero: int
    nfse_data: date
    nfse_documento: str
    nfse_nome: str
    nfse_valor: float
    pagamento_id: int | None = None
    pagamento_valor: float | None = None
    pagamento_nome: str | None = None
    matched: bool = False
    already_linked: bool = False
    reason: str = ""


@dataclass
class ReconciliationReport:
    """Relatório completo de reconciliação."""

    total_nfse_processadas: int = 0
    total_nfse_normais: int = 0
    total_nfse_canceladas: int = 0
    matched: list[MatchResult] = field(default_factory=list)
    unmatched: list[MatchResult] = field(default_factory=list)
    already_linked: list[MatchResult] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    applied: int = 0

    @property
    def total_matched(self) -> int:
        return len(self.matched)

    @property
    def total_unmatched(self) -> int:
        return len(self.unmatched)

    @property
    def total_already_linked(self) -> int:
        return len(self.already_linked)

    def to_dict(self) -> dict[str, Any]:
        """Serializa para JSON."""
        return {
            "total_nfse_processadas": self.total_nfse_processadas,
            "total_nfse_normais": self.total_nfse_normais,
            "total_nfse_canceladas": self.total_nfse_canceladas,
            "total_matched": self.total_matched,
            "total_unmatched": self.total_unmatched,
            "total_already_linked": self.total_already_linked,
            "applied": self.applied,
            "matched": [_match_to_dict(m) for m in self.matched],
            "unmatched": [_match_to_dict(m) for m in self.unmatched],
            "already_linked": [_match_to_dict(m) for m in self.already_linked],
            "errors": self.errors,
        }


def _match_to_dict(m: MatchResult) -> dict[str, Any]:
    """Serializa MatchResult para dict."""
    return {
        "nfse_numero": m.nfse_numero,
        "nfse_data": m.nfse_data.isoformat() if m.nfse_data else None,
        "nfse_documento": m.nfse_documento,
        "nfse_nome": m.nfse_nome,
        "nfse_valor": m.nfse_valor,
        "pagamento_id": m.pagamento_id,
        "pagamento_valor": m.pagamento_valor,
        "pagamento_nome": m.pagamento_nome,
        "matched": m.matched,
        "already_linked": m.already_linked,
        "reason": m.reason,
    }


def _only_digits(value: str | None) -> str:
    """Extrai apenas dígitos."""
    return "".join(c for c in str(value or "") if c.isdigit())


class NfseReconciliationService:
    """
    Serviço de reconciliação NFS-e ↔ Pagamentos.

    Fluxo:
        1. preview() — mostra o que seria vinculado (dry-run)
        2. apply() — efetiva as vinculações no banco

    Critérios de match (em ordem):
        - CPF/CNPJ exato
        - Valor da NF == valor do pagamento (tolerância de R$ 0,01)
        - Data do pagamento dentro de ±7 dias da data de emissão da NF
        - Pagamento ainda não vinculado a outra NF

    Se múltiplos pagamentos satisfazem os critérios, escolhe o mais
    próximo em data.
    """

    VALUE_TOLERANCE = 0.01  # R$ 0,01
    DATE_TOLERANCE_DAYS = 7

    def preview(self, parse_result: NfsePdfParseResult) -> ReconciliationReport:
        """
        Dry-run: retorna relatório de matching sem alterar o banco.

        Args:
            parse_result: Resultado do parsing do PDF.

        Returns:
            ReconciliationReport com matches encontrados.
        """
        return self._reconcile(parse_result, apply=False)

    def apply(self, parse_result: NfsePdfParseResult) -> ReconciliationReport:
        """
        Efetiva vinculações no banco.

        Args:
            parse_result: Resultado do parsing do PDF.

        Returns:
            ReconciliationReport com matches aplicados.
        """
        return self._reconcile(parse_result, apply=True)

    def _reconcile(
        self, parse_result: NfsePdfParseResult, *, apply: bool
    ) -> ReconciliationReport:
        """Lógica principal de reconciliação."""
        report = ReconciliationReport(
            total_nfse_processadas=parse_result.total_notas_emitidas,
            total_nfse_normais=len(parse_result.registros_normais),
            total_nfse_canceladas=len(parse_result.registros_cancelados),
            errors=list(parse_result.erros),
        )

        # Só processa NFS-e com status NORMAL
        normais = parse_result.registros_normais
        if not normais:
            report.errors.append("Nenhuma NFS-e com status NORMAL encontrada.")
            return report

        # IDs de pagamentos já usados neste batch (evita duplicata)
        used_payment_ids: set[int] = set()

        for nfse in normais:
            try:
                result = self._match_single(nfse, used_payment_ids)

                if result.already_linked:
                    report.already_linked.append(result)
                elif result.matched:
                    report.matched.append(result)
                    used_payment_ids.add(result.pagamento_id)
                else:
                    report.unmatched.append(result)

            except Exception as exc:
                report.errors.append(f"Erro ao processar NF {nfse.numero}: {exc}")

        # Aplicar vinculações se solicitado
        if apply and report.matched:
            report.applied = self._apply_matches(report.matched)

        return report

    def _match_single(self, nfse: NfseRecord, used_ids: set[int]) -> MatchResult:
        """Tenta encontrar um pagamento correspondente a uma NFS-e."""
        base = MatchResult(
            nfse_numero=nfse.numero,
            nfse_data=nfse.data_emissao,
            nfse_documento=nfse.documento_tomador,
            nfse_nome=nfse.nome_tomador,
            nfse_valor=nfse.valor_nf,
        )

        # Buscar pagamentos candidatos por CPF/CNPJ
        candidates = self._find_candidates(nfse)

        if not candidates:
            return MatchResult(
                **{
                    **base.__dict__,
                    "reason": "Nenhum pagamento encontrado para este CPF/CNPJ",
                }
            )

        # Filtrar por valor (com tolerância)
        value_matches = [
            p
            for p in candidates
            if abs(float(p.valor or 0) - nfse.valor_nf) <= self.VALUE_TOLERANCE
        ]

        if not value_matches:
            return MatchResult(
                **{
                    **base.__dict__,
                    "reason": "CPF/CNPJ encontrado, mas nenhum pagamento com valor compatível",
                }
            )

        # Filtrar por data (±7 dias)
        date_matches = [
            p
            for p in value_matches
            if p.data
            and abs((p.data - nfse.data_emissao).days) <= self.DATE_TOLERANCE_DAYS
        ]

        pool = date_matches if date_matches else value_matches

        # Priorizar: já vinculados > não usados neste batch > mais próximo em data
        best = None
        for p in sorted(
            pool,
            key=lambda x: abs((x.data - nfse.data_emissao).days) if x.data else 999,
        ):
            # Já vinculado a esta mesma NF?
            if p.vinculado_nota_fiscal and p.numero_nota_fiscal == str(nfse.numero):
                return MatchResult(
                    **{
                        **base.__dict__,
                        "pagamento_id": p.id,
                        "pagamento_valor": float(p.valor or 0),
                        "pagamento_nome": p.nome_do_paciente
                        or p.nome_empresa
                        or p.nome_convenio,
                        "already_linked": True,
                        "reason": "Já vinculado a esta NF",
                    }
                )

            # Já vinculado a outra NF?
            if p.vinculado_nota_fiscal and p.numero_nota_fiscal:
                continue

            # Já usado neste batch?
            if p.id in used_ids:
                continue

            if best is None:
                best = p

        if not best:
            return MatchResult(
                **{
                    **base.__dict__,
                    "reason": "Pagamentos encontrados, mas todos já vinculados a outras NFs",
                }
            )

        return MatchResult(
            **{
                **base.__dict__,
                "pagamento_id": best.id,
                "pagamento_valor": float(best.valor or 0),
                "pagamento_nome": best.nome_do_paciente
                or best.nome_empresa
                or best.nome_convenio,
                "matched": True,
                "reason": "Match por CPF/CNPJ + valor"
                + (" + data" if date_matches else " (sem filtro de data)"),
            }
        )

    def _find_candidates(self, nfse: NfseRecord) -> list[Pagamentos]:
        """Busca pagamentos candidatos por CPF ou CNPJ."""
        doc = nfse.documento_tomador

        if nfse.is_cpf:
            return Pagamentos.query.filter(Pagamentos.cpf == doc).all()

        # CNPJ: buscar por empresa_id ou convenio_id
        from app.models.companies_model import Empresas
        from app.models.insurances_model import Convenios

        results = []

        cnpj_int = int(doc) if doc.isdigit() else None
        if cnpj_int:
            empresa = Empresas.query.filter_by(cnpj=cnpj_int).first()
            if empresa:
                results.extend(
                    Pagamentos.query.filter(Pagamentos.empresa_id == empresa.id).all()
                )

            convenio = Convenios.query.filter_by(cnpj=cnpj_int).first()
            if convenio:
                results.extend(
                    Pagamentos.query.filter(Pagamentos.convenio_id == convenio.id).all()
                )

        return results

    @staticmethod
    def _apply_matches(matches: list[MatchResult]) -> int:
        """Persiste vinculações no banco. Retorna quantidade aplicada."""
        applied = 0

        for match in matches:
            if not match.pagamento_id or not match.matched:
                continue

            pagamento = Pagamentos.query.get(match.pagamento_id)
            if not pagamento:
                continue

            pagamento.vinculado_nota_fiscal = True
            pagamento.numero_nota_fiscal = str(match.nfse_numero)

            applied += 1

        if applied > 0:
            try:
                db.session.commit()
                current_app.logger.info(
                    "[NFS-e Reconciliation] %d vinculações aplicadas.", applied
                )
            except Exception as exc:
                db.session.rollback()
                current_app.logger.error(
                    "[NFS-e Reconciliation] Erro ao persistir: %s", exc, exc_info=True
                )
                raise

        return applied
