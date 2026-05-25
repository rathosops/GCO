"""
Serviço de Controle de Estoque de Medicamentos.

Responsabilidades:
- Registrar movimentações (entrada, saída, dispensação, ajuste, descarte)
- Garantir FEFO (First Expired, First Out) na dispensação
- Alertas de validade e estoque mínimo
- Dashboard de status do estoque
- Validações de regra de negócio (controlados, vencidos, etc.)

Princípios:
- Toda alteração de quantidade passa por este service (nunca direto no model)
- Movimentações são imutáveis (log append-only)
- Lote vencido é bloqueado para dispensação automaticamente
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from flask import current_app
from sqlalchemy import and_, func

from app.database import db
from app.models.medication_batches_model import (
    COR_LARANJA,
    COR_VERDE,
    COR_VERMELHO,
    COR_VENCIDO,
    LIMITE_LARANJA_DIAS,
    LIMITE_VERDE_DIAS,
    MedicamentoLotes,
    calcular_cor_validade,
)
from app.models.medications_model import Medicamentos
from app.models.stock_movements_model import (
    TIPOS_ENTRADA,
    TIPOS_SAIDA,
    MovimentacoesEstoque,
)
from app.utils.timezone import get_today_sao_paulo


# ── Exceções do módulo ───────────────────────────────────────────────────


class EstoqueError(Exception):
    """Erro de regra de negócio do estoque."""


class EstoqueInsuficienteError(EstoqueError):
    """Quantidade solicitada maior que disponível no lote."""


class LoteVencidoError(EstoqueError):
    """Tentativa de dispensar lote vencido."""


class LoteInativoError(EstoqueError):
    """Tentativa de operar em lote desativado."""


class MedicamentoControladoError(EstoqueError):
    """Dispensação de controlado sem CRM prescritor."""


# ── Dataclasses de resultado ─────────────────────────────────────────────


@dataclass(frozen=True)
class AlertaEstoque:
    """Alerta de estoque (validade ou quantidade)."""

    medicamento_id: int
    medicamento_nome: str
    tipo_alerta: str  # VENCIDO, PROXIMO_VENCER, ABAIXO_MINIMO
    detalhe: str
    urgencia: str  # CRITICA, ALTA, MEDIA
    lote_id: int | None = None
    numero_lote: str | None = None
    dias_para_vencer: int | None = None
    cor: str | None = None


# ── Serviço principal ────────────────────────────────────────────────────


class StockService:
    """Serviço central de controle de estoque."""

    # ── Movimentações ────────────────────────────────────────────────

    def registrar_entrada(
        self,
        lote_id: int,
        quantidade: int,
        *,
        fornecedor_id: int | None = None,
        nota_fiscal: str | None = None,
        observacoes: str | None = None,
    ) -> MovimentacoesEstoque:
        """Registra entrada de medicamentos no estoque."""
        return self._registrar_movimentacao(
            lote_id=lote_id,
            tipo="ENTRADA",
            quantidade=quantidade,
            fornecedor_id=fornecedor_id,
            nota_fiscal=nota_fiscal,
            observacoes=observacoes,
        )

    def registrar_dispensacao(
        self,
        lote_id: int,
        quantidade: int,
        *,
        cpf_paciente: str,
        consulta_id: int | None = None,
        crm_medico_prescritor: int | None = None,
        observacoes: str | None = None,
    ) -> MovimentacoesEstoque:
        """
        Registra dispensação de medicamento a paciente.

        Valida:
        - Lote ativo e não vencido
        - Estoque suficiente
        - CRM obrigatório para controlados
        """
        lote = self._get_lote_or_raise(lote_id)

        # Controlado exige CRM
        if lote.medicamento and lote.medicamento.requer_receita_especial:
            if not crm_medico_prescritor:
                raise MedicamentoControladoError(
                    "Medicamento controlado exige CRM do médico prescritor."
                )

        return self._registrar_movimentacao(
            lote_id=lote_id,
            tipo="DISPENSACAO",
            quantidade=quantidade,
            cpf_paciente=cpf_paciente,
            consulta_id=consulta_id,
            crm_medico_prescritor=crm_medico_prescritor,
            observacoes=observacoes,
        )

    def dispensar_fefo(
        self,
        medicamento_id: int,
        quantidade: int,
        *,
        cpf_paciente: str,
        consulta_id: int | None = None,
        crm_medico_prescritor: int | None = None,
        observacoes: str | None = None,
    ) -> list[MovimentacoesEstoque]:
        """
        Dispensa usando FEFO (First Expired, First Out).

        Seleciona automaticamente os lotes com validade mais próxima
        e distribui a quantidade entre eles se necessário.

        Returns:
            Lista de movimentações criadas.
        """
        hoje = get_today_sao_paulo()

        lotes = (
            MedicamentoLotes.query.filter(
                MedicamentoLotes.medicamento_id == medicamento_id,
                MedicamentoLotes.ativo.is_(True),
                MedicamentoLotes.quantidade_atual > 0,
                MedicamentoLotes.data_validade > hoje,
            )
            .order_by(MedicamentoLotes.data_validade.asc())
            .all()
        )

        total_disponivel = sum(l.quantidade_atual for l in lotes)
        if total_disponivel < quantidade:
            raise EstoqueInsuficienteError(
                f"Estoque insuficiente. Disponível: {total_disponivel}, "
                f"solicitado: {quantidade}."
            )

        movimentacoes: list[MovimentacoesEstoque] = []
        restante = quantidade

        for lote in lotes:
            if restante <= 0:
                break

            qtd_lote = min(restante, lote.quantidade_atual)
            mov = self.registrar_dispensacao(
                lote_id=lote.id,
                quantidade=qtd_lote,
                cpf_paciente=cpf_paciente,
                consulta_id=consulta_id,
                crm_medico_prescritor=crm_medico_prescritor,
                observacoes=observacoes,
            )
            movimentacoes.append(mov)
            restante -= qtd_lote

        return movimentacoes

    def registrar_descarte(
        self,
        lote_id: int,
        quantidade: int,
        *,
        motivo: str,
        observacoes: str | None = None,
    ) -> MovimentacoesEstoque:
        """Registra descarte de medicamentos."""
        return self._registrar_movimentacao(
            lote_id=lote_id,
            tipo="DESCARTE",
            quantidade=quantidade,
            motivo_descarte=motivo,
            observacoes=observacoes,
        )

    def registrar_ajuste(
        self,
        lote_id: int,
        quantidade: int,
        *,
        positivo: bool,
        observacoes: str | None = None,
    ) -> MovimentacoesEstoque:
        """Registra ajuste de inventário (positivo ou negativo)."""
        tipo = "AJUSTE_POS" if positivo else "AJUSTE_NEG"
        return self._registrar_movimentacao(
            lote_id=lote_id,
            tipo=tipo,
            quantidade=quantidade,
            observacoes=observacoes,
        )

    # ── Método core de movimentação ──────────────────────────────────

    def _registrar_movimentacao(
        self,
        *,
        lote_id: int,
        tipo: str,
        quantidade: int,
        cpf_paciente: str | None = None,
        consulta_id: int | None = None,
        crm_medico_prescritor: int | None = None,
        fornecedor_id: int | None = None,
        nota_fiscal: str | None = None,
        motivo_descarte: str | None = None,
        observacoes: str | None = None,
    ) -> MovimentacoesEstoque:
        """
        Registra movimentação e atualiza quantidade do lote.

        Este é o único ponto que altera quantidade_atual do lote.
        """
        if quantidade <= 0:
            raise EstoqueError("Quantidade deve ser maior que zero.")

        lote = self._get_lote_or_raise(lote_id)
        saldo_anterior = lote.quantidade_atual

        # Calcular novo saldo
        if tipo in TIPOS_ENTRADA:
            novo_saldo = saldo_anterior + quantidade
        elif tipo in TIPOS_SAIDA:
            if saldo_anterior < quantidade:
                raise EstoqueInsuficienteError(
                    f"Estoque insuficiente no lote {lote.numero_lote}. "
                    f"Disponível: {saldo_anterior}, solicitado: {quantidade}."
                )
            # Bloquear dispensação de vencido
            if tipo == "DISPENSACAO" and lote.vencido:
                raise LoteVencidoError(
                    f"Lote {lote.numero_lote} está vencido ({lote.data_validade})."
                )
            novo_saldo = saldo_anterior - quantidade
        else:
            raise EstoqueError(f"Tipo de movimentação desconhecido: {tipo}")

        # Criar movimentação
        movimentacao = MovimentacoesEstoque(
            lote_id=lote_id,
            tipo=tipo,
            quantidade=quantidade,
            saldo_anterior=saldo_anterior,
            saldo_posterior=novo_saldo,
            data_movimentacao=get_today_sao_paulo(),
            cpf_paciente=cpf_paciente,
            consulta_id=consulta_id,
            crm_medico_prescritor=crm_medico_prescritor,
            fornecedor_id=fornecedor_id,
            nota_fiscal=nota_fiscal,
            motivo_descarte=motivo_descarte,
            observacoes=observacoes,
        )

        # Atualizar saldo do lote
        lote.quantidade_atual = novo_saldo

        # Desativar lote se zerou
        if novo_saldo == 0 and tipo in TIPOS_SAIDA:
            lote.ativo = False

        db.session.add(movimentacao)
        db.session.commit()

        return movimentacao

    # ── Alertas ──────────────────────────────────────────────────────

    def get_alertas(self) -> list[AlertaEstoque]:
        """
        Retorna todos os alertas ativos do estoque.

        Tipos:
        - VENCIDO: lotes com validade expirada e estoque > 0
        - PROXIMO_VENCER: lotes com < 90 dias para vencer
        - ABAIXO_MINIMO: medicamentos com estoque total < mínimo
        """
        alertas: list[AlertaEstoque] = []
        hoje = get_today_sao_paulo()

        # Lotes vencidos com estoque
        vencidos = (
            MedicamentoLotes.query.join(Medicamentos)
            .filter(
                MedicamentoLotes.ativo.is_(True),
                MedicamentoLotes.quantidade_atual > 0,
                MedicamentoLotes.data_validade <= hoje,
            )
            .all()
        )
        for lote in vencidos:
            alertas.append(
                AlertaEstoque(
                    medicamento_id=lote.medicamento_id,
                    medicamento_nome=lote.medicamento.nome_comercial,
                    tipo_alerta="VENCIDO",
                    detalhe=f"Lote {lote.numero_lote} venceu em {lote.data_validade.strftime('%d/%m/%Y')}. Qtd: {lote.quantidade_atual}",
                    urgencia="CRITICA",
                    lote_id=lote.id,
                    numero_lote=lote.numero_lote,
                    dias_para_vencer=lote.dias_para_vencer,
                    cor=COR_VENCIDO,
                )
            )

        # Lotes próximos ao vencimento (< 90 dias)
        from datetime import timedelta

        limite = hoje + timedelta(days=LIMITE_LARANJA_DIAS)

        proximos = (
            MedicamentoLotes.query.join(Medicamentos)
            .filter(
                MedicamentoLotes.ativo.is_(True),
                MedicamentoLotes.quantidade_atual > 0,
                MedicamentoLotes.data_validade > hoje,
                MedicamentoLotes.data_validade <= limite,
            )
            .order_by(MedicamentoLotes.data_validade.asc())
            .all()
        )
        for lote in proximos:
            alertas.append(
                AlertaEstoque(
                    medicamento_id=lote.medicamento_id,
                    medicamento_nome=lote.medicamento.nome_comercial,
                    tipo_alerta="PROXIMO_VENCER",
                    detalhe=f"Lote {lote.numero_lote} vence em {lote.dias_para_vencer} dias ({lote.data_validade.strftime('%d/%m/%Y')})",
                    urgencia="ALTA" if lote.dias_para_vencer < 30 else "MEDIA",
                    lote_id=lote.id,
                    numero_lote=lote.numero_lote,
                    dias_para_vencer=lote.dias_para_vencer,
                    cor=lote.cor_validade,
                )
            )

        # Medicamentos abaixo do estoque mínimo
        medicamentos = Medicamentos.query.filter(Medicamentos.ativo.is_(True)).all()
        for med in medicamentos:
            if med.abaixo_minimo:
                alertas.append(
                    AlertaEstoque(
                        medicamento_id=med.id,
                        medicamento_nome=med.nome_comercial,
                        tipo_alerta="ABAIXO_MINIMO",
                        detalhe=f"Estoque: {med.estoque_total} (mín: {med.estoque_minimo})",
                        urgencia="ALTA" if med.estoque_total == 0 else "MEDIA",
                    )
                )

        return alertas

    # ── Dashboard ────────────────────────────────────────────────────

    def get_dashboard(self) -> dict:
        """Retorna dados consolidados do estoque para o dashboard."""
        hoje = get_today_sao_paulo()

        total_medicamentos = Medicamentos.query.filter(
            Medicamentos.ativo.is_(True)
        ).count()

        total_lotes_ativos = MedicamentoLotes.query.filter(
            MedicamentoLotes.ativo.is_(True),
            MedicamentoLotes.quantidade_atual > 0,
        ).count()

        # Contagem por cor
        lotes_ativos = MedicamentoLotes.query.filter(
            MedicamentoLotes.ativo.is_(True),
            MedicamentoLotes.quantidade_atual > 0,
        ).all()

        por_cor = {COR_VERDE: 0, COR_LARANJA: 0, COR_VERMELHO: 0, COR_VENCIDO: 0}
        for lote in lotes_ativos:
            cor = lote.cor_validade
            por_cor[cor] = por_cor.get(cor, 0) + 1

        # Medicamentos abaixo do mínimo
        medicamentos_ativos = Medicamentos.query.filter(
            Medicamentos.ativo.is_(True)
        ).all()
        abaixo_minimo = sum(1 for m in medicamentos_ativos if m.abaixo_minimo)

        # Valor total do estoque
        valor_total = (
            db.session.query(
                func.coalesce(
                    func.sum(
                        MedicamentoLotes.quantidade_atual
                        * MedicamentoLotes.preco_unitario
                    ),
                    0,
                )
            )
            .filter(
                MedicamentoLotes.ativo.is_(True),
                MedicamentoLotes.quantidade_atual > 0,
            )
            .scalar()
        )

        # Alertas
        alertas = self.get_alertas()

        return {
            "total_medicamentos": total_medicamentos,
            "total_lotes_ativos": total_lotes_ativos,
            "por_cor_validade": por_cor,
            "abaixo_minimo": abaixo_minimo,
            "valor_total_estoque": round(float(valor_total or 0), 2),
            "total_alertas": len(alertas),
            "alertas_criticos": sum(1 for a in alertas if a.urgencia == "CRITICA"),
        }

    # ── Helpers privados ─────────────────────────────────────────────

    @staticmethod
    def _get_lote_or_raise(lote_id: int) -> MedicamentoLotes:
        """Busca lote por ID ou levanta exceção."""
        lote = MedicamentoLotes.query.get(lote_id)
        if not lote:
            raise EstoqueError(f"Lote {lote_id} não encontrado.")
        if not lote.ativo:
            raise LoteInativoError(f"Lote {lote.numero_lote} está inativo.")
        return lote


# Instância global
stock_service = StockService()
