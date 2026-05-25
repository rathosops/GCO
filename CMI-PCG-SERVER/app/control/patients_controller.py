"""
Controller para pacientes - Módulo Completo
"""

from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Any

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.patients_model import Pacientes
from app.models.companies_model import Empresas
from app.models.insurances_model import Convenios
from app.models.medical_appointments_model import Consultas
from app.utils.validators import normalize_for_search

pacientes_bp = Blueprint("pacientes", __name__)

# ============================================
# Constantes de convênio IMESC
# ============================================
IMESC_CNPJ_DIGITS = "43054154000179"

DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y")
ALLOWED_SEX = {"M", "F"}


# ============================================
# Helpers de formatação / limpeza
# ============================================
def only_digits(value: Any) -> str:
    """Extrai apenas dígitos de um valor."""
    return "".join(c for c in str(value or "") if c.isdigit())


def parse_bool(value: Any) -> bool | None:
    """
    Converte valores comuns em booleano.

    Aceita:
      - bool
      - int (0/1)
      - str ("true", "false", "1", "0", "sim", "não"...)
    """
    if value is None or value == "":
        return None

    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        if value in (0, 1):
            return bool(value)
        return None

    v = str(value).strip().lower()
    if v in {"true", "1", "sim", "yes"}:
        return True
    if v in {"false", "0", "nao", "não", "no"}:
        return False
    return None


def require_cpf_11(cpf_digits: str) -> str:
    """Garante CPF com exatamente 11 dígitos."""
    if len(cpf_digits) != 11:
        raise ValueError("CPF deve conter exatamente 11 dígitos")
    return cpf_digits


def clean_cpf(cpf: str | int | None) -> str:
    """
    Remove formatação do CPF e retorna como string de 11 dígitos.
    Não faz 'zfill' (não completa com zeros). Exige 11 dígitos.
    """
    digits = only_digits(cpf)
    if not digits:
        return ""
    return require_cpf_11(digits)


def format_cpf(cpf: str | int | None) -> str:
    """Formata CPF para exibição: XXX.XXX.XXX-XX (se tiver 11 dígitos)."""
    digits = only_digits(cpf)
    if len(digits) != 11:
        return digits or ""
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:11]}"


def format_cnpj(cnpj: str | int | None) -> str:
    """Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX (se tiver 14 dígitos)."""
    digits = only_digits(cnpj)
    if len(digits) != 14:
        return digits or ""
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}"


def clean_cnpj(cnpj: str | int | None) -> int:
    """Remove formatação do CNPJ e retorna como inteiro (somente dígitos)."""
    digits = only_digits(cnpj)
    if not digits:
        raise ValueError("CNPJ é obrigatório")
    return int(digits)


def is_imesc_cnpj(cnpj_value: int | str | None) -> bool:
    """Retorna True se o CNPJ for o do IMESC."""
    if not cnpj_value:
        return False
    return only_digits(cnpj_value) == IMESC_CNPJ_DIGITS


def clean_phone(phone: str | int | None) -> int | None:
    """Telefone -> inteiro (só dígitos). Retorna None se vazio."""
    digits = only_digits(phone)
    return int(digits) if digits else None


def clean_cep(cep: str | None) -> str | None:
    """CEP -> string com 8 dígitos (sem hífen)."""
    if not cep:
        return None
    digits = only_digits(cep)
    return digits if len(digits) == 8 else None


def format_cep(cep: str | None) -> str | None:
    """Formata CEP: 00000-000 (se tiver 8 dígitos)."""
    if not cep:
        return None
    digits = only_digits(cep)
    if len(digits) != 8:
        return digits or None
    return f"{digits[:5]}-{digits[5:]}"


def parse_date(date_str: str) -> date | None:
    """Converte string de data para objeto date (aceita múltiplos formatos)."""
    if not date_str:
        return None

    s = str(date_str).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def calculate_age(birth_date: date) -> int:
    """Calcula idade a partir da data de nascimento."""
    today = date.today()
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


def normalize_protocolo_imesc(value: str | None) -> str | None:
    """Normaliza espaços e retorna None se vazio."""
    if value is None:
        return None
    s = str(value).strip()
    return " ".join(s.split()) if s else None


def validate_protocolo_imesc(value: str | None) -> bool:
    """Protocolo IMESC deve começar com 'CLI' e conter ao menos um dígito."""
    s = normalize_protocolo_imesc(value)
    if not s:
        return False
    up = s.upper()
    return up.startswith("CLI") and len(only_digits(s)) > 0


def format_protocolo_imesc(value: str | None) -> str | None:
    """Normaliza para o formato: 'CLI - <número>'."""
    s = normalize_protocolo_imesc(value)
    if not s:
        return None
    num = only_digits(s)
    return f"CLI - {num}" if num else None


