"""Controller para Médicos - Módulo Completo

Endpoints:
- GET    /medicos                    - Listar médicos com filtros
- GET    /medicos/<id>               - Buscar por ID
- GET    /medicos/crm/<crm>          - Buscar por CRM
- POST   /medicos                    - Criar médico
- PUT    /medicos/<id>               - Atualizar médico
- DELETE /medicos/<id>               - Excluir médico
- GET    /medicos/stats              - Estatísticas gerais
- GET    /medicos/<id>/performance   - Performance individual
- GET    /medicos/autocomplete       - Autocomplete para formulários

Relatórios:
- GET    /medicos/relatorios/resumo              - Dashboard resumo
- GET    /medicos/relatorios/consultas-por-medico - Ranking por consultas
- GET    /medicos/relatorios/por-especialidade   - Distribuição por especialidade
- GET    /medicos/relatorios/produtividade       - Análise de produtividade
- GET    /medicos/relatorios/agenda-ocupacao     - Taxa de ocupação
"""

from __future__ import annotations

from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_, desc, and_, extract
from app.database import db
from app.models.doctors_model import Medicos
from app.models.medical_appointments_model import Consultas
from app.models.patients_model import Pacientes

medicos_bp = Blueprint("medicos", __name__)


# ============================================
# Helpers
# ============================================
def only_digits(value: str | int | None) -> str:
    """Remove tudo exceto dígitos"""
    if value is None:
        return ""
    return "".join(filter(str.isdigit, str(value)))


def format_cpf(cpf: str | int) -> str:
    """Formata CPF: XXX.XXX.XXX-XX"""
    cpf_str = str(cpf).zfill(11)
    return f"{cpf_str[:3]}.{cpf_str[3:6]}.{cpf_str[6:9]}-{cpf_str[9:11]}"


def clean_cpf(cpf: str | int) -> int:
    """Remove formatação do CPF"""
    return int(only_digits(cpf))


def format_crm(crm: int | str, uf: str = "SP") -> str:
    """Formata CRM: CRM/UF 123456"""
    return f"CRM/{uf} {crm}"


def clean_crm(crm: str | int) -> int:
    """Remove formatação do CRM"""
    return int(only_digits(crm))


def parse_date(date_str: str) -> date | None:
    """Converte string para date"""
    if not date_str:
        return None
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def calculate_age(birth_date: date) -> int:
    """Calcula idade"""
    today = date.today()
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


def get_medico_stats(crm: int) -> dict:
    """Calcula estatísticas de um médico"""
    hoje = date.today()
    inicio_mes = hoje.replace(day=1)
    inicio_ano = hoje.replace(month=1, day=1)
    um_ano_atras = hoje - timedelta(days=365)

    # Total de consultas
    total_consultas = Consultas.query.filter(Consultas.crm_medico == crm).count()

    # Consultas este mês
    consultas_mes = Consultas.query.filter(
        Consultas.crm_medico == crm, Consultas.data >= inicio_mes
    ).count()

    # Consultas este ano
    consultas_ano = Consultas.query.filter(
        Consultas.crm_medico == crm, Consultas.data >= inicio_ano
    ).count()

    # Pacientes únicos atendidos
    pacientes_unicos = (
        db.session.query(func.count(func.distinct(Consultas.cpf_paciente)))
        .filter(Consultas.crm_medico == crm)
        .scalar()
        or 0
    )

    # Pacientes únicos no último ano
    pacientes_ano = (
        db.session.query(func.count(func.distinct(Consultas.cpf_paciente)))
        .filter(Consultas.crm_medico == crm, Consultas.data >= um_ano_atras)
        .scalar()
        or 0
    )

    # Média de consultas por mês (último ano)
    if total_consultas > 0:
        consultas_ultimo_ano = Consultas.query.filter(
            Consultas.crm_medico == crm, Consultas.data >= um_ano_atras
        ).count()
        media_mensal = round(consultas_ultimo_ano / 12, 1)
    else:
        media_mensal = 0

    # Distribuição por tipo de consulta
    tipos = (
        db.session.query(Consultas.tipo, func.count(Consultas.id).label("total"))
        .filter(Consultas.crm_medico == crm)
        .group_by(Consultas.tipo)
        .all()
    )

    por_tipo = [{"tipo": t[0] or "Não especificado", "total": t[1]} for t in tipos]

    # Última consulta
    ultima = (
        Consultas.query.filter(Consultas.crm_medico == crm)
        .order_by(Consultas.data.desc())
        .first()
    )

    # Primeira consulta
    primeira = (
        Consultas.query.filter(Consultas.crm_medico == crm)
        .order_by(Consultas.data.asc())
        .first()
    )

    return {
        "total_consultas": total_consultas,
        "consultas_mes": consultas_mes,
        "consultas_ano": consultas_ano,
        "pacientes_unicos": pacientes_unicos,
        "pacientes_ultimo_ano": pacientes_ano,
        "media_mensal": media_mensal,
        "por_tipo": por_tipo,
        "primeira_consulta": (
            primeira.data.isoformat() if primeira and primeira.data else None
        ),
        "ultima_consulta": ultima.data.isoformat() if ultima and ultima.data else None,
    }


