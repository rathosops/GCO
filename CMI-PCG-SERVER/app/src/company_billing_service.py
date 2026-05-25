"""
Serviço de faturamento posterior para empresas conveniadas.

Centraliza a lógica de:
  - Listar empresas com faturamento posterior
  - Consolidar histórico de pacientes (consultas ocupacionais, ASOs, questionários)
  - Calcular valores de cobrança por período
  - Montar contexto para relatórios PDF e recibos

IMPORTANTE — Filtro de consultas:
  Apenas consultas ocupacionais entram no relatório. Consultas particulares
  (clínica geral, retorno, etc.) são excluídas. O filtro é baseado em:
    1. Consultas cujo CPF possui ASO emitido no mesmo período (cross-ref)
    2. Consultas cujo `tipo` contém termos ocupacionais conhecidos

IMPORTANTE — ASO embutido:
  Quando empresa.aso_embutido_na_consulta=True (padrão), os ASOs não geram
  linha de cobrança separada no recibo — o valor já está incluso na consulta.

Princípios: DRY, SRP, KISS.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import and_, func, or_

from app.database import db
from app.models.aso_questionario_model import AsoQuestionario
from app.models.aso_request_model import SolicitacoesDeAso
from app.models.companies_model import Empresas
from app.models.medical_appointments_model import Consultas
from app.models.patients_model import Pacientes

LOGGER = logging.getLogger(__name__)


# =========================================================================
# Constantes — tipos de consulta ocupacional
# =========================================================================

# Termos que identificam consultas ocupacionais no campo `tipo`.
# Busca case-insensitive via ILIKE. Ordem não importa.
TERMOS_OCUPACIONAIS: tuple[str, ...] = (
    "OCUPACIONAL",
    "CONSULTA OCUPACIONAL",
    "EXAME ADMISSIONAL",
    "EXAME PERIODICO",
    "ADMISSIONAL",
    "DEMISSIONAL",
    "PERIODICO",
    "PERIÓDICO",
    "RETORNO AO TRABALHO",
    "RETORNO_AO_TRABALHO",
    "MUDANCA DE FUNCAO",
    "MUDANÇA DE FUNÇÃO",
    "MUDANCA_DE_FUNCAO",
    "PCMSO",
    "ASO",
    "NR-7",
    "NR7",
)


# =========================================================================
# Helpers internos
# =========================================================================


def _only_digits(value: Any) -> str:
    """Extrai apenas dígitos."""
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _fmt_cpf(cpf: Any) -> str:
    """Formata CPF para XXX.XXX.XXX-XX."""
    digits = _only_digits(cpf).zfill(11)
    if len(digits) != 11:
        return str(cpf or "")
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"


def _fmt_cnpj(cnpj: Any) -> str:
    """Formata CNPJ para XX.XXX.XXX/XXXX-XX."""
    digits = _only_digits(cnpj).zfill(14)
    if len(digits) != 14:
        return str(cnpj or "")
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


def _get_logo_path() -> str | None:
    """
    Retorna file:// URI do logo para WeasyPrint.

    Resolve o caminho absoluto a partir de /static/images/logo_cmi.png,
    compatível com a estrutura: app/control/ → ../../static/images/
    """
    base_dir = Path(__file__).resolve().parent.parent.parent
    logo = base_dir / "static" / "images" / "logo_cmi.png"
    if logo.exists():
        return f"file://{logo.absolute()}"
    LOGGER.warning("Logo não encontrado em %s", logo)
    return None


# =========================================================================
# Queries reutilizáveis
# =========================================================================


def _get_pacientes_da_empresa(empresa: Empresas) -> list[Pacientes]:
    """Retorna pacientes vinculados à empresa (via cnpj)."""
    return (
        Pacientes.query.filter(Pacientes.cnpj_empresa == empresa.cnpj)
        .order_by(Pacientes.nome.asc())
        .all()
    )


def _build_filtro_ocupacional():
    """
    Constrói filtro SQLAlchemy que identifica consultas ocupacionais
    pelo campo `tipo` usando ILIKE contra termos conhecidos.
    """
    return or_(*(Consultas.tipo.ilike(f"%{termo}%") for termo in TERMOS_OCUPACIONAIS))


def _get_cpfs_com_aso(
    cpfs: list[str],
    data_inicio: date,
    data_fim: date,
) -> set[str]:
    """
    Retorna conjunto de CPFs que possuem ASO emitido no período.

    Usado como cross-reference: se o paciente tem ASO no período,
    suas consultas nesse período são consideradas ocupacionais.
    """
    if not cpfs:
        return set()

    rows = (
        db.session.query(SolicitacoesDeAso.cpf_paciente)
        .filter(
            SolicitacoesDeAso.cpf_paciente.in_(cpfs),
            SolicitacoesDeAso.data.between(data_inicio, data_fim),
        )
        .distinct()
        .all()
    )
    return {_only_digits(r[0]).zfill(11) for r in rows}


def _get_consultas_ocupacionais(
    cpfs: list[str],
    data_inicio: date,
    data_fim: date,
) -> list[Consultas]:
    """
    Retorna APENAS consultas ocupacionais no período.

    Uma consulta é considerada ocupacional se:
      A) Seu `tipo` contém termos ocupacionais conhecidos (ILIKE), OU
      B) O paciente possui ASO emitido no mesmo período (cross-ref)

    Consultas particulares, retornos clínicos e afins são EXCLUÍDAS.
    """
    if not cpfs:
        return []

    # Conjunto de CPFs com ASO no período (cross-reference)
    cpfs_com_aso = _get_cpfs_com_aso(cpfs, data_inicio, data_fim)

    # Filtro base: CPFs da empresa + período
    base_filter = and_(
        Consultas.cpf_paciente.in_(cpfs),
        Consultas.data.between(data_inicio, data_fim),
    )

    # Filtro ocupacional: tipo contém termos OU paciente tem ASO
    filtro_tipo = _build_filtro_ocupacional()

    if cpfs_com_aso:
        filtro_ocupacional = or_(
            filtro_tipo,
            Consultas.cpf_paciente.in_(list(cpfs_com_aso)),
        )
    else:
        filtro_ocupacional = filtro_tipo

    return (
        Consultas.query.filter(base_filter, filtro_ocupacional)
        .order_by(Consultas.data.desc())
        .all()
    )


def _get_asos_por_cpfs(
    cpfs: list[str],
    data_inicio: date,
    data_fim: date,
) -> list[SolicitacoesDeAso]:
    """ASOs de múltiplos CPFs no período."""
    if not cpfs:
        return []
    return (
        SolicitacoesDeAso.query.filter(
            SolicitacoesDeAso.cpf_paciente.in_(cpfs),
            SolicitacoesDeAso.data.between(data_inicio, data_fim),
        )
        .order_by(SolicitacoesDeAso.data.desc())
        .all()
    )


def _get_questionarios_por_cpfs(cpfs: list[str]) -> list[AsoQuestionario]:
    """Questionários de anamnese de múltiplos CPFs."""
    if not cpfs:
        return []
    return (
        AsoQuestionario.query.filter(AsoQuestionario.cpf_paciente.in_(cpfs))
        .order_by(AsoQuestionario.created_at.desc())
        .all()
    )


def _count_consultas_ocupacionais(
    cpfs: list[str],
    data_inicio: date,
    data_fim: date,
) -> int:
    """Conta consultas ocupacionais (sem carregar objetos — query otimizada)."""
    if not cpfs:
        return 0

    cpfs_com_aso = _get_cpfs_com_aso(cpfs, data_inicio, data_fim)

    base = and_(
        Consultas.cpf_paciente.in_(cpfs),
        Consultas.data.between(data_inicio, data_fim),
    )

    filtro_tipo = _build_filtro_ocupacional()

    if cpfs_com_aso:
        filtro_ocp = or_(
            filtro_tipo,
            Consultas.cpf_paciente.in_(list(cpfs_com_aso)),
        )
    else:
        filtro_ocp = filtro_tipo

    return Consultas.query.filter(base, filtro_ocp).count()


# =========================================================================
# Service público
# =========================================================================


class CompanyBillingService:
    """Serviço de faturamento posterior."""

    # -----------------------------------------------------------------
    # Listagem de empresas com faturamento posterior
    # -----------------------------------------------------------------

    @staticmethod
    def listar_empresas(
        *,
        search: str | None = None,
        ativo: bool | None = True,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Lista empresas com faturamento_posterior=True."""
        query = Empresas.query.filter(Empresas.faturamento_posterior.is_(True))

        if ativo is not None:
            query = query.filter(Empresas.ativo.is_(ativo))

        if search:
            termo = f"%{search}%"
            query = query.filter(
                or_(
                    Empresas.nome.ilike(termo),
                    Empresas.razao_social.ilike(termo),
                )
            )

        total = query.count()
        empresas = (
            query.order_by(Empresas.nome.asc())
            .offset(offset)
            .limit(min(limit, 200))
            .all()
        )

        return {
            "total": total,
            "empresas": [e.to_dict() for e in empresas],
        }

    # -----------------------------------------------------------------
    # Histórico completo de pacientes de uma empresa
    # -----------------------------------------------------------------

    @staticmethod
    def get_pacientes_com_historico(
        empresa_id: int,
        data_inicio: date,
        data_fim: date,
    ) -> dict[str, Any] | None:
        """
        Retorna pacientes da empresa com histórico consolidado no período.

        IMPORTANTE: apenas consultas ocupacionais são incluídas.
        Consultas particulares são filtradas.
        """
        empresa = Empresas.query.get(empresa_id)
        if not empresa:
            return None

        pacientes = _get_pacientes_da_empresa(empresa)
        cpfs = [p.cpf for p in pacientes if p.cpf]

        # Consultas OCUPACIONAIS apenas
        consultas = _get_consultas_ocupacionais(cpfs, data_inicio, data_fim)
        asos = _get_asos_por_cpfs(cpfs, data_inicio, data_fim)
        questionarios = _get_questionarios_por_cpfs(cpfs)

        # Agrupa por CPF
        consultas_por_cpf: dict[str, list] = defaultdict(list)
        for c in consultas:
            consultas_por_cpf[c.cpf_paciente].append(c)

        asos_por_cpf: dict[str, list] = defaultdict(list)
        for a in asos:
            cpf_str = _only_digits(a.cpf_paciente).zfill(11)
            asos_por_cpf[cpf_str].append(a)

        questionarios_por_cpf: dict[str, list] = defaultdict(list)
        for q in questionarios:
            if q.cpf_paciente:
                questionarios_por_cpf[q.cpf_paciente].append(q)

        resultado: list[dict] = []
        for pac in pacientes:
            cpf = pac.cpf
            pac_consultas = consultas_por_cpf.get(cpf, [])
            pac_asos = asos_por_cpf.get(cpf, [])
            pac_questionarios = questionarios_por_cpf.get(cpf, [])

            resultado.append(
                {
                    "id": pac.id,
                    "nome": pac.nome,
                    "cpf": cpf,
                    "cpf_formatado": _fmt_cpf(cpf),
                    "email": pac.email,
                    "telefone": pac.numero_de_contato,
                    "consultas": [
                        {
                            "id": c.id,
                            "data": c.data.isoformat() if c.data else None,
                            "hora": (
                                c.hora_consulta.strftime("%H:%M")
                                if c.hora_consulta
                                else None
                            ),
                            "tipo": c.tipo,
                            "medico": c._get_medico_nome(),
                            "diagnostico": c.diagnostico,
                        }
                        for c in pac_consultas
                    ],
                    "asos": [
                        {
                            "id": a.id,
                            "data": a.data.isoformat() if a.data else None,
                            "tipo_exame": a.tipo_exame,
                            "conclusao": a.conclusao,
                            "medico": a.medico.nome if a.medico else None,
                        }
                        for a in pac_asos
                    ],
                    "questionarios": [
                        {
                            "id": q.id,
                            "status": q.status,
                            "origem": q.origem,
                            "created_at": (
                                q.created_at.isoformat() if q.created_at else None
                            ),
                        }
                        for q in pac_questionarios
                    ],
                    "total_consultas": len(pac_consultas),
                    "total_asos": len(pac_asos),
                    "total_questionarios": len(pac_questionarios),
                    "possui_atendimento": len(pac_consultas) > 0 or len(pac_asos) > 0,
                }
            )

        return {
            "empresa": {
                "id": empresa.id,
                "nome": empresa.nome,
                "cnpj": empresa.cnpj,
                "cnpj_formatado": _fmt_cnpj(empresa.cnpj),
                "valor_por_consulta": empresa.valor_por_consulta,
                "valor_por_aso": empresa.valor_por_aso,
                "aso_embutido_na_consulta": empresa.aso_embutido_na_consulta,
                "dia_faturamento": empresa.dia_faturamento,
            },
            "periodo": {
                "data_inicio": data_inicio.isoformat(),
                "data_fim": data_fim.isoformat(),
            },
            "pacientes": resultado,
            "total_pacientes": len(resultado),
            "total_pacientes_atendidos": sum(
                1 for p in resultado if p["possui_atendimento"]
            ),
        }

    # -----------------------------------------------------------------
    # Resumo financeiro consolidado
    # -----------------------------------------------------------------

    @staticmethod
    def get_resumo_faturamento(
        empresa_id: int,
        data_inicio: date,
        data_fim: date,
    ) -> dict[str, Any] | None:
        """Calcula resumo financeiro do período — apenas consultas ocupacionais."""
        empresa = Empresas.query.get(empresa_id)
        if not empresa:
            return None

        if not empresa.faturamento_posterior:
            return None

        pacientes = _get_pacientes_da_empresa(empresa)
        cpfs = [p.cpf for p in pacientes if p.cpf]

        aso_embutido = empresa.aso_embutido_na_consulta

        # Contagem filtrada — apenas ocupacionais
        total_consultas = _count_consultas_ocupacionais(cpfs, data_inicio, data_fim)

        total_asos = 0
        if cpfs:
            total_asos = SolicitacoesDeAso.query.filter(
                SolicitacoesDeAso.cpf_paciente.in_(cpfs),
                SolicitacoesDeAso.data.between(data_inicio, data_fim),
            ).count()

        valor_consulta = empresa.valor_por_consulta or 0
        # ASO só tem valor separado quando não está embutido
        valor_aso = 0 if aso_embutido else (empresa.valor_por_aso or 0)

        subtotal_consultas = total_consultas * valor_consulta
        subtotal_asos = total_asos * valor_aso
        total_geral = subtotal_consultas + subtotal_asos

        return {
            "empresa": {
                "id": empresa.id,
                "nome": empresa.nome,
                "cnpj": empresa.cnpj,
                "cnpj_formatado": _fmt_cnpj(empresa.cnpj),
                "valor_por_consulta": valor_consulta,
                "valor_por_aso": valor_aso,
                "aso_embutido_na_consulta": aso_embutido,
                "dia_faturamento": empresa.dia_faturamento,
            },
            "periodo": {
                "data_inicio": data_inicio.isoformat(),
                "data_fim": data_fim.isoformat(),
            },
            "total_pacientes_vinculados": len(pacientes),
            "total_consultas": total_consultas,
            "total_asos": total_asos,
            "aso_embutido_na_consulta": aso_embutido,
            "subtotal_consultas": subtotal_consultas,
            "subtotal_asos": subtotal_asos,
            "total_geral": total_geral,
        }

    # -----------------------------------------------------------------
    # Contexto para PDF de relatório de atendimentos
    # -----------------------------------------------------------------

    @staticmethod
    def build_relatorio_context(
        empresa_id: int,
        data_inicio: date,
        data_fim: date,
    ) -> dict[str, Any] | None:
        """Monta contexto completo para o template de relatório PDF."""
        historico = CompanyBillingService.get_pacientes_com_historico(
            empresa_id,
            data_inicio,
            data_fim,
        )
        if not historico:
            return None

        resumo = CompanyBillingService.get_resumo_faturamento(
            empresa_id,
            data_inicio,
            data_fim,
        )

        from app.utils.timezone import get_now_sao_paulo

        agora = get_now_sao_paulo()

        return {
            **historico,
            "resumo": resumo,
            "logo_path": _get_logo_path(),
            "gerado_em": agora.strftime("%d/%m/%Y %H:%M"),
        }

    # -----------------------------------------------------------------
    # Contexto para PDF de recibo de cobrança
    # -----------------------------------------------------------------

    @staticmethod
    def build_recibo_context(
        empresa_id: int,
        data_inicio: date,
        data_fim: date,
    ) -> dict[str, Any] | None:
        """Monta contexto para o template de recibo de cobrança PDF."""
        empresa = Empresas.query.get(empresa_id)
        if not empresa or not empresa.faturamento_posterior:
            return None

        pacientes = _get_pacientes_da_empresa(empresa)
        cpfs = [p.cpf for p in pacientes if p.cpf]

        aso_embutido = empresa.aso_embutido_na_consulta

        # Consultas OCUPACIONAIS apenas
        consultas = _get_consultas_ocupacionais(cpfs, data_inicio, data_fim)
        asos = _get_asos_por_cpfs(cpfs, data_inicio, data_fim)

        nome_por_cpf = {p.cpf: p.nome for p in pacientes}

        valor_consulta = empresa.valor_por_consulta or 0
        # ASO só tem valor separado quando não está embutido
        valor_aso = 0 if aso_embutido else (empresa.valor_por_aso or 0)

        itens: list[dict] = []

        for c in consultas:
            itens.append(
                {
                    "tipo": "CONSULTA",
                    "data": c.data.isoformat() if c.data else None,
                    "data_br": c.data.strftime("%d/%m/%Y") if c.data else None,
                    "paciente": nome_por_cpf.get(c.cpf_paciente, "—"),
                    "cpf": _fmt_cpf(c.cpf_paciente),
                    "descricao": c.tipo or "Consulta ocupacional",
                    "valor_unitario": valor_consulta,
                }
            )

        # ASOs só entram como linha de cobrança quando NÃO estão embutidos
        if not aso_embutido:
            for a in asos:
                cpf_str = _only_digits(a.cpf_paciente).zfill(11)
                itens.append(
                    {
                        "tipo": "ASO",
                        "data": a.data.isoformat() if a.data else None,
                        "data_br": a.data.strftime("%d/%m/%Y") if a.data else None,
                        "paciente": nome_por_cpf.get(cpf_str, "—"),
                        "cpf": _fmt_cpf(cpf_str),
                        "descricao": f"ASO — {a.tipo_exame}",
                        "valor_unitario": valor_aso,
                    }
                )

        itens.sort(key=lambda i: i.get("data") or "")

        total_geral = sum(i["valor_unitario"] for i in itens)

        from app.utils.timezone import get_now_sao_paulo

        agora = get_now_sao_paulo()

        return {
            "empresa": {
                "id": empresa.id,
                "nome": empresa.nome,
                "razao_social": empresa.razao_social,
                "cnpj": empresa.cnpj,
                "cnpj_formatado": _fmt_cnpj(empresa.cnpj),
                "endereco": _build_endereco(empresa),
                "email": empresa.email,
                "contato_rh_nome": empresa.contato_rh_nome,
                "contato_rh_email": empresa.contato_rh_email,
            },
            "periodo": {
                "data_inicio": data_inicio.strftime("%d/%m/%Y"),
                "data_fim": data_fim.strftime("%d/%m/%Y"),
            },
            "itens": itens,
            "aso_embutido_na_consulta": aso_embutido,
            "total_consultas": sum(1 for i in itens if i["tipo"] == "CONSULTA"),
            "total_asos": len(asos),  # contagem informativa, independente de cobrança
            "valor_por_consulta": valor_consulta,
            "valor_por_aso": valor_aso,
            "subtotal_consultas": sum(
                i["valor_unitario"] for i in itens if i["tipo"] == "CONSULTA"
            ),
            "subtotal_asos": sum(
                i["valor_unitario"] for i in itens if i["tipo"] == "ASO"
            ),
            "total_geral": total_geral,
            "total_itens": len(itens),
            "logo_path": _get_logo_path(),
            "gerado_em": agora.strftime("%d/%m/%Y %H:%M"),
        }


def _build_endereco(empresa: Empresas) -> str | None:
    """Monta string de endereço da empresa."""
    parts: list[str] = []
    if empresa.logradouro:
        line = empresa.logradouro
        if empresa.numero:
            line += f", {empresa.numero}"
        if empresa.complemento:
            line += f" ({empresa.complemento})"
        parts.append(line)
    if empresa.bairro:
        parts.append(empresa.bairro)
    if empresa.cidade or empresa.uf:
        cityuf = " - ".join(x for x in [empresa.cidade, empresa.uf] if x)
        if cityuf:
            parts.append(cityuf)
    if empresa.cep:
        parts.append(f"CEP {empresa.cep}")
    return " | ".join(parts) if parts else None


# Singleton para uso nos controllers
company_billing_service = CompanyBillingService()