def build_endereco_compat(p: Pacientes) -> str | None:
    """Monta string de endereço com base nos campos estruturados."""
    if p.logradouro or p.bairro or p.cidade or p.uf or p.cep:
        parts: list[str] = []
        if p.logradouro:
            line = p.logradouro
            if p.numero:
                line += f", {p.numero}"
            if p.complemento:
                line += f" ({p.complemento})"
            parts.append(line)
        if p.bairro:
            parts.append(p.bairro)
        if p.cidade or p.uf:
            cityuf = " - ".join([x for x in [p.cidade, p.uf] if x])
            if cityuf:
                parts.append(cityuf)
        if p.cep:
            parts.append(f"CEP {format_cep(p.cep) or p.cep}")
        return " | ".join(parts)
    return p.endereco


def get_patient_frequency_data(cpf: str) -> dict:
    """Calcula dados de frequência do paciente."""
    consultas = Consultas.query.filter(Consultas.cpf_paciente == cpf).all()

    if not consultas:
        return {
            "total_consultas": 0,
            "primeira_consulta": None,
            "ultima_consulta": None,
            "media_dias_entre_consultas": None,
            "consultas_ultimo_ano": 0,
            "consultas_ultimo_mes": 0,
            "nivel_fidelidade": "novo",
            "pontos_fidelidade": 0,
        }

    datas = sorted([c.data for c in consultas if c.data])
    if not datas:
        return {
            "total_consultas": len(consultas),
            "primeira_consulta": None,
            "ultima_consulta": None,
            "media_dias_entre_consultas": None,
            "consultas_ultimo_ano": 0,
            "consultas_ultimo_mes": 0,
            "nivel_fidelidade": "novo",
            "pontos_fidelidade": 0,
        }

    hoje = date.today()
    um_ano_atras = hoje - timedelta(days=365)
    um_mes_atras = hoje - timedelta(days=30)

    consultas_ultimo_ano = len([d for d in datas if d >= um_ano_atras])
    consultas_ultimo_mes = len([d for d in datas if d >= um_mes_atras])

    media_dias = None
    if len(datas) > 1:
        intervalos = [(datas[i + 1] - datas[i]).days for i in range(len(datas) - 1)]
        media_dias = sum(intervalos) / len(intervalos) if intervalos else None

    total = len(consultas)
    pontos = total * 10

    if total >= 20:
        nivel = "ouro"
    elif total >= 10:
        nivel = "prata"
    elif total >= 5:
        nivel = "bronze"
    else:
        nivel = "novo"

    return {
        "total_consultas": total,
        "primeira_consulta": datas[0].isoformat() if datas else None,
        "ultima_consulta": datas[-1].isoformat() if datas else None,
        "media_dias_entre_consultas": round(media_dias, 1) if media_dias else None,
        "consultas_ultimo_ano": consultas_ultimo_ano,
        "consultas_ultimo_mes": consultas_ultimo_mes,
        "nivel_fidelidade": nivel,
        "pontos_fidelidade": pontos,
    }


def paciente_to_dict(
    paciente: Pacientes,
    include_relations: bool = True,
    include_frequency: bool = False,
) -> dict:
    """Converte paciente para dicionário com dados formatados."""
    result = {
        "id": paciente.id,
        "nome": paciente.nome,
        "cpf": format_cpf(paciente.cpf),
        "cpf_raw": paciente.cpf,
        "data_de_nascimento": (
            paciente.data_de_nascimento.strftime("%Y-%m-%d")
            if paciente.data_de_nascimento
            else None
        ),
        "data_de_nascimento_br": (
            paciente.data_de_nascimento.strftime("%d/%m/%Y")
            if paciente.data_de_nascimento
            else None
        ),
        "idade": (
            calculate_age(paciente.data_de_nascimento)
            if paciente.data_de_nascimento
            else None
        ),
        "sexo": paciente.sexo,
        "numero_de_contato": paciente.numero_de_contato,
        "email": paciente.email,
        "vinculado_a_empresa": (
            bool(paciente.vinculado_a_empresa)
            if paciente.vinculado_a_empresa is not None
            else False
        ),
        "cnpj_empresa": (
            format_cnpj(paciente.cnpj_empresa) if paciente.cnpj_empresa else None
        ),
        "cnpj_empresa_raw": paciente.cnpj_empresa,
        "vinculado_a_convenio": (
            bool(paciente.vinculado_a_convenio)
            if paciente.vinculado_a_convenio is not None
            else False
        ),
        "cnpj_convenio": (
            format_cnpj(paciente.cnpj_convenio) if paciente.cnpj_convenio else None
        ),
        "cnpj_convenio_raw": paciente.cnpj_convenio,
        "protocolo_imesc": getattr(paciente, "protocolo_imesc", None),
        "is_imesc": (
            is_imesc_cnpj(paciente.cnpj_convenio)
            if (paciente.vinculado_a_convenio and paciente.cnpj_convenio)
            else False
        ),
        "cep": format_cep(paciente.cep) if paciente.cep else None,
        "cep_raw": paciente.cep,
        "logradouro": paciente.logradouro,
        "numero": paciente.numero,
        "complemento": paciente.complemento,
        "bairro": paciente.bairro,
        "cidade": paciente.cidade,
        "uf": paciente.uf,
        "endereco": paciente.endereco,
        "endereco_compacto": build_endereco_compat(paciente),
    }

    if include_relations:
        if paciente.empresa:
            result["empresa"] = {
                "id": paciente.empresa.id,
                "nome": paciente.empresa.nome,
                "cnpj": format_cnpj(paciente.empresa.cnpj),
            }
        else:
            result["empresa"] = None

        if paciente.convenio:
            result["convenio"] = {
                "id": paciente.convenio.id,
                "nome": paciente.convenio.nome,
                "cnpj": format_cnpj(paciente.convenio.cnpj),
                "emite_guia": (
                    paciente.convenio.emite_guia
                    if hasattr(paciente.convenio, "emite_guia")
                    else False
                ),
                "is_imesc": is_imesc_cnpj(paciente.convenio.cnpj),
            }
        else:
            result["convenio"] = None

    if include_frequency and paciente.cpf:
        result["frequencia"] = get_patient_frequency_data(paciente.cpf)

    return result