def medico_to_dict(medico: Medicos, include_stats: bool = False) -> dict:
    """Converte médico para dicionário"""
    result = {
        "id": medico.id,
        "nome": medico.nome,
        "cpf": format_cpf(medico.cpf),
        "cpf_raw": medico.cpf,
        "crm": medico.crm,
        "crm_formatado": format_crm(medico.crm),
        "especialidade": medico.especialidade,
        "sexo": medico.sexo,
        "rqe": medico.rqe,
        "data_de_nascimento": (
            medico.data_de_nascimento.strftime("%Y-%m-%d")
            if medico.data_de_nascimento
            else None
        ),
        "data_de_nascimento_br": (
            medico.data_de_nascimento.strftime("%d/%m/%Y")
            if medico.data_de_nascimento
            else None
        ),
        "idade": (
            calculate_age(medico.data_de_nascimento)
            if medico.data_de_nascimento
            else None
        ),
    }

    if include_stats:
        result["estatisticas"] = get_medico_stats(medico.crm)

    return result


# ============================================
# CRUD Routes
# ============================================
@medicos_bp.route("/medicos", methods=["GET"])
def get_medicos():
    """
    Lista médicos com filtros.

    Query params:
        - search: busca por nome, CRM ou especialidade
        - nome: filtro por nome (parcial)
        - cpf: filtro por CPF
        - crm: filtro por CRM
        - especialidade: filtro por especialidade
        - sexo: M ou F
        - include_stats: incluir estatísticas (default: false)
        - order: ordenação (nome_asc, nome_desc, crm_asc, consultas_desc)
        - limit, offset: paginação
    """
    try:
        query = Medicos.query

        # Busca geral
        if search := request.args.get("search"):
            search_term = f"%{search}%"
            search_digits = only_digits(search)
            query = query.filter(
                or_(
                    Medicos.nome.ilike(search_term),
                    Medicos.especialidade.ilike(search_term),
                    (
                        func.cast(Medicos.crm, db.String).ilike(f"%{search_digits}%")
                        if search_digits
                        else False
                    ),
                )
            )

        # Filtros específicos
        if nome := request.args.get("nome"):
            query = query.filter(Medicos.nome.ilike(f"%{nome}%"))

        if cpf := request.args.get("cpf"):
            query = query.filter(Medicos.cpf == clean_cpf(cpf))

        if crm := request.args.get("crm"):
            query = query.filter(Medicos.crm == clean_crm(crm))

        if especialidade := request.args.get("especialidade"):
            query = query.filter(Medicos.especialidade.ilike(f"%{especialidade}%"))

        if sexo := request.args.get("sexo"):
            query = query.filter(Medicos.sexo == sexo.upper())

        # Ordenação
        order = request.args.get("order", "nome_asc")
        if order == "nome_desc":
            query = query.order_by(Medicos.nome.desc())
        elif order == "crm_asc":
            query = query.order_by(Medicos.crm.asc())
        elif order == "crm_desc":
            query = query.order_by(Medicos.crm.desc())
        else:
            query = query.order_by(Medicos.nome.asc())

        # Paginação
        if limit := request.args.get("limit"):
            query = query.limit(int(limit))
        if offset := request.args.get("offset"):
            query = query.offset(int(offset))

        medicos = query.all()

        include_stats = request.args.get("include_stats", "false").lower() == "true"

        # Se ordenar por consultas, precisa calcular stats
        if order == "consultas_desc":
            result = [medico_to_dict(m, include_stats=True) for m in medicos]
            result.sort(
                key=lambda x: x.get("estatisticas", {}).get("total_consultas", 0),
                reverse=True,
            )
        else:
            result = [medico_to_dict(m, include_stats=include_stats) for m in medicos]

        return jsonify(result)

    except Exception as e:
        current_app.logger.error(f"Erro ao listar médicos: {e}")
        return jsonify({"error": "Erro ao listar médicos"}), 500


