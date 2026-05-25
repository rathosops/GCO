"""
Service layer para o módulo de empresas.

Responsabilidades:
- Lógica de negócio de empresas, setores, cargos e vínculos
- Pré-preenchimento de dados para ASO com base no cargo/setor
- Consultas otimizadas de trabalhadores por empresa
- Verificação de periódicos vencidos/a vencer
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from dateutil.relativedelta import relativedelta
from sqlalchemy import or_

from app.database import db
from app.models.aso_request_model import SolicitacoesDeAso
from app.models.companies_model import Empresas
from app.models.company_positions_model import CargosEmpresa
from app.models.company_sectors_model import SetoresEmpresa
from app.models.employee_bonds_model import VinculosEmpregado
from app.models.patients_model import Pacientes

logger = logging.getLogger(__name__)


def _normalize_status(status: str | None) -> str | None:
    if not status:
        return None
    return str(status).strip().upper()


def _safe_like(term: str) -> str:
    return f"%{term.strip()}%"


def _legacy_worker_dict(empresa_id: int, paciente: Pacientes) -> dict[str, Any]:
    """
    Serializa paciente legado no 'formato de trabalhador'.

    Mantém id inteiro (negativo) para evitar colisão com VinculosEmpregado.id.
    """
    return {
        "id": -int(paciente.id),
        "legacy": True,
        "status": "LEGADO",
        "empresa_id": empresa_id,
        "paciente_id": paciente.id,
        "paciente": {
            "id": paciente.id,
            "nome": paciente.nome,
            "cpf": paciente.cpf,
        },
        "cargo": None,
        "setor": None,
        "funcao": None,
        "matricula": None,
        "data_admissao": None,
        "data_desligamento": None,
    }


class CompanyService:
    """Serviço central do módulo de empresas."""

    # ── Pré-preenchimento de ASO ─────────────────────────────────────

    @staticmethod
    def get_aso_prefill(vinculo_id: int) -> dict[str, Any] | None:
        """
        Retorna dados pré-preenchidos para geração de ASO
        com base no vínculo empregatício.

        Merge de riscos: setor + cargo.
        Exames e NRs vêm do cargo.

        Returns:
            Dict com dados prontos para o formulário de ASO, ou None.
        """
        vinculo = VinculosEmpregado.query.options(
            db.joinedload(VinculosEmpregado.cargo),
            db.joinedload(VinculosEmpregado.setor),
            db.joinedload(VinculosEmpregado.paciente),
            db.joinedload(VinculosEmpregado.empresa),
        ).get(vinculo_id)

        if not vinculo:
            return None

        cargo = vinculo.cargo
        setor = vinculo.setor

        # Merge de riscos: setor (base) + cargo (override)
        riscos = dict(setor.riscos_ocupacionais or {}) if setor else {}
        if cargo:
            for chave, valor in (cargo.riscos_ocupacionais or {}).items():
                if valor:
                    riscos[chave] = valor

        return {
            "paciente": {
                "id": vinculo.paciente_id,
                "nome": vinculo.paciente.nome if vinculo.paciente else "",
                "cpf": vinculo.paciente.cpf if vinculo.paciente else "",
            },
            "empresa": {
                "id": vinculo.empresa_id,
                "nome": vinculo.empresa.nome if vinculo.empresa else "",
                "cnpj": vinculo.empresa.cnpj if vinculo.empresa else "",
                "razao_social": vinculo.empresa.razao_social if vinculo.empresa else "",
            },
            "funcao_do_paciente": vinculo.funcao,
            "setor": setor.nome if setor else "",
            "riscos": riscos,
            "exames_sugeridos": cargo.exames_obrigatorios if cargo else {},
            "nrs": cargo.nrs_aplicaveis if cargo else {},
            "manipulacao_de_alimentos": (
                "Sim" if cargo and cargo.manipula_alimentos else ""
            ),
            "vinculo_id": vinculo.id,
            "matricula": vinculo.matricula,
        }

    # ── Trabalhadores por empresa ────────────────────────────────────

    @staticmethod
    def get_trabalhadores(
        empresa_id: int,
        *,
        status: str | None = "ATIVO",
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        """
        Lista trabalhadores vinculados a uma empresa.

        Novo:
          - VinculosEmpregado (ocupacional)
        Legado:
          - Pacientes.cnpj_empresa (FK para Empresas.cnpj)

        Regras:
          - status=None ('todos') => inclui novo (todas as situações) + legado
          - status='LEGADO'       => apenas legado
          - status='ATIVO' etc    => apenas novo filtrado por status
        """
        status_norm = _normalize_status(status)
        include_legacy = status_norm is None or status_norm == "LEGADO"

        empresa = Empresas.query.get(empresa_id)
        if not empresa:
            return {"total": 0, "limit": limit, "offset": offset, "trabalhadores": []}

        term = (search or "").strip()
        has_search = bool(term)

        # ---------------------------------------------------------------------
        # Caminho otimizado (sem legado): mantém paginação no banco
        # ---------------------------------------------------------------------
        if not include_legacy:
            query = VinculosEmpregado.query.filter(
                VinculosEmpregado.empresa_id == empresa_id
            ).options(
                db.joinedload(VinculosEmpregado.paciente),
                db.joinedload(VinculosEmpregado.cargo),
                db.joinedload(VinculosEmpregado.setor),
            )

            if status_norm:
                query = query.filter(VinculosEmpregado.status == status_norm)

            if has_search:
                like = _safe_like(term)
                query = query.join(Pacientes).filter(
                    or_(
                        Pacientes.nome.ilike(like),
                        Pacientes.cpf.ilike(like),
                    )
                )

            total = query.count()
            vinculos = (
                query.order_by(VinculosEmpregado.funcao.asc())
                .offset(offset)
                .limit(limit)
                .all()
            )

            return {
                "total": total,
                "limit": limit,
                "offset": offset,
                "trabalhadores": [v.to_dict(include_relations=True) for v in vinculos],
            }

        # ---------------------------------------------------------------------
        # Caminho unificado (inclui legado): merge + dedupe + paginação em Python
        # ---------------------------------------------------------------------
        workers: list[dict[str, Any]] = []

        # Novo (se não for apenas LEGADO)
        vinculos: list[VinculosEmpregado] = []
        if status_norm != "LEGADO":
            qv = VinculosEmpregado.query.filter(
                VinculosEmpregado.empresa_id == empresa_id
            ).options(
                db.joinedload(VinculosEmpregado.paciente),
                db.joinedload(VinculosEmpregado.cargo),
                db.joinedload(VinculosEmpregado.setor),
            )
            if has_search:
                like = _safe_like(term)
                qv = qv.join(Pacientes).filter(
                    or_(
                        Pacientes.nome.ilike(like),
                        Pacientes.cpf.ilike(like),
                    )
                )
            vinculos = qv.order_by(VinculosEmpregado.funcao.asc()).all()
            workers.extend([v.to_dict(include_relations=True) for v in vinculos])

        # Legado
        ql = Pacientes.query.filter(Pacientes.cnpj_empresa == empresa.cnpj)
        if has_search:
            like = _safe_like(term)
            ql = ql.filter(
                or_(
                    Pacientes.nome.ilike(like),
                    Pacientes.cpf.ilike(like),
                )
            )

        legacy_pacientes = ql.order_by(Pacientes.nome.asc()).all()

        # Dedupe: se paciente já tem vínculo novo, não entra como legado
        vinculados_ids = {v.paciente_id for v in vinculos if v and v.paciente_id}
        for p in legacy_pacientes:
            if p.id in vinculados_ids:
                continue
            workers.append(_legacy_worker_dict(empresa_id, p))

        # Ordenação simples e previsível
        def sort_key(item: dict[str, Any]) -> str:
            paciente = item.get("paciente") or {}
            nome = paciente.get("nome") or ""
            funcao = item.get("funcao") or ""
            return f"{nome}::{funcao}".lower()

        workers.sort(key=sort_key)

        total = len(workers)
        page = workers[offset : offset + limit]

        return {"total": total, "limit": limit, "offset": offset, "trabalhadores": page}

    @staticmethod
    def get_periodicos_pendentes(
        empresa_id: int, dias_antecedencia: int = 30
    ) -> list[dict[str, Any]]:
        """Retorna trabalhadores com exame periódico vencido ou a vencer."""
        vinculos = (
            VinculosEmpregado.query.filter(
                VinculosEmpregado.empresa_id == empresa_id,
                VinculosEmpregado.status == "ATIVO",
            )
            .options(
                db.joinedload(VinculosEmpregado.paciente),
                db.joinedload(VinculosEmpregado.cargo),
                db.joinedload(VinculosEmpregado.setor),
            )
            .all()
        )

        hoje = date.today()
        resultado: list[dict[str, Any]] = []

        for vinculo in vinculos:
            if not vinculo.paciente or not vinculo.paciente.cpf:
                continue

            periodicidade = 12
            if vinculo.cargo and vinculo.cargo.periodicidade_meses:
                periodicidade = vinculo.cargo.periodicidade_meses

            # Último ASO periódico do trabalhador nesta empresa
            ultimo_aso = (
                SolicitacoesDeAso.query.filter(
                    SolicitacoesDeAso.cpf_paciente == int(vinculo.paciente.cpf),
                    SolicitacoesDeAso.cnpj_empresa == vinculo.empresa.cnpj,
                    SolicitacoesDeAso.tipo_exame == "PERIODICO",
                )
                .order_by(SolicitacoesDeAso.data.desc())
                .first()
            )

            if ultimo_aso and ultimo_aso.data:
                vencimento = ultimo_aso.data + relativedelta(months=periodicidade)
            else:
                vencimento = vinculo.data_admissao + relativedelta(months=periodicidade)

            dias_para_vencer = (vencimento - hoje).days

            if dias_para_vencer <= dias_antecedencia:
                resultado.append(
                    {
                        "vinculo": vinculo.to_dict(include_relations=True),
                        "ultimo_aso_data": (
                            ultimo_aso.data.isoformat() if ultimo_aso else None
                        ),
                        "vencimento": vencimento.isoformat(),
                        "dias_para_vencer": dias_para_vencer,
                        "vencido": dias_para_vencer < 0,
                        "periodicidade_meses": periodicidade,
                    }
                )

        resultado.sort(key=lambda x: x["dias_para_vencer"])
        return resultado

    # ── Dashboard da empresa ─────────────────────────────────────────

    @staticmethod
    def get_empresa_dashboard(empresa_id: int) -> dict[str, Any] | None:
        """Retorna resumo da empresa para dashboard."""
        empresa = Empresas.query.get(empresa_id)
        if not empresa:
            return None

        total_vinculos = VinculosEmpregado.query.filter(
            VinculosEmpregado.empresa_id == empresa_id
        ).count()
        ativos = VinculosEmpregado.query.filter(
            VinculosEmpregado.empresa_id == empresa_id,
            VinculosEmpregado.status == "ATIVO",
        ).count()

        total_setores = empresa.setores.filter(SetoresEmpresa.ativo.is_(True)).count()
        total_cargos = empresa.cargos.filter(CargosEmpresa.ativo.is_(True)).count()

        total_asos = SolicitacoesDeAso.query.filter(
            SolicitacoesDeAso.cnpj_empresa == empresa.cnpj
        ).count()

        return {
            "empresa": empresa.to_dict(),
            "totais": {
                "trabalhadores_total": total_vinculos,
                "trabalhadores_ativos": ativos,
                "setores": total_setores,
                "cargos": total_cargos,
                "asos_emitidos": total_asos,
            },
        }


# Instância global
company_service = CompanyService()