def _safe_int(value: Any, *, default: int | None = None) -> int | None:
    """Converte value em int de forma segura (retorna default se vazio)."""
    if value is None or value == "":
        return default
    return int(value)


# ============================================
# GET - Listar todos os pacientes
# ============================================
@pacientes_bp.route("/pacientes", methods=["GET"])
def get_pacientes():
    """Lista todos os pacientes com filtros opcionais."""
    try:
        query = Pacientes.query

        if cpf := request.args.get("cpf"):
            try:
                cpf_limpo = clean_cpf(cpf)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400
            query = query.filter(Pacientes.cpf == cpf_limpo)

        if nome := request.args.get("nome"):
            query = query.filter(Pacientes.nome.ilike(f"%{nome}%"))

        if cnpj_empresa := request.args.get("cnpj_empresa"):
            try:
                cnpj_limpo = clean_cnpj(cnpj_empresa)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400
            query = query.filter(Pacientes.cnpj_empresa == cnpj_limpo)

        if cnpj_convenio := request.args.get("cnpj_convenio"):
            try:
                cnpj_limpo = clean_cnpj(cnpj_convenio)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400
            query = query.filter(Pacientes.cnpj_convenio == cnpj_limpo)

        vinc_empresa = parse_bool(request.args.get("vinculado_a_empresa"))
        if vinc_empresa is not None:
            query = query.filter(Pacientes.vinculado_a_empresa.is_(vinc_empresa))

        vinc_convenio = parse_bool(request.args.get("vinculado_a_convenio"))
        if vinc_convenio is not None:
            query = query.filter(Pacientes.vinculado_a_convenio.is_(vinc_convenio))

        if sexo := request.args.get("sexo"):
            sexo_norm = sexo.strip().upper()
            query = query.filter(Pacientes.sexo == sexo_norm)

        if cep := request.args.get("cep"):
            cep_limpo = clean_cep(cep)
            if cep_limpo:
                query = query.filter(Pacientes.cep == cep_limpo)

        if cidade := request.args.get("cidade"):
            query = query.filter(Pacientes.cidade.ilike(f"%{cidade}%"))

        if uf := request.args.get("uf"):
            query = query.filter(Pacientes.uf == uf.strip().upper())

        if search := request.args.get("search"):
            normalized_s = normalize_for_search(search)
            digits_s = only_digits(search)
            search_filters = [func.unaccent(Pacientes.nome).ilike(f"%{normalized_s}%")]
            if digits_s and len(digits_s) >= 3:
                search_filters.append(Pacientes.cpf.ilike(f"%{digits_s}%"))
            query = query.filter(or_(*search_filters))

        order = request.args.get("order", "nome_asc")
        if order == "nome_desc":
            query = query.order_by(Pacientes.nome.desc())
        elif order == "recente":
            query = query.order_by(Pacientes.id.desc())
        elif order == "antigo":
            query = query.order_by(Pacientes.id.asc())
        else:
            query = query.order_by(Pacientes.nome.asc())

        limit = _safe_int(request.args.get("limit"), default=None)
        offset = _safe_int(request.args.get("offset"), default=None)
        if limit is not None and limit > 0:
            query = query.limit(limit)
        if offset is not None and offset >= 0:
            query = query.offset(offset)

        pacientes = query.all()

        include_frequency = parse_bool(request.args.get("include_frequency")) is True

        result = [
            paciente_to_dict(p, include_frequency=include_frequency) for p in pacientes
        ]

        if nivel_fidelidade := request.args.get("nivel_fidelidade"):
            if include_frequency:
                result = [
                    p
                    for p in result
                    if p.get("frequencia", {}).get("nivel_fidelidade")
                    == nivel_fidelidade
                ]

        return jsonify(result)

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error("Erro ao listar pacientes: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao listar pacientes"}), 500