@medicos_bp.route("/medicos/<int:id>", methods=["GET"])
def get_medico_by_id(id: int):
    """Busca médico por ID com estatísticas completas"""
    try:
        medico = Medicos.query.get(id)
        if not medico:
            return jsonify({"error": "Médico não encontrado"}), 404

        return jsonify(medico_to_dict(medico, include_stats=True))

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar médico {id}: {e}")
        return jsonify({"error": "Erro ao buscar médico"}), 500


@medicos_bp.route("/medicos/crm/<crm>", methods=["GET"])
def get_medico_by_crm(crm: str):
    """Busca médico por CRM"""
    try:
        crm_limpo = clean_crm(crm)
        medico = Medicos.query.filter(Medicos.crm == crm_limpo).first()

        if not medico:
            return jsonify({"error": "Médico não encontrado"}), 404

        return jsonify(medico_to_dict(medico, include_stats=True))

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar médico por CRM {crm}: {e}")
        return jsonify({"error": "Erro ao buscar médico"}), 500


@medicos_bp.route("/medicos", methods=["POST"])
def create_medico():
    """
    Cria novo médico.

    Body JSON:
        - nome (obrigatório)
        - cpf (obrigatório)
        - crm (obrigatório)
        - data_de_nascimento (obrigatório)
        - sexo (obrigatório): M ou F
        - especialidade (opcional)
        - rqe (opcional)
    """
    try:
        data = request.json or {}

        # Validações obrigatórias
        campos_obrigatorios = ["nome", "cpf", "crm", "data_de_nascimento", "sexo"]
        for campo in campos_obrigatorios:
            if not data.get(campo):
                return jsonify({"error": f"{campo} é obrigatório"}), 400

        cpf_limpo = clean_cpf(data["cpf"])
        crm_limpo = clean_crm(data["crm"])

        # Validar CPF (11 dígitos)
        if len(str(cpf_limpo)) > 11:
            return jsonify({"error": "CPF inválido"}), 400

        # Verificar duplicidade de CPF
        if Medicos.query.filter(Medicos.cpf == cpf_limpo).first():
            return jsonify({"error": "Já existe um médico com este CPF"}), 409

        # Verificar duplicidade de CRM
        if Medicos.query.filter(Medicos.crm == crm_limpo).first():
            return jsonify({"error": "Já existe um médico com este CRM"}), 409

        # Parse data de nascimento
        data_nascimento = parse_date(data["data_de_nascimento"])
        if not data_nascimento:
            return (
                jsonify(
                    {
                        "error": "Data de nascimento inválida. Use YYYY-MM-DD ou DD/MM/YYYY"
                    }
                ),
                400,
            )

        # Validar sexo
        sexo = data["sexo"].upper()
        if sexo not in ("M", "F"):
            return jsonify({"error": "Sexo inválido. Use 'M' ou 'F'"}), 400

        # Criar médico
        novo_medico = Medicos(
            nome=str(data["nome"]).strip(),
            cpf=cpf_limpo,
            crm=crm_limpo,
            data_de_nascimento=data_nascimento,
            sexo=sexo,
            especialidade=(data.get("especialidade") or "").strip() or None,
            rqe=int(only_digits(data.get("rqe"))) if data.get("rqe") else None,
        )

        db.session.add(novo_medico)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Médico criado com sucesso",
                    "medico": medico_to_dict(novo_medico),
                }
            ),
            201,
        )

    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(f"Erro de integridade ao criar médico: {e}")
        return jsonify({"error": "CPF ou CRM já cadastrado"}), 409

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Erro ao criar médico: {e}")
        return jsonify({"error": "Erro ao criar médico"}), 500


