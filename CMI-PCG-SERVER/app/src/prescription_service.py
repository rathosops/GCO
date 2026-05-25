"""
Serviço de Receituários Médicos.

Responsabilidades:
- Criar receituários com validação de regras (tipo, validade, controlados)
- Dispensar itens do estoque (FEFO automático para amostras grátis)
- Cancelar receituários
- Verificar disponibilidade no estoque interno
- Calcular validade conforme tipo de receita

Regras de negócio:
- Receita SIMPLES: 30 dias, 1 via
- Receita CONTROLE_ESPECIAL: 30 dias, 2 vias, CRM obrigatório
- Receita ANTIMICROBIANO: 10 dias, 2 vias, retenção
- Amostra grátis: dispensação via estoque com movimentação registrada
- Medicamento externo: nome livre, sem vínculo com estoque
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from flask import current_app

from app.database import db
from app.models.doctors_model import Medicos
from app.models.medications_model import Medicamentos
from app.models.patients_model import Pacientes
from app.models.prescriptions_model import (
    TIPOS_RECEITA,
    Receituarios,
)
from app.models.prescription_items_model import ReceituarioItens
from app.utils.timezone import get_now_sao_paulo, get_today_sao_paulo


# ── Exceções ─────────────────────────────────────────────────────────────


class PrescricaoError(Exception):
    """Erro de regra de negócio em receituário."""


class PrescricaoValidacaoError(PrescricaoError):
    """Erro de validação de dados."""


class PrescricaoDispensacaoError(PrescricaoError):
    """Erro ao dispensar item do estoque."""


# ── Serviço ──────────────────────────────────────────────────────────────


class PrescriptionService:
    """Serviço central de receituários médicos."""

    # ── Criação ──────────────────────────────────────────────────────

    def criar_receituario(
        self,
        *,
        cpf_paciente: str,
        crm_medico: int,
        tipo_receita: str = "SIMPLES",
        itens: list[dict],
        consulta_id: int | None = None,
        observacoes_gerais: str | None = None,
        orientacoes_paciente: str | None = None,
        validade_dias: int | None = None,
    ) -> Receituarios:
        """
        Cria um receituário médico completo com itens.

        Args:
            cpf_paciente: CPF do paciente (11 dígitos)
            crm_medico: CRM do médico prescritor
            tipo_receita: SIMPLES, CONTROLE_ESPECIAL ou ANTIMICROBIANO
            itens: Lista de dicts com dados de cada medicamento
            consulta_id: ID da consulta vinculada (opcional)
            observacoes_gerais: Observações do prescritor
            orientacoes_paciente: Orientações ao paciente
            validade_dias: Override da validade padrão

        Returns:
            Receituário criado com itens.
        """
        # Validações
        self._validar_tipo_receita(tipo_receita)
        self._validar_paciente(cpf_paciente)
        self._validar_medico(crm_medico)

        if not itens:
            raise PrescricaoValidacaoError("Receituário deve conter ao menos um item.")

        # Validar itens controlados vs tipo de receita
        self._validar_itens_vs_tipo(itens, tipo_receita)

        # Calcular datas
        hoje = get_today_sao_paulo()
        config_tipo = TIPOS_RECEITA[tipo_receita]
        dias_validade = validade_dias or config_tipo["validade_padrao"]
        data_validade = hoje + timedelta(days=dias_validade)

        # Criar receituário
        receituario = Receituarios(
            cpf_paciente=cpf_paciente,
            crm_medico=crm_medico,
            consulta_id=consulta_id,
            tipo_receita=tipo_receita,
            data_prescricao=hoje,
            validade_dias=dias_validade,
            data_validade=data_validade,
            observacoes_gerais=observacoes_gerais,
            orientacoes_paciente=orientacoes_paciente,
            numero_vias=config_tipo["vias"],
            status="ATIVA",
        )

        db.session.add(receituario)
        db.session.flush()  # Gera o ID

        # Criar itens
        for idx, item_data in enumerate(itens, start=1):
            item = self._criar_item(receituario.id, item_data, ordem=idx)
            db.session.add(item)

        db.session.commit()

        # Recarrega com relacionamentos
        db.session.refresh(receituario)
        return receituario

    # ── Dispensação ──────────────────────────────────────────────────

    def dispensar_item(
        self,
        item_id: int,
        *,
        quantidade: int | None = None,
        lote_id: int | None = None,
    ) -> ReceituarioItens:
        """
        Dispensa um item do receituário via farmácia interna.

        Se lote_id for fornecido, usa esse lote específico.
        Se não, usa FEFO automático para o medicamento.

        Para amostras grátis, registra movimentação no estoque.
        """
        item = ReceituarioItens.query.get(item_id)
        if not item:
            raise PrescricaoError("Item não encontrado.")

        if item.dispensado:
            raise PrescricaoDispensacaoError("Item já foi dispensado.")

        receituario = item.receituario
        if not receituario or receituario.status_efetivo != "ATIVA":
            raise PrescricaoDispensacaoError(
                "Receituário não está ativo para dispensação."
            )

        if not item.medicamento_id:
            raise PrescricaoDispensacaoError(
                "Item não possui medicamento do estoque vinculado. "
                "Dispensação manual apenas para medicamentos internos."
            )

        qtd = quantidade or item.quantidade or 1

        # Dispensar via stock_service
        from app.src.stock_service import stock_service

        if lote_id:
            mov = stock_service.registrar_dispensacao(
                lote_id=lote_id,
                quantidade=qtd,
                cpf_paciente=receituario.cpf_paciente,
                consulta_id=receituario.consulta_id,
                crm_medico_prescritor=receituario.crm_medico,
                observacoes=(
                    f"Receituário #{receituario.id} - "
                    f"{'Amostra grátis' if item.is_amostra_gratis else 'Dispensação'}"
                ),
            )
            item.dispensado_lote_id = lote_id
        else:
            movs = stock_service.dispensar_fefo(
                medicamento_id=item.medicamento_id,
                quantidade=qtd,
                cpf_paciente=receituario.cpf_paciente,
                consulta_id=receituario.consulta_id,
                crm_medico_prescritor=receituario.crm_medico,
                observacoes=(
                    f"Receituário #{receituario.id} - "
                    f"{'Amostra grátis' if item.is_amostra_gratis else 'Dispensação'}"
                ),
            )
            if movs:
                item.dispensado_lote_id = movs[0].lote_id

        item.dispensado = True
        item.dispensado_quantidade = qtd
        item.dispensado_em = get_now_sao_paulo()

        # Verificar se todos os itens foram dispensados
        self._atualizar_status_dispensacao(receituario)

        db.session.commit()
        return item

    # ── Cancelamento ─────────────────────────────────────────────────

    def cancelar_receituario(
        self,
        receituario_id: int,
        *,
        motivo: str,
    ) -> Receituarios:
        """Cancela um receituário."""
        receituario = Receituarios.query.get(receituario_id)
        if not receituario:
            raise PrescricaoError("Receituário não encontrado.")

        if receituario.status != "ATIVA":
            raise PrescricaoError(
                f"Receituário com status '{receituario.status}' não pode ser cancelado."
            )

        if not motivo or not motivo.strip():
            raise PrescricaoValidacaoError("Motivo de cancelamento é obrigatório.")

        receituario.status = "CANCELADA"
        receituario.motivo_cancelamento = motivo.strip()
        db.session.commit()

        return receituario

    # ── Consultas ────────────────────────────────────────────────────

    def verificar_disponibilidade_estoque(self, medicamento_id: int) -> dict:
        """Verifica disponibilidade no estoque para um medicamento."""
        med = Medicamentos.query.get(medicamento_id)
        if not med:
            return {"disponivel": False, "motivo": "Medicamento não encontrado"}

        total = med.estoque_total
        return {
            "disponivel": total > 0,
            "medicamento_id": med.id,
            "nome": med.nome_comercial,
            "estoque_total": total,
            "is_controlado": med.is_controlado,
            "requer_receita_especial": med.requer_receita_especial,
        }

    # ── Helpers privados ─────────────────────────────────────────────

    @staticmethod
    def _validar_tipo_receita(tipo: str) -> None:
        """Valida tipo de receita."""
        if tipo not in TIPOS_RECEITA:
            raise PrescricaoValidacaoError(
                f"Tipo de receita inválido: '{tipo}'. "
                f"Válidos: {', '.join(TIPOS_RECEITA.keys())}"
            )

    @staticmethod
    def _validar_paciente(cpf: str) -> None:
        """Valida existência do paciente."""
        if not Pacientes.query.filter(Pacientes.cpf == cpf).first():
            raise PrescricaoValidacaoError("Paciente não encontrado.")

    @staticmethod
    def _validar_medico(crm: int) -> None:
        """Valida existência do médico."""
        if not Medicos.query.filter(Medicos.crm == crm).first():
            raise PrescricaoValidacaoError("Médico não encontrado.")

    def _validar_itens_vs_tipo(self, itens: list[dict], tipo_receita: str) -> None:
        """
        Valida se os itens são compatíveis com o tipo de receita.

        Controlados só podem estar em receitas CONTROLE_ESPECIAL.
        """
        for item_data in itens:
            med_id = item_data.get("medicamento_id")
            if not med_id:
                continue

            med = Medicamentos.query.get(med_id)
            if not med:
                continue

            if med.is_controlado and tipo_receita != "CONTROLE_ESPECIAL":
                raise PrescricaoValidacaoError(
                    f"Medicamento '{med.nome_comercial}' é controlado "
                    f"({med.classificacao_anvisa}) e requer receita de "
                    f"Controle Especial."
                )

    def _criar_item(
        self,
        receituario_id: int,
        data: dict,
        *,
        ordem: int = 1,
    ) -> ReceituarioItens:
        """Cria um item de receituário a partir de um dict."""
        nome = (data.get("nome_medicamento") or "").strip()
        posologia = (data.get("posologia") or "").strip()

        if not nome:
            raise PrescricaoValidacaoError(
                "Nome do medicamento é obrigatório em cada item."
            )
        if not posologia:
            raise PrescricaoValidacaoError("Posologia é obrigatória em cada item.")

        # Se medicamento_id fornecido, preenche dados do estoque
        med_id = data.get("medicamento_id")
        principio_ativo = (data.get("principio_ativo") or "").strip() or None
        concentracao = (data.get("concentracao") or "").strip() or None
        forma_farm = (data.get("forma_farmaceutica") or "").strip() or None

        if med_id:
            med = Medicamentos.query.get(med_id)
            if med:
                principio_ativo = principio_ativo or med.principio_ativo
                concentracao = concentracao or med.concentracao
                forma_farm = forma_farm or med.forma_farmaceutica

        return ReceituarioItens(
            receituario_id=receituario_id,
            medicamento_id=med_id,
            nome_medicamento=nome,
            principio_ativo=principio_ativo,
            concentracao=concentracao,
            forma_farmaceutica=forma_farm,
            via_administracao=((data.get("via_administracao") or "").strip() or None),
            posologia=posologia,
            quantidade=data.get("quantidade"),
            unidade_quantidade=((data.get("unidade_quantidade") or "").strip() or None),
            duracao_dias=data.get("duracao_dias"),
            uso_continuo=bool(data.get("uso_continuo")),
            is_amostra_gratis=bool(data.get("is_amostra_gratis")),
            ordem=ordem,
            observacoes=(data.get("observacoes") or "").strip() or None,
        )

    @staticmethod
    def _atualizar_status_dispensacao(receituario: Receituarios) -> None:
        """Marca receituário como DISPENSADA se todos os itens foram."""
        if not receituario.itens:
            return

        todos_dispensados = all(i.dispensado for i in receituario.itens)
        if todos_dispensados:
            receituario.status = "DISPENSADA"


# Instância global
prescription_service = PrescriptionService()