# ============================================
# GET - Buscar paciente por ID
# ============================================
@pacientes_bp.route("/pacientes/<int:id>", methods=["GET"])
def get_paciente_by_id(id: int):
    """Busca paciente por ID com dados completos."""
    try:
        paciente = Pacientes.query.get(id)
        if not paciente:
            return jsonify({"error": "Paciente não encontrado"}), 404

        return jsonify(
            paciente_to_dict(paciente, include_relations=True, include_frequency=True)
        )

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "Erro ao buscar paciente %s: %s", id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar paciente"}), 500


# ============================================
# GET - Buscar paciente por CPF
# ============================================
@pacientes_bp.route("/pacientes/cpf/<cpf>", methods=["GET"])
def get_paciente_by_cpf(cpf: str):
    """Busca paciente por CPF."""
    try:
        try:
            cpf_limpo = clean_cpf(cpf)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        paciente = Pacientes.query.filter(Pacientes.cpf == cpf_limpo).first()
        if not paciente:
            return jsonify({"error": "Paciente não encontrado"}), 404

        return jsonify(
            paciente_to_dict(paciente, include_relations=True, include_frequency=True)
        )

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "Erro ao buscar paciente por CPF %s: %s", cpf, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar paciente"}), 500


# ============================================
# GET - Frequência de um paciente específico
# ============================================
@pacientes_bp.route("/pacientes/<int:id>/frequencia", methods=["GET"])
def get_paciente_frequencia(id: int):
    """Retorna dados de frequência de visitas do paciente."""
    try:
        paciente = Pacientes.query.get(id)
        if not paciente:
            return jsonify({"error": "Paciente não encontrado"}), 404

        if not paciente.cpf:
            return jsonify({"error": "Paciente não possui CPF cadastrado"}), 400

        frequencia = get_patient_frequency_data(paciente.cpf)

        consultas = (
            Consultas.query.filter(Consultas.cpf_paciente == paciente.cpf)
            .order_by(Consultas.data.desc(), Consultas.hora_consulta.desc())
            .limit(10)
            .all()
        )

        frequencia["ultimas_consultas"] = [
            {
                "id": c.id,
                "data": c.data.isoformat() if c.data else None,
                "hora": c.hora_consulta.strftime("%H:%M") if c.hora_consulta else None,
                "tipo": c.tipo,
                "procedimentos": getattr(c, "procedimentos", None),
            }
            for c in consultas
        ]

        return jsonify(
            {
                "paciente": {
                    "id": paciente.id,
                    "nome": paciente.nome,
                    "cpf": format_cpf(paciente.cpf),
                },
                "frequencia": frequencia,
            }
        )

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "Erro ao buscar frequência do paciente %s: %s", id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar frequência"}), 500