@medicos_bp.route("/medicos/<int:id>", methods=["PUT"])
def update_medico(id: int):
    """Atualiza médico existente"""
    try:
        medico = Medicos.query.get(id)
        if not medico:
            return jsonify({"error": "Médico não encontrado"}), 404

        data = request.json or {}

        # Atualizar nome
        if "nome" in data and data["nome"]:
            medico.nome = str(data["nome"]).strip()

        # Atualizar CPF
        if "cpf" in data and data["cpf"]:
            novo_cpf = clean_cpf(data["cpf"])
            existente = Medicos.query.filter(
                Medicos.cpf == novo_cpf, Medicos.id != id
            ).first()
            if existente:
                return (
                    jsonify({"error": "Este CPF já está cadastrado para outro médico"}),
                    409,
                )
            medico.cpf = novo_cpf

        # Atualizar CRM
        if "crm" in data and data["crm"]:
            novo_crm = clean_crm(data["crm"])
            existente = Medicos.query.filter(
                Medicos.crm == novo_crm, Medicos.id != id
            ).first()
            if existente:
                return (
                    jsonify({"error": "Este CRM já está cadastrado para outro médico"}),
                    409,
                )
            medico.crm = novo_crm

        # Atualizar data de nascimento
        if "data_de_nascimento" in data and data["data_de_nascimento"]:
            data_nascimento = parse_date(data["data_de_nascimento"])
            if not data_nascimento:
                return jsonify({"error": "Data de nascimento inválida"}), 400
            medico.data_de_nascimento = data_nascimento

        # Atualizar sexo
        if "sexo" in data and data["sexo"]:
            sexo = data["sexo"].upper()
            if sexo not in ("M", "F"):
                return jsonify({"error": "Sexo inválido. Use 'M' ou 'F'"}), 400
            medico.sexo = sexo

        # Atualizar especialidade
        if "especialidade" in data:
            medico.especialidade = (data.get("especialidade") or "").strip() or None

        # Atualizar RQE
        if "rqe" in data:
            medico.rqe = int(only_digits(data.get("rqe"))) if data.get("rqe") else None

        db.session.commit()

        return jsonify(
            {
                "message": "Médico atualizado com sucesso",
                "medico": medico_to_dict(medico),
            }
        )

    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(f"Erro de integridade ao atualizar médico: {e}")
        return jsonify({"error": "CPF ou CRM já cadastrado"}), 409

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Erro ao atualizar médico {id}: {e}")
        return jsonify({"error": "Erro ao atualizar médico"}), 500


@medicos_bp.route("/medicos/<int:id>", methods=["DELETE"])
def delete_medico(id: int):
    """Exclui médico (se não tiver consultas vinculadas)"""
    try:
        medico = Medicos.query.get(id)
        if not medico:
            return jsonify({"error": "Médico não encontrado"}), 404

        # Verificar consultas vinculadas
        consultas_count = Consultas.query.filter(
            Consultas.crm_medico == medico.crm
        ).count()
        if consultas_count > 0:
            return (
                jsonify(
                    {
                        "error": f"Não é possível excluir. Médico possui {consultas_count} consulta(s) vinculada(s)."
                    }
                ),
                409,
            )

        nome = medico.nome
        db.session.delete(medico)
        db.session.commit()

        return jsonify({"message": f"Médico '{nome}' excluído com sucesso"})

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Erro ao excluir médico {id}: {e}")
        return jsonify({"error": "Erro ao excluir médico"}), 500


