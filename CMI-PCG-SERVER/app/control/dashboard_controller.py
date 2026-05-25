"""Controller para Dashboard e Relatórios Estatísticos"""

from flask import Blueprint, jsonify, request
from sqlalchemy import func, extract, desc, and_
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from app.models.patients_model import Pacientes
from app.models.doctors_model import Medicos
from app.models.companies_model import Empresas
from app.models.insurances_model import Convenios
from app.models.payments_model import Pagamentos
from app.models.medical_appointments_model import Consultas
from app.models.appointments_model import Agendamentos
from app.models.exams_model import Exames
from app.database import db

dashboard_bp = Blueprint("dashboard", __name__)


# ============================================
# DASHBOARD - Estatísticas Gerais
# ============================================


@dashboard_bp.route("/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    """Retorna estatísticas gerais do dashboard"""
    try:
        hoje = datetime.now().date()
        primeiro_dia_mes = hoje.replace(day=1)
        primeiro_dia_mes_anterior = primeiro_dia_mes - relativedelta(months=1)
        ultimo_dia_mes_anterior = primeiro_dia_mes - timedelta(days=1)

        # Total de pacientes
        total_pacientes = db.session.query(func.count(Pacientes.id)).scalar() or 0

        # Agendamentos de hoje
        agendamentos_hoje = (
            db.session.query(func.count(Agendamentos.id))
            .filter(Agendamentos.dia == hoje.strftime("%Y-%m-%d"))
            .scalar()
            or 0
        )

        # Agendamentos de amanhã
        amanha = hoje + timedelta(days=1)
        agendamentos_amanha = (
            db.session.query(func.count(Agendamentos.id))
            .filter(Agendamentos.dia == amanha.strftime("%Y-%m-%d"))
            .scalar()
            or 0
        )

        # Consultas do mês atual
        consultas_mes = (
            db.session.query(func.count(Consultas.id))
            .filter(
                Consultas.data >= primeiro_dia_mes.strftime("%Y-%m-%d"),
                Consultas.data <= hoje.strftime("%Y-%m-%d"),
            )
            .scalar()
            or 0
        )

        # Consultas do mês anterior (para comparação)
        consultas_mes_anterior = (
            db.session.query(func.count(Consultas.id))
            .filter(
                Consultas.data >= primeiro_dia_mes_anterior.strftime("%Y-%m-%d"),
                Consultas.data <= ultimo_dia_mes_anterior.strftime("%Y-%m-%d"),
            )
            .scalar()
            or 0
        )

        # Faturamento do mês atual
        faturamento_mes = (
            db.session.query(func.sum(Pagamentos.valor))
            .filter(
                Pagamentos.data >= primeiro_dia_mes.strftime("%Y-%m-%d"),
                Pagamentos.data <= hoje.strftime("%Y-%m-%d"),
            )
            .scalar()
            or 0
        )

        # Faturamento do mês anterior
        faturamento_mes_anterior = (
            db.session.query(func.sum(Pagamentos.valor))
            .filter(
                Pagamentos.data >= primeiro_dia_mes_anterior.strftime("%Y-%m-%d"),
                Pagamentos.data <= ultimo_dia_mes_anterior.strftime("%Y-%m-%d"),
            )
            .scalar()
            or 0
        )

        # Calcular variações percentuais
        variacao_consultas = 0
        if consultas_mes_anterior > 0:
            variacao_consultas = round(
                ((consultas_mes - consultas_mes_anterior) / consultas_mes_anterior)
                * 100
            )

        variacao_faturamento = 0
        if faturamento_mes_anterior > 0:
            variacao_faturamento = round(
                (
                    (faturamento_mes - faturamento_mes_anterior)
                    / faturamento_mes_anterior
                )
                * 100
            )

        # Média de consultas por dia útil (aproximado: 22 dias)
        dias_uteis = min(hoje.day, 22)
        media_consultas_dia = (
            round(consultas_mes / dias_uteis, 1) if dias_uteis > 0 else 0
        )

        return jsonify(
            {
                "totalPacientes": total_pacientes,
                "agendamentosHoje": agendamentos_hoje,
                "agendamentosAmanha": agendamentos_amanha,
                "consultasMes": consultas_mes,
                "consultasMesAnterior": consultas_mes_anterior,
                "variacaoConsultas": variacao_consultas,
                "faturamentoMes": float(faturamento_mes),
                "faturamentoMesAnterior": float(faturamento_mes_anterior),
                "variacaoFaturamento": variacao_faturamento,
                "mediaConsultasDia": media_consultas_dia,
                "taxaOcupacao": 85,  # TODO: Calcular baseado na capacidade
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# RELATÓRIOS - Consultas por Mês
# ============================================


@dashboard_bp.route("/relatorios/consultas-por-mes", methods=["GET"])
def get_consultas_por_mes():
    """Retorna quantidade de consultas por mês (últimos 6 meses)"""
    try:
        meses = int(request.args.get("meses", 6))
        hoje = datetime.now().date()

        resultado = []
        nomes_meses = [
            "Jan",
            "Fev",
            "Mar",
            "Abr",
            "Mai",
            "Jun",
            "Jul",
            "Ago",
            "Set",
            "Out",
            "Nov",
            "Dez",
        ]

        for i in range(meses - 1, -1, -1):
            data_ref = hoje - relativedelta(months=i)
            primeiro_dia = data_ref.replace(day=1)

            if i == 0:
                ultimo_dia = hoje
            else:
                ultimo_dia = (primeiro_dia + relativedelta(months=1)) - timedelta(
                    days=1
                )

            # Total de consultas no mês
            total = (
                db.session.query(func.count(Consultas.id))
                .filter(
                    Consultas.data >= primeiro_dia.strftime("%Y-%m-%d"),
                    Consultas.data <= ultimo_dia.strftime("%Y-%m-%d"),
                )
                .scalar()
                or 0
            )

            # Consultas ocupacionais (tipo contém 'OCUPACIONAL')
            ocupacionais = (
                db.session.query(func.count(Consultas.id))
                .filter(
                    Consultas.data >= primeiro_dia.strftime("%Y-%m-%d"),
                    Consultas.data <= ultimo_dia.strftime("%Y-%m-%d"),
                    Consultas.tipo.ilike("%OCUPACIONAL%"),
                )
                .scalar()
                or 0
            )

            # Retornos
            retornos = (
                db.session.query(func.count(Consultas.id))
                .filter(
                    Consultas.data >= primeiro_dia.strftime("%Y-%m-%d"),
                    Consultas.data <= ultimo_dia.strftime("%Y-%m-%d"),
                    Consultas.tipo.ilike("%RETORNO%"),
                )
                .scalar()
                or 0
            )

            resultado.append(
                {
                    "mes": nomes_meses[data_ref.month - 1],
                    "ano": data_ref.year,
                    "consultas": total,
                    "ocupacionais": ocupacionais,
                    "retornos": retornos,
                }
            )

        return jsonify(resultado)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# RELATÓRIOS - Faturamento por Mês
# ============================================


@dashboard_bp.route("/relatorios/faturamento-por-mes", methods=["GET"])
def get_faturamento_por_mes():
    """Retorna faturamento por mês (últimos 6 meses)"""
    try:
        meses = int(request.args.get("meses", 6))
        hoje = datetime.now().date()

        resultado = []
        nomes_meses = [
            "Jan",
            "Fev",
            "Mar",
            "Abr",
            "Mai",
            "Jun",
            "Jul",
            "Ago",
            "Set",
            "Out",
            "Nov",
            "Dez",
        ]

        for i in range(meses - 1, -1, -1):
            data_ref = hoje - relativedelta(months=i)
            primeiro_dia = data_ref.replace(day=1)

            if i == 0:
                ultimo_dia = hoje
            else:
                ultimo_dia = (primeiro_dia + relativedelta(months=1)) - timedelta(
                    days=1
                )

            # Receitas (pagamentos recebidos)
            receitas = (
                db.session.query(func.sum(Pagamentos.valor))
                .filter(
                    Pagamentos.data >= primeiro_dia.strftime("%Y-%m-%d"),
                    Pagamentos.data <= ultimo_dia.strftime("%Y-%m-%d"),
                )
                .scalar()
                or 0
            )

            # Despesas - placeholder (pode ser implementado com tabela de despesas)
            # Por enquanto, estima 40% das receitas como despesas
            despesas = float(receitas) * 0.4

            resultado.append(
                {
                    "mes": nomes_meses[data_ref.month - 1],
                    "ano": data_ref.year,
                    "receitas": float(receitas),
                    "despesas": round(despesas, 2),
                }
            )

        return jsonify(resultado)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# RELATÓRIOS - Tipos de Consulta
# ============================================


@dashboard_bp.route("/relatorios/tipos-consulta", methods=["GET"])
def get_tipos_consulta():
    """Retorna distribuição de tipos de consulta"""
    try:
        # Buscar últimos 6 meses
        hoje = datetime.now().date()
        seis_meses_atras = hoje - relativedelta(months=6)

        # Contar por tipo
        tipos = (
            db.session.query(Consultas.tipo, func.count(Consultas.id).label("total"))
            .filter(Consultas.data >= seis_meses_atras.strftime("%Y-%m-%d"))
            .group_by(Consultas.tipo)
            .all()
        )

        total_geral = sum(t.total for t in tipos) or 1

        cores = {
            "OCUPACIONAL": "#3b82f6",
            "RETORNO": "#10b981",
            "ADMISSIONAL": "#f59e0b",
            "DEMISSIONAL": "#ef4444",
            "PERIÓDICO": "#8b5cf6",
            "CONSULTA MÉDICA": "#06b6d4",
            "IMESC": "#ec4899",
        }

        resultado = []
        for tipo in tipos:
            nome = tipo.tipo or "OUTROS"
            resultado.append(
                {
                    "name": nome.title(),
                    "value": round((tipo.total / total_geral) * 100),
                    "total": tipo.total,
                    "color": cores.get(nome.upper(), "#94a3b8"),
                }
            )

        # Ordenar por valor decrescente
        resultado.sort(key=lambda x: x["value"], reverse=True)

        return jsonify(resultado)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# RELATÓRIOS - Pacientes Mais Frequentes
# ============================================


@dashboard_bp.route("/relatorios/pacientes-frequentes", methods=["GET"])
def get_pacientes_frequentes():
    """Retorna os pacientes que mais frequentam a clínica"""
    try:
        limite = int(request.args.get("limite", 5))

        # Subquery para contar consultas por paciente
        pacientes_consultas = (
            db.session.query(
                Consultas.cpf_paciente,
                func.count(Consultas.id).label("total_consultas"),
                func.max(Consultas.data).label("ultima_consulta"),
            )
            .group_by(Consultas.cpf_paciente)
            .subquery()
        )

        # Join com tabela de pacientes
        resultado = (
            db.session.query(
                Pacientes.nome,
                Pacientes.cpf,
                pacientes_consultas.c.total_consultas,
                pacientes_consultas.c.ultima_consulta,
                Empresas.nome.label("empresa"),
            )
            .join(
                pacientes_consultas, Pacientes.cpf == pacientes_consultas.c.cpf_paciente
            )
            .outerjoin(Empresas, Pacientes.cnpj_empresa == Empresas.cnpj)
            .order_by(desc(pacientes_consultas.c.total_consultas))
            .limit(limite)
            .all()
        )

        return jsonify(
            [
                {
                    "nome": p.nome,
                    "cpf": p.cpf,
                    "consultas": p.total_consultas,
                    "ultimaConsulta": p.ultima_consulta,
                    "empresa": p.empresa or "Particular",
                }
                for p in resultado
            ]
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# RELATÓRIOS - Empresas Mais Ativas
# ============================================


@dashboard_bp.route("/relatorios/empresas-ativas", methods=["GET"])
def get_empresas_ativas():
    """Retorna as empresas com mais pacientes e consultas"""
    try:
        limite = int(request.args.get("limite", 5))

        # Contar pacientes por empresa
        pacientes_por_empresa = (
            db.session.query(
                Pacientes.cnpj_empresa,
                func.count(Pacientes.id).label("total_pacientes"),
            )
            .filter(Pacientes.vinculado_a_empresa == True)
            .group_by(Pacientes.cnpj_empresa)
            .subquery()
        )

        # Join com empresas e contar consultas
        resultado = (
            db.session.query(
                Empresas.nome,
                Empresas.cnpj,
                pacientes_por_empresa.c.total_pacientes,
                func.count(Consultas.id).label("total_consultas"),
            )
            .outerjoin(
                pacientes_por_empresa,
                Empresas.cnpj == pacientes_por_empresa.c.cnpj_empresa,
            )
            .outerjoin(Pacientes, Empresas.cnpj == Pacientes.cnpj_empresa)
            .outerjoin(Consultas, Pacientes.cpf == Consultas.cpf_paciente)
            .group_by(
                Empresas.nome, Empresas.cnpj, pacientes_por_empresa.c.total_pacientes
            )
            .order_by(desc(pacientes_por_empresa.c.total_pacientes))
            .limit(limite)
            .all()
        )

        return jsonify(
            [
                {
                    "nome": e.nome,
                    "cnpj": e.cnpj,
                    "pacientes": e.total_pacientes or 0,
                    "consultas": e.total_consultas or 0,
                }
                for e in resultado
            ]
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# EXAMES MAIS SOLICITADOS
# ============================================


@dashboard_bp.route("/relatorios/exames-mais-solicitados")
def exames_mais_solicitados():
    rows = db.session.execute(
        """
        SELECT trim(exame) AS nome, COUNT(*) AS total
        FROM solicitacoes_de_exames,
             unnest(string_to_array(exames, ',')) AS exame
        GROUP BY nome
        ORDER BY total DESC
        LIMIT 10
    """
    ).fetchall()

    return jsonify([{"nome": r.nome, "total": r.total} for r in rows])


# ============================================
# RELATÓRIOS - Resumo Geral
# ============================================


@dashboard_bp.route("/relatorios/resumo", methods=["GET"])
def get_resumo_relatorios():
    """Retorna todos os dados de relatórios em uma única chamada"""
    try:
        periodo = request.args.get("periodo", "6meses")

        # Determinar número de meses baseado no período
        meses_map = {"30dias": 1, "3meses": 3, "6meses": 6, "12meses": 12}
        meses = meses_map.get(periodo, 6)

        hoje = datetime.now().date()
        data_inicio = hoje - relativedelta(months=meses)

        # Total de consultas no período
        total_consultas = (
            db.session.query(func.count(Consultas.id))
            .filter(Consultas.data >= data_inicio.strftime("%Y-%m-%d"))
            .scalar()
            or 0
        )

        # Média de consultas por dia
        dias = (hoje - data_inicio).days or 1
        media_dia = round(total_consultas / dias, 1)

        # Taxa de retorno (consultas de retorno / total)
        retornos = (
            db.session.query(func.count(Consultas.id))
            .filter(
                Consultas.data >= data_inicio.strftime("%Y-%m-%d"),
                Consultas.tipo.ilike("%RETORNO%"),
            )
            .scalar()
            or 0
        )

        taxa_retorno = (
            round((retornos / total_consultas) * 100) if total_consultas > 0 else 0
        )

        # Faturamento total
        faturamento = (
            db.session.query(func.sum(Pagamentos.valor))
            .filter(Pagamentos.data >= data_inicio.strftime("%Y-%m-%d"))
            .scalar()
            or 0
        )

        return jsonify(
            {
                "periodo": periodo,
                "totalConsultas": total_consultas,
                "mediaConsultasDia": media_dia,
                "taxaRetorno": taxa_retorno,
                "faturamentoTotal": float(faturamento),
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