# ============================================
# POST - Criar novo paciente
# ============================================
@pacientes_bp.route("/pacientes", methods=["POST"])
def create_paciente():
    """Cria novo paciente."""
    try:
        data = request.json or {}

        if not data.get("nome"):
            return jsonify({"error": "Nome é obrigatório"}), 400
        if not data.get("cpf"):
            return jsonify({"error": "CPF é obrigatório"}), 400
        if not data.get("data_de_nascimento"):
            return jsonify({"error": "Data de nascimento é obrigatória"}), 400

        try:
            cpf_limpo = clean_cpf(data["cpf"])
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        if Pacientes.query.filter(Pacientes.cpf == cpf_limpo).first():
            return jsonify({"error": "Paciente com este CPF já está cadastrado"}), 409

        data_nascimento = parse_date(str(data["data_de_nascimento"]))
        if not data_nascimento:
            return (
                jsonify(
                    {"error": "Formato de data inválido. Use YYYY-MM-DD ou DD/MM/YYYY"}
                ),
                400,
            )

        vinculado_empresa = parse_bool(data.get("vinculado_a_empresa")) or False
        cnpj_empresa = None
        if vinculado_empresa:
            if not data.get("cnpj_empresa"):
                return (
                    jsonify(
                        {
                            "error": "cnpj_empresa é obrigatório quando vinculado_a_empresa=true"
                        }
                    ),
                    400,
                )
            try:
                cnpj_empresa = clean_cnpj(data["cnpj_empresa"])
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400
            if not Empresas.query.filter(Empresas.cnpj == cnpj_empresa).first():
                return jsonify({"error": "Empresa não encontrada"}), 404

        vinculado_convenio = parse_bool(data.get("vinculado_a_convenio")) or False
        cnpj_convenio = None
        if vinculado_convenio:
            if not data.get("cnpj_convenio"):
                return (
                    jsonify(
                        {
                            "error": "cnpj_convenio é obrigatório quando vinculado_a_convenio=true"
                        }
                    ),
                    400,
                )
            try:
                cnpj_convenio = clean_cnpj(data["cnpj_convenio"])
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400
            if not Convenios.query.filter(Convenios.cnpj == cnpj_convenio).first():
                return jsonify({"error": "Convênio não encontrado"}), 404

        protocolo_imesc = None
        if vinculado_convenio and cnpj_convenio and is_imesc_cnpj(cnpj_convenio):
            if not validate_protocolo_imesc(data.get("protocolo_imesc")):
                return (
                    jsonify(
                        {
                            "error": "Protocolo IMESC é obrigatório e deve começar com 'CLI -' seguido de número."
                        }
                    ),
                    400,
                )
            protocolo_imesc = format_protocolo_imesc(data.get("protocolo_imesc"))

        cep = clean_cep(data.get("cep"))
        if data.get("cep") and not cep:
            return jsonify({"error": "CEP inválido (use 8 dígitos)"}), 400

        uf = (data.get("uf") or "").strip().upper() or None
        if uf and len(uf) != 2:
            return jsonify({"error": "UF inválida (use 2 letras, ex: SP)"}), 400

        sexo = (data.get("sexo") or "").strip().upper() or None
        if sexo and sexo not in ALLOWED_SEX:
            return jsonify({"error": "Sexo inválido (use 'M' ou 'F')"}), 400

        novo_paciente = Pacientes(
            nome=str(data["nome"]).strip(),
            cpf=cpf_limpo,
            data_de_nascimento=data_nascimento,
            sexo=sexo,
            numero_de_contato=clean_phone(data.get("numero_de_contato")),
            email=(data.get("email") or "").strip() or None,
            vinculado_a_empresa=vinculado_empresa,
            cnpj_empresa=cnpj_empresa,
            vinculado_a_convenio=vinculado_convenio,
            cnpj_convenio=cnpj_convenio,
            protocolo_imesc=protocolo_imesc,
            cep=cep,
            logradouro=(data.get("logradouro") or "").strip() or None,
            numero=(data.get("numero") or "").strip() or None,
            complemento=(data.get("complemento") or "").strip() or None,
            bairro=(data.get("bairro") or "").strip() or None,
            cidade=(data.get("cidade") or "").strip() or None,
            uf=uf,
            endereco=(data.get("endereco") or "").strip() or None,
        )

        db.session.add(novo_paciente)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Paciente criado com sucesso",
                    "paciente": paciente_to_dict(novo_paciente),
                }
            ),
            201,
        )

    except IntegrityError as exc:
        db.session.rollback()
        current_app.logger.error(
            "Erro de integridade ao criar paciente: %s", exc, exc_info=True
        )
        return jsonify({"error": "Paciente com este CPF já está cadastrado"}), 409
    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error("Erro ao criar paciente: %s", exc, exc_info=True)
        return jsonify({"error": "Erro ao criar paciente"}), 500