# ============================================
# Estatísticas e Performance
# ============================================
@medicos_bp.route("/medicos/stats", methods=["GET"])
def get_medicos_stats():
    """Estatísticas gerais dos médicos"""
    try:
        total = Medicos.query.count()

        # Por sexo
        masculino = Medicos.query.filter(Medicos.sexo == "M").count()
        feminino = Medicos.query.filter(Medicos.sexo == "F").count()

        # Por especialidade
        especialidades = (
            db.session.query(
                Medicos.especialidade, func.count(Medicos.id).label("total")
            )
            .group_by(Medicos.especialidade)
            .all()
        )

        por_especialidade = [
            {"especialidade": e[0] or "Não especificada", "total": e[1]}
            for e in especialidades
        ]

        # Médicos ativos (com consulta nos últimos 30 dias)
        trinta_dias = date.today() - timedelta(days=30)
        medicos_ativos = (
            db.session.query(func.count(func.distinct(Consultas.crm_medico)))
            .filter(Consultas.data >= trinta_dias)
            .scalar()
            or 0
        )

        # Total de consultas realizadas
        total_consultas = Consultas.query.count()

        # Média de consultas por médico
        media_consultas = round(total_consultas / total, 1) if total > 0 else 0

        return jsonify(
            {
                "total_medicos": total,
                "medicos_ativos_30_dias": medicos_ativos,
                "total_consultas": total_consultas,
                "media_consultas_por_medico": media_consultas,
                "por_sexo": {"masculino": masculino, "feminino": feminino},
                "por_especialidade": por_especialidade,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar estatísticas de médicos: {e}")
        return jsonify({"error": "Erro ao buscar estatísticas"}), 500


@medicos_bp.route("/medicos/<int:id>/performance", methods=["GET"])
def get_medico_performance(id: int):
    """
    Análise detalhada de performance do médico.

    Query params:
        - periodo: 30dias, 90dias, 12meses, todos (default: 12meses)
    """
    try:
        medico = Medicos.query.get(id)
        if not medico:
            return jsonify({"error": "Médico não encontrado"}), 404

        periodo = request.args.get("periodo", "12meses")
        hoje = date.today()

        if periodo == "30dias":
            data_inicio = hoje - timedelta(days=30)
        elif periodo == "90dias":
            data_inicio = hoje - timedelta(days=90)
        elif periodo == "12meses":
            data_inicio = hoje - timedelta(days=365)
        else:
            data_inicio = None

        # Query base
        query = Consultas.query.filter(Consultas.crm_medico == medico.crm)
        if data_inicio:
            query = query.filter(Consultas.data >= data_inicio)

        # Métricas básicas
        total_consultas = query.count()
        pacientes_unicos = (
            db.session.query(func.count(func.distinct(Consultas.cpf_paciente)))
            .filter(
                Consultas.crm_medico == medico.crm,
                Consultas.data >= data_inicio if data_inicio else True,
            )
            .scalar()
            or 0
        )

        # Consultas por mês
        consultas_mes = (
            db.session.query(
                extract("year", Consultas.data).label("ano"),
                extract("month", Consultas.data).label("mes"),
                func.count(Consultas.id).label("total"),
            )
            .filter(
                Consultas.crm_medico == medico.crm,
                Consultas.data >= data_inicio if data_inicio else True,
            )
            .group_by(extract("year", Consultas.data), extract("month", Consultas.data))
            .order_by(extract("year", Consultas.data), extract("month", Consultas.data))
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

        historico_mensal = [
            {
                "ano": int(c.ano),
                "mes": int(c.mes),
                "mes_nome": meses_nomes[int(c.mes)],
                "total": c.total,
            }
            for c in consultas_mes
        ]

        # Por tipo de consulta
        por_tipo = (
            db.session.query(Consultas.tipo, func.count(Consultas.id).label("total"))
            .filter(
                Consultas.crm_medico == medico.crm,
                Consultas.data >= data_inicio if data_inicio else True,
            )
            .group_by(Consultas.tipo)
            .all()
        )

        tipos = [{"tipo": t[0] or "Não especificado", "total": t[1]} for t in por_tipo]

        # Por dia da semana
        por_dia_semana = (
            db.session.query(
                extract("dow", Consultas.data).label("dia"),
                func.count(Consultas.id).label("total"),
            )
            .filter(
                Consultas.crm_medico == medico.crm,
                Consultas.data >= data_inicio if data_inicio else True,
            )
            .group_by(extract("dow", Consultas.data))
            .all()
        )

        dias_nomes = [
            "Domingo",
            "Segunda",
            "Terça",
            "Quarta",
            "Quinta",
            "Sexta",
            "Sábado",
        ]
        distribuicao_semana = [
            {"dia": dias_nomes[int(d.dia)], "total": d.total} for d in por_dia_semana
        ]

        # Pacientes mais atendidos
        top_pacientes = (
            db.session.query(
                Pacientes.nome, Pacientes.cpf, func.count(Consultas.id).label("total")
            )
            .join(Consultas, Pacientes.cpf == Consultas.cpf_paciente)
            .filter(
                Consultas.crm_medico == medico.crm,
                Consultas.data >= data_inicio if data_inicio else True,
            )
            .group_by(Pacientes.nome, Pacientes.cpf)
            .order_by(func.count(Consultas.id).desc())
            .limit(10)
            .all()
        )

        pacientes_frequentes = [
            {"nome": p.nome, "cpf": format_cpf(p.cpf), "total_consultas": p.total}
            for p in top_pacientes
        ]

        return jsonify(
            {
                "medico": medico_to_dict(medico),
                "periodo": periodo,
                "metricas": {
                    "total_consultas": total_consultas,
                    "pacientes_unicos": pacientes_unicos,
                    "media_consultas_dia": (
                        round(total_consultas / 30, 1) if periodo == "30dias" else None
                    ),
                },
                "historico_mensal": historico_mensal,
                "por_tipo": tipos,
                "distribuicao_semana": distribuicao_semana,
                "pacientes_frequentes": pacientes_frequentes,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar performance do médico {id}: {e}")
        return jsonify({"error": "Erro ao buscar performance"}), 500


@medicos_bp.route("/medicos/autocomplete", methods=["GET"])
def autocomplete_medicos():
    """Busca rápida para autocomplete"""
    try:
        q = request.args.get("q", "").strip()
        limit = int(request.args.get("limit", 10))

        if len(q) < 2:
            return jsonify([])

        search_term = f"%{q}%"
        search_digits = only_digits(q)

        medicos = (
            Medicos.query.filter(
                or_(
                    Medicos.nome.ilike(search_term),
                    (
                        func.cast(Medicos.crm, db.String).ilike(f"%{search_digits}%")
                        if search_digits
                        else False
                    ),
                )
            )
            .order_by(Medicos.nome)
            .limit(limit)
            .all()
        )

        return jsonify(
            [
                {
                    "id": m.id,
                    "nome": m.nome,
                    "crm": m.crm,
                    "crm_formatado": format_crm(m.crm),
                    "especialidade": m.especialidade,
                }
                for m in medicos
            ]
        )

    except Exception as e:
        current_app.logger.error(f"Erro no autocomplete de médicos: {e}")
        return jsonify([])


# ============================================
# Relatórios
# ============================================
@medicos_bp.route("/medicos/relatorios/resumo", methods=["GET"])
def relatorio_resumo():
    """
    Dashboard resumo dos médicos.

    Query params:
        - periodo: 7dias, 30dias, 90dias, 12meses, todos
    """
    try:
        periodo = request.args.get("periodo", "30dias")
        hoje = date.today()

        if periodo == "7dias":
            data_inicio = hoje - timedelta(days=7)
        elif periodo == "30dias":
            data_inicio = hoje - timedelta(days=30)
        elif periodo == "90dias":
            data_inicio = hoje - timedelta(days=90)
        elif periodo == "12meses":
            data_inicio = hoje - timedelta(days=365)
        else:
            data_inicio = None

        # Totais gerais
        total_medicos = Medicos.query.count()

        # Query de consultas no período
        consultas_query = Consultas.query
        if data_inicio:
            consultas_query = consultas_query.filter(Consultas.data >= data_inicio)

        total_consultas = consultas_query.count()

        # Médicos ativos no período
        medicos_ativos = (
            db.session.query(func.count(func.distinct(Consultas.crm_medico)))
            .filter(Consultas.data >= data_inicio if data_inicio else True)
            .scalar()
            or 0
        )

        # Pacientes atendidos no período
        pacientes_atendidos = (
            db.session.query(func.count(func.distinct(Consultas.cpf_paciente)))
            .filter(Consultas.data >= data_inicio if data_inicio else True)
            .scalar()
            or 0
        )

        # Taxa de ocupação (médicos que atenderam / total de médicos)
        taxa_ocupacao = (
            round((medicos_ativos / total_medicos) * 100, 1) if total_medicos > 0 else 0
        )

        # Média de consultas por médico ativo
        media_por_medico = (
            round(total_consultas / medicos_ativos, 1) if medicos_ativos > 0 else 0
        )

        # Distribuição por especialidade
        por_especialidade = (
            db.session.query(
                Medicos.especialidade,
                func.count(Medicos.id).label("total_medicos"),
                func.count(Consultas.id).label("total_consultas"),
            )
            .outerjoin(
                Consultas,
                and_(
                    Medicos.crm == Consultas.crm_medico,
                    Consultas.data >= data_inicio if data_inicio else True,
                ),
            )
            .group_by(Medicos.especialidade)
            .all()
        )

        distribuicao_especialidade = [
            {
                "especialidade": e[0] or "Não especificada",
                "total_medicos": e[1],
                "total_consultas": e[2] or 0,
            }
            for e in por_especialidade
        ]

        return jsonify(
            {
                "periodo": periodo,
                "totais": {
                    "total_medicos": total_medicos,
                    "medicos_ativos": medicos_ativos,
                    "total_consultas": total_consultas,
                    "pacientes_atendidos": pacientes_atendidos,
                },
                "metricas": {
                    "taxa_ocupacao": taxa_ocupacao,
                    "media_consultas_por_medico": media_por_medico,
                },
                "distribuicao_especialidade": distribuicao_especialidade,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao gerar relatório resumo: {e}")
        return jsonify({"error": "Erro ao gerar relatório"}), 500


@medicos_bp.route("/medicos/relatorios/consultas-por-medico", methods=["GET"])
def relatorio_consultas_por_medico():
    """
    Ranking de médicos por quantidade de consultas.

    Query params:
        - periodo: 7dias, 30dias, 90dias, 12meses, todos
        - limite: quantidade máxima (default 20)
    """
    try:
        periodo = request.args.get("periodo", "30dias")
        limite = int(request.args.get("limite", 20))
        hoje = date.today()

        if periodo == "7dias":
            data_inicio = hoje - timedelta(days=7)
        elif periodo == "30dias":
            data_inicio = hoje - timedelta(days=30)
        elif periodo == "90dias":
            data_inicio = hoje - timedelta(days=90)
        elif periodo == "12meses":
            data_inicio = hoje - timedelta(days=365)
        else:
            data_inicio = None

        query = (
            db.session.query(
                Medicos,
                func.count(Consultas.id).label("total_consultas"),
                func.count(func.distinct(Consultas.cpf_paciente)).label(
                    "pacientes_unicos"
                ),
            )
            .outerjoin(
                Consultas,
                and_(
                    Medicos.crm == Consultas.crm_medico,
                    Consultas.data >= data_inicio if data_inicio else True,
                ),
            )
            .group_by(Medicos.id)
            .order_by(func.count(Consultas.id).desc())
            .limit(limite)
        )

        resultados = query.all()

        ranking = []
        for i, (medico, total, pacientes) in enumerate(resultados, 1):
            ranking.append(
                {
                    "posicao": i,
                    "id": medico.id,
                    "nome": medico.nome,
                    "crm": medico.crm,
                    "crm_formatado": format_crm(medico.crm),
                    "especialidade": medico.especialidade,
                    "total_consultas": total or 0,
                    "pacientes_unicos": pacientes or 0,
                }
            )

        return jsonify(
            {"periodo": periodo, "total_medicos": len(ranking), "ranking": ranking}
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao gerar ranking de consultas: {e}")
        return jsonify({"error": "Erro ao gerar relatório"}), 500


@medicos_bp.route("/medicos/relatorios/por-especialidade", methods=["GET"])
def relatorio_por_especialidade():
    """Distribuição de médicos e consultas por especialidade"""
    try:
        periodo = request.args.get("periodo", "30dias")
        hoje = date.today()

        if periodo == "7dias":
            data_inicio = hoje - timedelta(days=7)
        elif periodo == "30dias":
            data_inicio = hoje - timedelta(days=30)
        elif periodo == "90dias":
            data_inicio = hoje - timedelta(days=90)
        elif periodo == "12meses":
            data_inicio = hoje - timedelta(days=365)
        else:
            data_inicio = None

        resultados = (
            db.session.query(
                Medicos.especialidade,
                func.count(func.distinct(Medicos.id)).label("total_medicos"),
                func.count(Consultas.id).label("total_consultas"),
                func.count(func.distinct(Consultas.cpf_paciente)).label(
                    "pacientes_unicos"
                ),
            )
            .outerjoin(
                Consultas,
                and_(
                    Medicos.crm == Consultas.crm_medico,
                    Consultas.data >= data_inicio if data_inicio else True,
                ),
            )
            .group_by(Medicos.especialidade)
            .order_by(func.count(Consultas.id).desc())
            .all()
        )

        especialidades = [
            {
                "especialidade": r[0] or "Não especificada",
                "total_medicos": r[1],
                "total_consultas": r[2] or 0,
                "pacientes_unicos": r[3] or 0,
                "media_por_medico": round((r[2] or 0) / r[1], 1) if r[1] > 0 else 0,
            }
            for r in resultados
        ]

        return jsonify(
            {
                "periodo": periodo,
                "total_especialidades": len(especialidades),
                "especialidades": especialidades,
            }
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao gerar relatório por especialidade: {e}")
        return jsonify({"error": "Erro ao gerar relatório"}), 500


@medicos_bp.route("/medicos/relatorios/produtividade", methods=["GET"])
def relatorio_produtividade():
    """
    Análise de produtividade mensal dos médicos.

    Query params:
        - meses: quantidade de meses para análise (default 12)
    """
    try:
        meses = int(request.args.get("meses", 12))
        hoje = date.today()
        data_inicio = hoje - timedelta(days=meses * 30)

        # Consultas por mês
        consultas_mes = (
            db.session.query(
                extract("year", Consultas.data).label("ano"),
                extract("month", Consultas.data).label("mes"),
                func.count(Consultas.id).label("total_consultas"),
                func.count(func.distinct(Consultas.crm_medico)).label("medicos_ativos"),
                func.count(func.distinct(Consultas.cpf_paciente)).label(
                    "pacientes_atendidos"
                ),
            )
            .filter(Consultas.data >= data_inicio)
            .group_by(extract("year", Consultas.data), extract("month", Consultas.data))
            .order_by(extract("year", Consultas.data), extract("month", Consultas.data))
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

        historico = []
        for c in consultas_mes:
            media_por_medico = (
                round(c.total_consultas / c.medicos_ativos, 1)
                if c.medicos_ativos > 0
                else 0
            )
            historico.append(
                {
                    "ano": int(c.ano),
                    "mes": int(c.mes),
                    "mes_nome": meses_nomes[int(c.mes)],
                    "total_consultas": c.total_consultas,
                    "medicos_ativos": c.medicos_ativos,
                    "pacientes_atendidos": c.pacientes_atendidos,
                    "media_por_medico": media_por_medico,
                }
            )

        # Totais
        total_consultas = sum(h["total_consultas"] for h in historico)
        media_mensal = round(total_consultas / len(historico), 1) if historico else 0

        return jsonify(
            {
                "periodo_meses": meses,
                "historico": historico,
                "totais": {
                    "total_consultas": total_consultas,
                    "media_mensal": media_mensal,
                },
            }
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao gerar relatório de produtividade: {e}")
        return jsonify({"error": "Erro ao gerar relatório"}), 500


@medicos_bp.route("/medicos/relatorios/agenda-ocupacao", methods=["GET"])
def relatorio_agenda_ocupacao():
    """
    Análise de ocupação da agenda por dia da semana e horário.

    Query params:
        - periodo: 30dias, 90dias, 12meses
    """
    try:
        periodo = request.args.get("periodo", "30dias")
        hoje = date.today()

        if periodo == "30dias":
            data_inicio = hoje - timedelta(days=30)
        elif periodo == "90dias":
            data_inicio = hoje - timedelta(days=90)
        else:
            data_inicio = hoje - timedelta(days=365)

        # Por dia da semana
        por_dia = (
            db.session.query(
                extract("dow", Consultas.data).label("dia"),
                func.count(Consultas.id).label("total"),
            )
            .filter(Consultas.data >= data_inicio)
            .group_by(extract("dow", Consultas.data))
            .all()
        )

        dias_nomes = [
            "Domingo",
            "Segunda",
            "Terça",
            "Quarta",
            "Quinta",
            "Sexta",
            "Sábado",
        ]
        ocupacao_semana = [
            {"dia": dias_nomes[int(d.dia)], "dia_numero": int(d.dia), "total": d.total}
            for d in por_dia
        ]
        ocupacao_semana.sort(key=lambda x: x["dia_numero"])

        # Por faixa de horário
        por_hora = (
            db.session.query(
                extract("hour", Consultas.hora_consulta).label("hora"),
                func.count(Consultas.id).label("total"),
            )
            .filter(Consultas.data >= data_inicio, Consultas.hora_consulta.isnot(None))
            .group_by(extract("hour", Consultas.hora_consulta))
            .all()
        )

        ocupacao_horario = [
            {
                "hora": int(h.hora),
                "faixa": f"{int(h.hora):02d}:00-{int(h.hora):02d}:59",
                "total": h.total,
            }
            for h in por_hora
        ]
        ocupacao_horario.sort(key=lambda x: x["hora"])

        # Dia mais movimentado
        dia_mais_movimentado = (
            max(ocupacao_semana, key=lambda x: x["total"]) if ocupacao_semana else None
        )

        # Horário de pico
        horario_pico = (
            max(ocupacao_horario, key=lambda x: x["total"])
            if ocupacao_horario
            else None
        )

        return jsonify(
            {
                "periodo": periodo,
                "ocupacao_semana": ocupacao_semana,
                "ocupacao_horario": ocupacao_horario,
                "insights": {
                    "dia_mais_movimentado": (
                        dia_mais_movimentado["dia"] if dia_mais_movimentado else None
                    ),
                    "horario_pico": horario_pico["faixa"] if horario_pico else None,
                },
            }
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao gerar relatório de ocupação: {e}")
        return jsonify({"error": "Erro ao gerar relatório"}), 500
