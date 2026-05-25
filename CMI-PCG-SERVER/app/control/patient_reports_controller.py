"""Controller para relatórios de pacientes

Endpoints para análise e relatórios detalhados do módulo de pacientes.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import func, or_, extract

from app.database import db
from app.models.patients_model import Pacientes
from app.models.companies_model import Empresas
from app.models.insurances_model import Convenios
from app.models.medical_appointments_model import Consultas

patient_reports_api_bp = Blueprint("patient_reports_api", __name__)


def format_cpf(cpf: str | int | None) -> str:
    """Formata CPF para exibição: XXX.XXX.XXX-XX"""
    if cpf is None:
        return ""
    cpf_str = "".join(filter(str.isdigit, str(cpf))).zfill(11)
    return f"{cpf_str[:3]}.{cpf_str[3:6]}.{cpf_str[6:9]}-{cpf_str[9:11]}"


def calculate_age(birth_date: date) -> int:
    """Calcula idade a partir da data de nascimento."""
    today = date.today()
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


def get_birthday_in_year(birth_date: date, target_year: int) -> date:
    """Retorna a data de aniversário no ano alvo, tratando casos inválidos."""
    try:
        return birth_date.replace(year=target_year)
    except ValueError:
        last_day = monthrange(target_year, birth_date.month)[1]
        return date(target_year, birth_date.month, last_day)


# ============================================
# GET - Relatório geral de pacientes
# ============================================
@patient_reports_api_bp.route("/pacientes/relatorios/resumo", methods=["GET"])
def get_relatorio_resumo():
    """Retorna resumo geral para dashboard de pacientes."""
    try:
        periodo = request.args.get("periodo", "30dias")
        hoje = date.today()

        if periodo == "7dias":
            data_corte = hoje - timedelta(days=7)
        elif periodo == "30dias":
            data_corte = hoje - timedelta(days=30)
        elif periodo == "90dias":
            data_corte = hoje - timedelta(days=90)
        elif periodo == "12meses":
            data_corte = hoje - timedelta(days=365)
        else:
            data_corte = None

        total_pacientes = Pacientes.query.count()
        total_empresa = Pacientes.query.filter(
            Pacientes.vinculado_a_empresa == True  # noqa: E712
        ).count()
        total_convenio = Pacientes.query.filter(
            Pacientes.vinculado_a_convenio == True  # noqa: E712
        ).count()
        total_particular = total_pacientes - total_empresa - total_convenio

        consultas_query = Consultas.query
        if data_corte:
            consultas_query = consultas_query.filter(Consultas.data >= data_corte)

        total_consultas_periodo = consultas_query.count()

        pacientes_atendidos = (
            consultas_query.with_entities(Consultas.cpf_paciente).distinct().count()
        )

        media_consultas = (
            total_consultas_periodo / pacientes_atendidos
            if pacientes_atendidos > 0
            else 0
        )

        pacientes_retorno = (
            db.session.query(Consultas.cpf_paciente)
            .filter(Consultas.data >= data_corte if data_corte else True)
            .group_by(Consultas.cpf_paciente)
            .having(func.count(Consultas.id) > 1)
            .count()
        )

        taxa_retorno = (
            (pacientes_retorno / pacientes_atendidos * 100)
            if pacientes_atendidos > 0
            else 0
        )

        masculino = Pacientes.query.filter(Pacientes.sexo == "M").count()
        feminino = Pacientes.query.filter(Pacientes.sexo == "F").count()

        pacientes = Pacientes.query.all()
        faixas = {"0-17": 0, "18-30": 0, "31-45": 0, "46-60": 0, "60+": 0, "nd": 0}
        for p in pacientes:
            if p.data_de_nascimento:
                idade = calculate_age(p.data_de_nascimento)
                if idade < 18:
                    faixas["0-17"] += 1
                elif idade <= 30:
                    faixas["18-30"] += 1
                elif idade <= 45:
                    faixas["31-45"] += 1
                elif idade <= 60:
                    faixas["46-60"] += 1
                else:
                    faixas["60+"] += 1
            else:
                faixas["nd"] += 1

        return jsonify(
            {
                "periodo": periodo,
                "data_corte": data_corte.isoformat() if data_corte else None,
                "totais": {
                    "pacientes": total_pacientes,
                    "vinculados_empresa": total_empresa,
                    "vinculados_convenio": total_convenio,
                    "particulares": total_particular,
                },
                "periodo_stats": {
                    "consultas": total_consultas_periodo,
                    "pacientes_atendidos": pacientes_atendidos,
                    "media_consultas_paciente": round(media_consultas, 2),
                    "taxa_retorno_percent": round(taxa_retorno, 1),
                },
                "distribuicao_sexo": {
                    "masculino": masculino,
                    "feminino": feminino,
                    "nao_informado": total_pacientes - masculino - feminino,
                },
                "distribuicao_faixa_etaria": faixas,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao gerar relatório resumo: {e}")
        return jsonify({"error": "Erro ao gerar relatório"}), 500


# ============================================
# GET - Consultas por mês (histórico)
# ============================================
@patient_reports_api_bp.route(
    "/pacientes/relatorios/consultas-por-mes", methods=["GET"]
)
def get_consultas_por_mes():
    """Retorna quantidade de consultas por mês."""
    try:
        meses = int(request.args.get("meses", 12))
        hoje = date.today()
        data_inicio = hoje - timedelta(days=meses * 30)

        resultados = (
            db.session.query(
                extract("year", Consultas.data).label("ano"),
                extract("month", Consultas.data).label("mes"),
                func.count(Consultas.id).label("total"),
                func.count(func.distinct(Consultas.cpf_paciente)).label(
                    "pacientes_unicos"
                ),
            )
            .filter(Consultas.data >= data_inicio)
            .group_by(extract("year", Consultas.data), extract("month", Consultas.data))
            .order_by(extract("year", Consultas.data), extract("month", Consultas.data))
            .all()
        )

        meses_nomes = [
            "",
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

        dados = [
            {
                "ano": int(ano),
                "mes": int(mes),
                "nome_mes": meses_nomes[int(mes)],
                "total_consultas": total,
                "pacientes_unicos": pacientes,
            }
            for ano, mes, total, pacientes in resultados
        ]

        return jsonify({"periodo_meses": meses, "dados": dados})

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar consultas por mês: {e}")
        return jsonify({"error": "Erro ao buscar dados"}), 500


# ============================================
# GET - Pacientes por empresa (ranking)
# ============================================
@patient_reports_api_bp.route("/pacientes/relatorios/por-empresa", methods=["GET"])
def get_pacientes_por_empresa():
    """Retorna ranking de empresas por quantidade de pacientes."""
    try:
        limite = int(request.args.get("limite", 10))

        resultados = (
            db.session.query(
                Empresas.id,
                Empresas.nome,
                func.count(Pacientes.id).label("total_pacientes"),
            )
            .join(Pacientes, Empresas.cnpj == Pacientes.cnpj_empresa)
            .group_by(Empresas.id, Empresas.nome)
            .order_by(func.count(Pacientes.id).desc())
            .limit(limite)
            .all()
        )

        total_vinculados = Pacientes.query.filter(
            Pacientes.vinculado_a_empresa == True  # noqa: E712
        ).count()

        dados = []
        for idx, (empresa_id, nome, total) in enumerate(resultados):
            percentual = (total / total_vinculados * 100) if total_vinculados > 0 else 0
            dados.append(
                {
                    "posicao": idx + 1,
                    "empresa_id": empresa_id,
                    "nome": nome,
                    "total_pacientes": total,
                    "percentual": round(percentual, 1),
                }
            )

        return jsonify(
            {"total_vinculados_empresas": total_vinculados, "empresas": dados}
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar pacientes por empresa: {e}")
        return jsonify({"error": "Erro ao buscar dados"}), 500


# ============================================
# GET - Pacientes por convênio (ranking)
# ============================================
@patient_reports_api_bp.route("/pacientes/relatorios/por-convenio", methods=["GET"])
def get_pacientes_por_convenio():
    """Retorna ranking de convênios por quantidade de pacientes."""
    try:
        limite = int(request.args.get("limite", 10))

        resultados = (
            db.session.query(
                Convenios.id,
                Convenios.nome,
                func.count(Pacientes.id).label("total_pacientes"),
            )
            .join(Pacientes, Convenios.cnpj == Pacientes.cnpj_convenio)
            .group_by(Convenios.id, Convenios.nome)
            .order_by(func.count(Pacientes.id).desc())
            .limit(limite)
            .all()
        )

        total_vinculados = Pacientes.query.filter(
            Pacientes.vinculado_a_convenio == True  # noqa: E712
        ).count()

        dados = []
        for idx, (convenio_id, nome, total) in enumerate(resultados):
            percentual = (total / total_vinculados * 100) if total_vinculados > 0 else 0
            dados.append(
                {
                    "posicao": idx + 1,
                    "convenio_id": convenio_id,
                    "nome": nome,
                    "total_pacientes": total,
                    "percentual": round(percentual, 1),
                }
            )

        return jsonify(
            {"total_vinculados_convenios": total_vinculados, "convenios": dados}
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar pacientes por convênio: {e}")
        return jsonify({"error": "Erro ao buscar dados"}), 500


# ============================================
# GET - Distribuição geográfica (por cidade/UF)
# ============================================
@patient_reports_api_bp.route(
    "/pacientes/relatorios/distribuicao-geografica", methods=["GET"]
)
def get_distribuicao_geografica():
    """Retorna distribuição de pacientes por cidade/UF."""
    try:
        tipo = request.args.get("tipo", "uf")
        limite = int(request.args.get("limite", 10))

        if tipo == "cidade":
            resultados = (
                db.session.query(
                    Pacientes.cidade,
                    Pacientes.uf,
                    func.count(Pacientes.id).label("total"),
                )
                .filter(Pacientes.cidade != None, Pacientes.cidade != "")  # noqa: E711
                .group_by(Pacientes.cidade, Pacientes.uf)
                .order_by(func.count(Pacientes.id).desc())
                .limit(limite)
                .all()
            )

            dados = [
                {"cidade": cidade, "uf": uf, "total": total}
                for cidade, uf, total in resultados
            ]
        else:
            resultados = (
                db.session.query(
                    Pacientes.uf,
                    func.count(Pacientes.id).label("total"),
                )
                .filter(Pacientes.uf != None, Pacientes.uf != "")  # noqa: E711
                .group_by(Pacientes.uf)
                .order_by(func.count(Pacientes.id).desc())
                .limit(limite)
                .all()
            )

            dados = [{"uf": uf, "total": total} for uf, total in resultados]

        total_com_endereco = Pacientes.query.filter(
            or_(Pacientes.cidade != None, Pacientes.uf != None)  # noqa: E711
        ).count()

        return jsonify(
            {"tipo": tipo, "total_com_endereco": total_com_endereco, "dados": dados}
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar distribuição geográfica: {e}")
        return jsonify({"error": "Erro ao buscar dados"}), 500


# ============================================
# GET - Programa de fidelidade - Dashboard
# ============================================
@patient_reports_api_bp.route("/pacientes/relatorios/fidelidade", methods=["GET"])
def get_relatorio_fidelidade():
    """Retorna dados do programa de fidelidade."""
    try:
        todos_com_consultas = (
            db.session.query(
                Pacientes.id, Pacientes.nome, func.count(Consultas.id).label("total")
            )
            .outerjoin(Consultas, Pacientes.cpf == Consultas.cpf_paciente)
            .group_by(Pacientes.id, Pacientes.nome)
            .all()
        )

        niveis = {"novo": 0, "bronze": 0, "prata": 0, "ouro": 0}
        total_pontos = 0

        for _, _, total in todos_com_consultas:
            pontos = total * 10
            total_pontos += pontos

            if total >= 20:
                niveis["ouro"] += 1
            elif total >= 10:
                niveis["prata"] += 1
            elif total >= 5:
                niveis["bronze"] += 1
            else:
                niveis["novo"] += 1

        top_pacientes = (
            db.session.query(
                Pacientes.id,
                Pacientes.nome,
                func.count(Consultas.id).label("total_consultas"),
            )
            .outerjoin(Consultas, Pacientes.cpf == Consultas.cpf_paciente)
            .group_by(Pacientes.id, Pacientes.nome)
            .order_by(func.count(Consultas.id).desc())
            .limit(10)
            .all()
        )

        top_list = []
        for idx, (pid, nome, total) in enumerate(top_pacientes):
            if total >= 20:
                nivel = "ouro"
            elif total >= 10:
                nivel = "prata"
            elif total >= 5:
                nivel = "bronze"
            else:
                nivel = "novo"

            top_list.append(
                {
                    "posicao": idx + 1,
                    "id": pid,
                    "nome": nome,
                    "total_consultas": total,
                    "pontos": total * 10,
                    "nivel": nivel,
                }
            )

        regras = {
            "pontos_por_consulta": 10,
            "niveis": {
                "novo": {"min_consultas": 0, "max_consultas": 4, "beneficio": "Nenhum"},
                "bronze": {
                    "min_consultas": 5,
                    "max_consultas": 9,
                    "beneficio": "5% desconto",
                },
                "prata": {
                    "min_consultas": 10,
                    "max_consultas": 19,
                    "beneficio": "10% desconto",
                },
                "ouro": {
                    "min_consultas": 20,
                    "max_consultas": None,
                    "beneficio": "15% desconto + prioridade",
                },
            },
        }

        return jsonify(
            {
                "distribuicao_niveis": niveis,
                "total_pacientes": sum(niveis.values()),
                "total_pontos_emitidos": total_pontos,
                "top_pacientes": top_list,
                "regras_programa": regras,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar relatório de fidelidade: {e}")
        return jsonify({"error": "Erro ao buscar dados"}), 500


# ============================================
# GET - Aniversariantes
# ============================================
@patient_reports_api_bp.route("/pacientes/relatorios/aniversariantes", methods=["GET"])
def get_aniversariantes():
    """Lista pacientes que fazem aniversário no período."""
    try:
        dias = request.args.get("dias")
        mes = request.args.get("mes")
        hoje = date.today()

        if dias:
            dias_int = int(dias)
            data_fim = hoje + timedelta(days=dias_int)

            pacientes = Pacientes.query.filter(
                Pacientes.data_de_nascimento != None  # noqa: E711
            ).all()

            aniversariantes = []
            for p in pacientes:
                aniv = get_birthday_in_year(p.data_de_nascimento, hoje.year)

                if aniv < hoje:
                    aniv = get_birthday_in_year(p.data_de_nascimento, hoje.year + 1)

                if hoje <= aniv <= data_fim:
                    idade = calculate_age(p.data_de_nascimento)
                    aniversariantes.append(
                        {
                            "id": p.id,
                            "nome": p.nome,
                            "cpf": format_cpf(p.cpf),
                            "data_nascimento": p.data_de_nascimento.strftime(
                                "%d/%m/%Y"
                            ),
                            "data_aniversario": aniv.strftime("%d/%m"),
                            "idade_atual": idade,
                            "idade_nova": idade + 1 if aniv > hoje else idade,
                            "telefone": p.numero_de_contato,
                            "email": p.email,
                        }
                    )

            aniversariantes.sort(key=lambda x: x["data_aniversario"])

            return jsonify(
                {
                    "tipo": "proximos_dias",
                    "dias": dias_int,
                    "total": len(aniversariantes),
                    "aniversariantes": aniversariantes,
                }
            )
        else:
            mes_int = int(mes) if mes else hoje.month

            pacientes = (
                Pacientes.query.filter(
                    Pacientes.data_de_nascimento != None,  # noqa: E711
                    extract("month", Pacientes.data_de_nascimento) == mes_int,
                )
                .order_by(extract("day", Pacientes.data_de_nascimento))
                .all()
            )

            meses_nomes = [
                "",
                "Janeiro",
                "Fevereiro",
                "Março",
                "Abril",
                "Maio",
                "Junho",
                "Julho",
                "Agosto",
                "Setembro",
                "Outubro",
                "Novembro",
                "Dezembro",
            ]

            aniversariantes = [
                {
                    "id": p.id,
                    "nome": p.nome,
                    "cpf": format_cpf(p.cpf),
                    "data_nascimento": p.data_de_nascimento.strftime("%d/%m/%Y"),
                    "dia": p.data_de_nascimento.day,
                    "idade_atual": calculate_age(p.data_de_nascimento),
                    "telefone": p.numero_de_contato,
                    "email": p.email,
                }
                for p in pacientes
            ]

            return jsonify(
                {
                    "tipo": "mes",
                    "mes": mes_int,
                    "nome_mes": meses_nomes[mes_int],
                    "total": len(aniversariantes),
                    "aniversariantes": aniversariantes,
                }
            )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar aniversariantes: {e}")
        return jsonify({"error": "Erro ao buscar dados"}), 500


# ============================================
# GET - Pacientes sem consulta há muito tempo
# ============================================
@patient_reports_api_bp.route("/pacientes/relatorios/inativos", methods=["GET"])
def get_pacientes_inativos():
    """Lista pacientes que não consultam há muito tempo (para recall)."""
    try:
        dias = int(request.args.get("dias", 180))
        limite = int(request.args.get("limite", 50))
        data_corte = date.today() - timedelta(days=dias)

        subq = (
            db.session.query(
                Consultas.cpf_paciente,
                func.max(Consultas.data).label("ultima_consulta"),
            )
            .group_by(Consultas.cpf_paciente)
            .subquery()
        )

        resultados = (
            db.session.query(Pacientes, subq.c.ultima_consulta)
            .outerjoin(subq, Pacientes.cpf == subq.c.cpf_paciente)
            .filter(
                or_(
                    subq.c.ultima_consulta < data_corte,
                    subq.c.ultima_consulta == None,  # noqa: E711
                )
            )
            .order_by(subq.c.ultima_consulta.asc().nullsfirst())
            .limit(limite)
            .all()
        )

        inativos = []
        for paciente, ultima in resultados:
            dias_sem_consulta = None
            if ultima:
                dias_sem_consulta = (date.today() - ultima).days

            inativos.append(
                {
                    "id": paciente.id,
                    "nome": paciente.nome,
                    "cpf": format_cpf(paciente.cpf),
                    "telefone": paciente.numero_de_contato,
                    "email": paciente.email,
                    "ultima_consulta": ultima.isoformat() if ultima else None,
                    "dias_sem_consulta": dias_sem_consulta,
                    "empresa": paciente.empresa.nome if paciente.empresa else None,
                }
            )

        return jsonify(
            {"dias_corte": dias, "total": len(inativos), "pacientes": inativos}
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar pacientes inativos: {e}")
        return jsonify({"error": "Erro ao buscar dados"}), 500