# ============================================
# PUT - Atualizar paciente
# ============================================
@pacientes_bp.route("/pacientes/<int:id>", methods=["PUT"])
def update_paciente(id: int):
    """Atualiza paciente existente."""
    try:
        paciente = Pacientes.query.get(id)
        if not paciente:
            return jsonify({"error": "Paciente não encontrado"}), 404

        data = request.json or {}

        if "cpf" in data and data.get("cpf"):
            try:
                novo_cpf = clean_cpf(data["cpf"])
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400

            existente = Pacientes.query.filter(
                Pacientes.cpf == novo_cpf, Pacientes.id != id
            ).first()
            if existente:
                return (
                    jsonify(
                        {"error": "Este CPF já está cadastrado para outro paciente"}
                    ),
                    409,
                )
            paciente.cpf = novo_cpf

        if "nome" in data and data.get("nome"):
            paciente.nome = str(data["nome"]).strip()

        if "data_de_nascimento" in data and data.get("data_de_nascimento"):
            data_nascimento = parse_date(str(data["data_de_nascimento"]))
            if not data_nascimento:
                return (
                    jsonify(
                        {
                            "error": "Formato de data inválido. Use YYYY-MM-DD ou DD/MM/YYYY"
                        }
                    ),
                    400,
                )
            paciente.data_de_nascimento = data_nascimento

        if "sexo" in data:
            sexo = (data.get("sexo") or "").strip().upper() or None
            if sexo and sexo not in ALLOWED_SEX:
                return jsonify({"error": "Sexo inválido (use 'M' ou 'F')"}), 400
            paciente.sexo = sexo

        if "numero_de_contato" in data:
            paciente.numero_de_contato = clean_phone(data.get("numero_de_contato"))

        if "email" in data:
            paciente.email = (data.get("email") or "").strip() or None

        if "cep" in data:
            if data.get("cep"):
                cep = clean_cep(data.get("cep"))
                if not cep:
                    return jsonify({"error": "CEP inválido (use 8 dígitos)"}), 400
                paciente.cep = cep
            else:
                paciente.cep = None

        if "logradouro" in data:
            paciente.logradouro = (data.get("logradouro") or "").strip() or None
        if "numero" in data:
            paciente.numero = (data.get("numero") or "").strip() or None
        if "complemento" in data:
            paciente.complemento = (data.get("complemento") or "").strip() or None
        if "bairro" in data:
            paciente.bairro = (data.get("bairro") or "").strip() or None
        if "cidade" in data:
            paciente.cidade = (data.get("cidade") or "").strip() or None
        if "uf" in data:
            uf = (data.get("uf") or "").strip().upper() or None
            if uf and len(uf) != 2:
                return jsonify({"error": "UF inválida (use 2 letras, ex: SP)"}), 400
            paciente.uf = uf

        if "endereco" in data:
            paciente.endereco = (data.get("endereco") or "").strip() or None

        if "vinculado_a_empresa" in data:
            vinc = parse_bool(data.get("vinculado_a_empresa"))
            if vinc is None:
                return (
                    jsonify({"error": "vinculado_a_empresa inválido (use true/false)"}),
                    400,
                )
            paciente.vinculado_a_empresa = vinc
            if not vinc:
                paciente.cnpj_empresa = None

        if "cnpj_empresa" in data:
            if data.get("cnpj_empresa"):
                try:
                    cnpj_empresa = clean_cnpj(data["cnpj_empresa"])
                except ValueError as exc:
                    return jsonify({"error": str(exc)}), 400
                if not Empresas.query.filter(Empresas.cnpj == cnpj_empresa).first():
                    return jsonify({"error": "Empresa não encontrada"}), 404
                paciente.cnpj_empresa = cnpj_empresa
                paciente.vinculado_a_empresa = True
            else:
                paciente.cnpj_empresa = None

        if "vinculado_a_convenio" in data:
            vinc = parse_bool(data.get("vinculado_a_convenio"))
            if vinc is None:
                return (
                    jsonify(
                        {"error": "vinculado_a_convenio inválido (use true/false)"}
                    ),
                    400,
                )
            paciente.vinculado_a_convenio = vinc
            if not vinc:
                paciente.cnpj_convenio = None
                paciente.protocolo_imesc = None

        if "cnpj_convenio" in data:
            if data.get("cnpj_convenio"):
                try:
                    cnpj_convenio = clean_cnpj(data["cnpj_convenio"])
                except ValueError as exc:
                    return jsonify({"error": str(exc)}), 400

                if not Convenios.query.filter(Convenios.cnpj == cnpj_convenio).first():
                    return jsonify({"error": "Convênio não encontrado"}), 404

                paciente.cnpj_convenio = cnpj_convenio
                paciente.vinculado_a_convenio = True

                if is_imesc_cnpj(cnpj_convenio):
                    incoming_proto = data.get(
                        "protocolo_imesc", paciente.protocolo_imesc
                    )
                    if not validate_protocolo_imesc(incoming_proto):
                        return (
                            jsonify(
                                {
                                    "error": "Protocolo IMESC é obrigatório e deve começar com 'CLI -' seguido de número."
                                }
                            ),
                            400,
                        )
                    paciente.protocolo_imesc = format_protocolo_imesc(incoming_proto)
                else:
                    paciente.protocolo_imesc = None
            else:
                paciente.cnpj_convenio = None
                paciente.protocolo_imesc = None

        if "protocolo_imesc" in data:
            if (
                paciente.vinculado_a_convenio
                and paciente.cnpj_convenio
                and is_imesc_cnpj(paciente.cnpj_convenio)
            ):
                if not validate_protocolo_imesc(data.get("protocolo_imesc")):
                    return (
                        jsonify(
                            {"error": "Protocolo IMESC inválido. Use 'CLI - <número>'."}
                        ),
                        400,
                    )
                paciente.protocolo_imesc = format_protocolo_imesc(
                    data.get("protocolo_imesc")
                )
            else:
                paciente.protocolo_imesc = None

        db.session.commit()

        return jsonify(
            {
                "message": "Paciente atualizado com sucesso",
                "paciente": paciente_to_dict(paciente),
            }
        )

    except IntegrityError as exc:
        db.session.rollback()
        current_app.logger.error(
            "Erro de integridade ao atualizar paciente: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao atualizar paciente"}), 409
    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error(
            "Erro ao atualizar paciente %s: %s", id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao atualizar paciente"}), 500


# ============================================
# DELETE - Excluir paciente
# ============================================
@pacientes_bp.route("/pacientes/<int:id>", methods=["DELETE"])
def delete_paciente(id: int):
    """Exclui paciente."""
    try:
        paciente = Pacientes.query.get(id)
        if not paciente:
            return jsonify({"error": "Paciente não encontrado"}), 404

        consultas_count = Consultas.query.filter(
            Consultas.cpf_paciente == paciente.cpf
        ).count()
        if consultas_count > 0:
            return (
                jsonify(
                    {
                        "error": (
                            "Não é possível excluir. Paciente possui "
                            f"{consultas_count} consulta(s) vinculada(s)."
                        )
                    }
                ),
                409,
            )

        nome_paciente = paciente.nome
        db.session.delete(paciente)
        db.session.commit()

        return jsonify({"message": f"Paciente '{nome_paciente}' excluído com sucesso"})

    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error(
            "Erro ao excluir paciente %s: %s", id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao excluir paciente"}), 500


# ============================================
# GET - Estatísticas de pacientes
# ============================================
@pacientes_bp.route("/pacientes/stats", methods=["GET"])
def get_pacientes_stats():
    """Retorna estatísticas dos pacientes."""
    try:
        total = Pacientes.query.count()

        total_empresa = Pacientes.query.filter(
            Pacientes.vinculado_a_empresa.is_(True)
        ).count()
        total_convenio = Pacientes.query.filter(
            Pacientes.vinculado_a_convenio.is_(True)
        ).count()

        total_particular = Pacientes.query.filter(
            Pacientes.vinculado_a_empresa.isnot(True),
            Pacientes.vinculado_a_convenio.isnot(True),
        ).count()

        masculino = Pacientes.query.filter(Pacientes.sexo == "M").count()
        feminino = Pacientes.query.filter(Pacientes.sexo == "F").count()
        stats_sexo = {"masculino": masculino, "feminino": feminino}

        top_empresas = (
            db.session.query(Empresas.nome, func.count(Pacientes.id).label("total"))
            .join(Pacientes, Empresas.cnpj == Pacientes.cnpj_empresa)
            .group_by(Empresas.nome)
            .order_by(func.count(Pacientes.id).desc())
            .limit(5)
            .all()
        )

        pacientes_todos = Pacientes.query.all()
        faixas = {"0-17": 0, "18-30": 0, "31-45": 0, "46-60": 0, "60+": 0}
        for p in pacientes_todos:
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

        return jsonify(
            {
                "total": total,
                "vinculados_empresa": total_empresa,
                "vinculados_convenio": total_convenio,
                "particulares": total_particular,
                "por_sexo": stats_sexo,
                "por_faixa_etaria": faixas,
                "top_empresas": [
                    {"nome": e[0], "total": int(e[1])} for e in top_empresas
                ],
            }
        )

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "Erro ao buscar estatísticas de pacientes: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar estatísticas"}), 500


# ============================================
# GET - Pacientes frequentes / fidelizados
# ============================================
@pacientes_bp.route("/pacientes/frequentes", methods=["GET"])
def get_pacientes_frequentes():
    """Lista pacientes mais frequentes (para programa de fidelização)."""
    try:
        limite = _safe_int(request.args.get("limite"), default=20) or 20
        min_consultas = _safe_int(request.args.get("min_consultas"), default=2) or 2
        periodo_dias = request.args.get("periodo_dias")

        query = db.session.query(
            Pacientes,
            func.count(Consultas.id).label("total_consultas"),
            func.max(Consultas.data).label("ultima_consulta"),
            func.min(Consultas.data).label("primeira_consulta"),
        ).outerjoin(Consultas, Pacientes.cpf == Consultas.cpf_paciente)

        if periodo_dias:
            data_limite = date.today() - timedelta(days=int(periodo_dias))
            query = query.filter(
                or_(Consultas.data >= data_limite, Consultas.data.is_(None))
            )

        query = (
            query.group_by(Pacientes.id)
            .having(func.count(Consultas.id) >= min_consultas)
            .order_by(func.count(Consultas.id).desc())
            .limit(limite)
        )

        resultados = query.all()

        pacientes_frequentes: list[dict] = []
        for paciente, total, ultima, primeira in resultados:
            if total >= 20:
                nivel = "ouro"
            elif total >= 10:
                nivel = "prata"
            elif total >= 5:
                nivel = "bronze"
            else:
                nivel = "novo"

            pacientes_frequentes.append(
                {
                    "id": paciente.id,
                    "nome": paciente.nome,
                    "cpf": format_cpf(paciente.cpf),
                    "email": paciente.email,
                    "telefone": paciente.numero_de_contato,
                    "total_consultas": int(total or 0),
                    "ultima_consulta": ultima.isoformat() if ultima else None,
                    "primeira_consulta": primeira.isoformat() if primeira else None,
                    "nivel_fidelidade": nivel,
                    "pontos": int(total or 0) * 10,
                    "empresa": paciente.empresa.nome if paciente.empresa else None,
                    "convenio": paciente.convenio.nome if paciente.convenio else None,
                }
            )

        todos_com_consultas = (
            db.session.query(Pacientes.id, func.count(Consultas.id).label("total"))
            .outerjoin(Consultas, Pacientes.cpf == Consultas.cpf_paciente)
            .group_by(Pacientes.id)
            .all()
        )

        stats_fidelidade = {"novo": 0, "bronze": 0, "prata": 0, "ouro": 0}
        for _, total in todos_com_consultas:
            total = int(total or 0)
            if total >= 20:
                stats_fidelidade["ouro"] += 1
            elif total >= 10:
                stats_fidelidade["prata"] += 1
            elif total >= 5:
                stats_fidelidade["bronze"] += 1
            else:
                stats_fidelidade["novo"] += 1

        return jsonify(
            {
                "pacientes": pacientes_frequentes,
                "total_encontrados": len(pacientes_frequentes),
                "stats_fidelidade": stats_fidelidade,
            }
        )

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "Erro ao buscar pacientes frequentes: %s", exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar pacientes frequentes"}), 500


# ============================================
# GET - Buscar pacientes por empresa
# ============================================
@pacientes_bp.route("/pacientes/empresa/<int:empresa_id>", methods=["GET"])
def get_pacientes_by_empresa(empresa_id: int):
    """Busca todos os pacientes de uma empresa."""
    try:
        empresa = Empresas.query.get(empresa_id)
        if not empresa:
            return jsonify({"error": "Empresa não encontrada"}), 404

        pacientes = Pacientes.query.filter(Pacientes.cnpj_empresa == empresa.cnpj).all()

        return jsonify(
            {
                "empresa": {
                    "id": empresa.id,
                    "nome": empresa.nome,
                    "cnpj": format_cnpj(empresa.cnpj),
                },
                "total": len(pacientes),
                "pacientes": [
                    paciente_to_dict(p, include_relations=False) for p in pacientes
                ],
            }
        )

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "Erro ao buscar pacientes da empresa %s: %s", empresa_id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar pacientes"}), 500


# ============================================
# GET - Buscar pacientes por convênio
# ============================================
@pacientes_bp.route("/pacientes/convenio/<int:convenio_id>", methods=["GET"])
def get_pacientes_by_convenio(convenio_id: int):
    """Busca todos os pacientes de um convênio."""
    try:
        convenio = Convenios.query.get(convenio_id)
        if not convenio:
            return jsonify({"error": "Convênio não encontrado"}), 404

        pacientes = Pacientes.query.filter(
            Pacientes.cnpj_convenio == convenio.cnpj
        ).all()

        return jsonify(
            {
                "convenio": {
                    "id": convenio.id,
                    "nome": convenio.nome,
                    "cnpj": format_cnpj(convenio.cnpj),
                },
                "total": len(pacientes),
                "pacientes": [
                    paciente_to_dict(p, include_relations=False) for p in pacientes
                ],
            }
        )

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "Erro ao buscar pacientes do convênio %s: %s",
            convenio_id,
            exc,
            exc_info=True,
        )
        return jsonify({"error": "Erro ao buscar pacientes"}), 500


# ============================================
# GET - Autocomplete de pacientes
# ============================================
@pacientes_bp.route("/pacientes/autocomplete", methods=["GET"])
def autocomplete_pacientes():
    """
    Autocomplete por nome (tolerante a acentos/case) ou CPF (com/sem formatação).

    Requer: PostgreSQL extension ``unaccent``.
    """
    try:
        q = (request.args.get("q") or "").strip()
        limit = min(_safe_int(request.args.get("limit"), default=10) or 10, 50)

        if len(q) < 2:
            return jsonify([])

        digits = only_digits(q)
        normalized = normalize_for_search(q)
        filters: list = []

        # CPF: qualquer sequência de dígitos parcial
        if digits and len(digits) >= 3:
            filters.append(Pacientes.cpf.ilike(f"%{digits}%"))

        # Nome: tolerante a acentos via unaccent (PostgreSQL)
        if normalized:
            filters.append(func.unaccent(Pacientes.nome).ilike(f"%{normalized}%"))

        if not filters:
            return jsonify([])

        pacientes = (
            Pacientes.query.filter(or_(*filters))
            .order_by(Pacientes.nome)
            .limit(limit)
            .all()
        )

        return jsonify(
            [
                {
                    "id": p.id,
                    "nome": p.nome,
                    "cpf": format_cpf(p.cpf),
                    "cpf_raw": p.cpf,
                }
                for p in pacientes
            ]
        )

    except Exception as exc:
        current_app.logger.error(
            "Erro no autocomplete de pacientes: %s", exc, exc_info=True
        )
        return jsonify([])
