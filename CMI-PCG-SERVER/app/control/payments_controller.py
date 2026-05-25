# app/control/payments_controller.py
"""Controller para pagamentos"""

import traceback
from datetime import datetime, date
from typing import Any

from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.payments_model import Pagamentos
from app.models.patients_model import Pacientes
from app.models.companies_model import Empresas
from app.models.insurances_model import Convenios
from app.utils.timezone import get_today_sao_paulo

from app.control.payment_invoice_report import PaymentInvoicePdfReport

pagamentos_bp = Blueprint("pagamentos", __name__)

DATE_FORMATS = ["%d/%m/%Y", "%Y-%m-%d"]

ALLOWED_PAYMENT_TYPES = {
    "PIX",
    "DINHEIRO",
    "DÉBITO",
    "CRÉDITO",
    "TRANSFERÊNCIA BANCÁRIA",
}

# Para pagamentos PIX, definimos explicitamente o tipo de pessoa (pagador e conta destino)
PIX_PERSON_TYPES = {"PF", "PJ"}

# Origem é livre no model, mas padronizamos alguns
ALLOWED_ORIGINS = {
    "PACIENTE",
    "EMPRESA",
    "CONVENIO",
    "CONVÊNIO",
    "OUTROS",
    "EXAMES",
}

REQUIRED_FIELDS_CREATE = {"tipo", "valor", "data", "origem"}


# ============================================
# Helpers
# ============================================
def only_digits(value: Any) -> str:
    """Remove todos os caracteres não numéricos de uma string."""
    return "".join(c for c in str(value or "") if c.isdigit())


def normalize_origin(origin: str | None) -> str:
    """Normaliza a origem de pagamento para valores padrão em caixa alta."""
    if not origin:
        return "OUTROS"
    o = origin.strip().upper()
    if o in {"CONVENIO", "CONVÊNIO"}:
        return "CONVÊNIO"
    if o in {"PACIENTE", "PACIENTES"}:
        return "PACIENTE"
    if o in {"EMPRESA", "EMPRESAS"}:
        return "EMPRESA"
    if o in {"OUTRO", "OUTROS"}:
        return "OUTROS"
    return o


def is_valid_cpf_check_digits(cpf_digits: str) -> bool:
    """
    Valida dígitos verificadores do CPF (11 dígitos, somente números).
    Regra padrão com módulo 11 (2 dígitos verificadores).
    """
    if len(cpf_digits) != 11 or not cpf_digits.isdigit():
        return False

    if cpf_digits == cpf_digits[0] * 11:
        return False

    def calc_digit(base: str, factors_start: int) -> str:
        total = sum(
            int(num) * factor for num, factor in zip(base, range(factors_start, 1, -1))
        )
        remainder = total % 11
        digit = 0 if remainder < 2 else 11 - remainder
        return str(digit)

    first = calc_digit(cpf_digits[:9], 10)
    second = calc_digit(cpf_digits[:9] + first, 11)
    return cpf_digits[-2:] == first + second


def normalize_cpf(
    value: str | None, *, validate_check_digits: bool = False
) -> str | None:
    """
    Retorna CPF apenas com dígitos (string) ou None.

    Regras:
      - vazio -> None
      - se tiver dígitos -> precisa ter EXATAMENTE 11
      - opcionalmente valida dígitos verificadores (DV)
    """
    digits = only_digits(value)
    if not digits:
        return None
    if len(digits) != 11:
        raise ValueError("CPF deve conter exatamente 11 dígitos")
    if validate_check_digits and not is_valid_cpf_check_digits(digits):
        raise ValueError("CPF inválido (dígitos verificadores não conferem)")
    return digits


def parse_date(date_str: str) -> date | None:
    """Tenta converter string de data em objeto date com formatos suportados."""
    if not date_str:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def parse_bool(value: Any) -> bool | None:
    """
    Converte valores comuns em booleano.

    Aceita:
      - bool (retorna direto)
      - int (0/1)
      - str ("true", "false", "1", "0", "sim", "não", etc.)
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


def parse_float(value: str | None) -> float | None:
    """Converte string para float ou retorna None."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def is_future_date(payment_date: date) -> bool:
    """Verifica se a data é futura usando timezone São Paulo."""
    return payment_date > get_today_sao_paulo()


def normalize_pix_person_type(value: Any) -> str | None:
    """Normaliza valor de tipo pessoa PIX (PF/PJ) para uppercase ou None."""
    if value in (None, ""):
        return None
    normalized = str(value).strip().upper()
    return normalized if normalized in PIX_PERSON_TYPES else None


def normalize_numero_nota_fiscal(value: Any) -> str | None:
    """Normaliza número de nota fiscal: remove espaços, retorna None se vazio."""
    if value in (None, ""):
        return None
    return str(value).strip() or None


def payment_to_dict(p: Pagamentos) -> dict:
    """Sempre retorna um payload consistente para o frontend."""
    d = p.to_dict() if hasattr(p, "to_dict") else {}

    d.setdefault("id", p.id)
    d.setdefault("tipo", p.tipo)
    d.setdefault("valor", float(p.valor or 0))
    d.setdefault(
        "possui_desconto",
        bool(p.possui_desconto) if p.possui_desconto is not None else False,
    )
    d.setdefault(
        "valor_desconto",
        float(p.valor_desconto or 0) if p.valor_desconto is not None else None,
    )
    d.setdefault("data", p.data.strftime("%Y-%m-%d") if p.data else None)
    d.setdefault("origem", p.origem)
    d.setdefault("descricao", p.descricao)

    d.setdefault("tipo_pessoa_pix", p.tipo_pessoa_pix)
    d.setdefault("conta_destinada_pix", p.conta_destinada_pix)

    # Campos de nota fiscal
    d.setdefault("vinculado_nota_fiscal", p.vinculado_nota_fiscal or False)
    d.setdefault("numero_nota_fiscal", p.numero_nota_fiscal)

    if not d.get("nome_do_paciente"):
        if p.paciente and getattr(p.paciente, "nome", None):
            d["nome_do_paciente"] = p.paciente.nome
        else:
            d["nome_do_paciente"] = p.nome_do_paciente

    if not d.get("nome_empresa"):
        if p.empresa and getattr(p.empresa, "nome", None):
            d["nome_empresa"] = p.empresa.nome
        else:
            d["nome_empresa"] = p.nome_empresa

    if not d.get("nome_convenio"):
        if p.convenio and getattr(p.convenio, "nome", None):
            d["nome_convenio"] = p.convenio.nome
        else:
            d["nome_convenio"] = p.nome_convenio

    desconto = p.valor_desconto or 0
    d["valor_liquido"] = float((p.valor or 0) - desconto)

    return d


def coerce_int(value: Any) -> int | None:
    """Converte value em int quando possível; vazio vira None; inválido levanta ValueError."""
    if value is None or value == "":
        return None
    return int(value)


def validate_pix_fields(
    data: dict,
    tipo_value: str | None,
    is_update: bool,
    pagamento: Pagamentos | None = None,
) -> tuple[bool, str | None, int | None]:
    """
    Valida campos específicos de PIX (tipo_pessoa_pix e conta_destinada_pix).

    Returns:
        Tuple (ok, msg, status_code)
    """
    # Determina o tipo efetivo (do payload ou do pagamento existente)
    tipo_efetivo = tipo_value
    if pagamento is not None and not tipo_efetivo:
        tipo_efetivo = (pagamento.tipo or "").strip().upper() or None

    tipo_pessoa_pix = data.get("tipo_pessoa_pix")
    conta_destinada_pix = data.get("conta_destinada_pix")

    # Validar tipo_pessoa_pix
    if tipo_pessoa_pix not in (None, ""):
        normalized = str(tipo_pessoa_pix).strip().upper()
        if normalized not in PIX_PERSON_TYPES:
            return (
                False,
                "tipo_pessoa_pix inválido. Use 'PF' ou 'PJ'.",
                400,
            )
        if tipo_efetivo and tipo_efetivo != "PIX":
            return (
                False,
                "O campo tipo_pessoa_pix só é permitido para pagamentos PIX.",
                400,
            )

    # Validar conta_destinada_pix
    if conta_destinada_pix not in (None, ""):
        normalized = str(conta_destinada_pix).strip().upper()
        if normalized not in PIX_PERSON_TYPES:
            return (
                False,
                "conta_destinada_pix inválido. Use 'PF' ou 'PJ'.",
                400,
            )
        if tipo_efetivo and tipo_efetivo != "PIX":
            return (
                False,
                "O campo conta_destinada_pix só é permitido para pagamentos PIX.",
                400,
            )

    # Para criação de PIX, ambos os campos são obrigatórios
    if not is_update and tipo_efetivo == "PIX":
        if tipo_pessoa_pix in (None, ""):
            return (
                False,
                "Para pagamentos PIX informe tipo_pessoa_pix ('PF' ou 'PJ').",
                400,
            )
        if conta_destinada_pix in (None, ""):
            return (
                False,
                "Para pagamentos PIX informe conta_destinada_pix ('PF' ou 'PJ').",
                400,
            )

    return True, None, None


def validate_nota_fiscal_fields(
    data: dict,
    is_update: bool,
    pagamento: Pagamentos | None = None,
) -> tuple[bool, str | None, int | None]:
    """
    Valida campos de nota fiscal (vinculado_nota_fiscal e numero_nota_fiscal).

    Regra: se vinculado_nota_fiscal=True, numero_nota_fiscal é obrigatório.

    Returns:
        Tuple (ok, msg, status_code)
    """
    vinculado = parse_bool(data.get("vinculado_nota_fiscal"))
    numero = normalize_numero_nota_fiscal(data.get("numero_nota_fiscal"))

    # Se não informou vinculado, herda do pagamento existente (em updates)
    if vinculado is None and is_update and pagamento:
        vinculado = pagamento.vinculado_nota_fiscal

    # Se vinculado=True, numero é obrigatório
    if vinculado and not numero:
        # Em update, verifica se já existe numero no pagamento
        if is_update and pagamento and pagamento.numero_nota_fiscal:
            return True, None, None
        return (
            False,
            "Quando vinculado_nota_fiscal=true, numero_nota_fiscal é obrigatório.",
            400,
        )

    # Se numero informado sem vinculado=True, avisa (mas aceita como vinculado implícito)
    # Não é erro, apenas consistência

    return True, None, None


def validate_payload(
    data: dict,
    is_update: bool = False,
    pagamento: Pagamentos | None = None,
) -> tuple[bool, str | None, int | None]:
    """
    Valida payload de create/update. Retorna (ok, msg, status).

    Args:
        data: JSON recebido no corpo da requisição.
        is_update: indica se é operação de atualização.
        pagamento: instância existente (usada em updates para validar PIX).

    Returns:
        Tuple (ok, msg, status_code):
            - ok: True se payload é válido.
            - msg: mensagem de erro (ou None).
            - status_code: código HTTP sugerido (ou None).
    """
    if not isinstance(data, dict):
        return False, "JSON inválido", 400

    if not is_update:
        missing = [f for f in REQUIRED_FIELDS_CREATE if data.get(f) in (None, "")]
        if missing:
            return False, f"Campos obrigatórios faltando: {', '.join(missing)}", 400

    tipo_value: str | None = None
    if data.get("tipo"):
        tipo_value = str(data["tipo"]).strip().upper()
        if tipo_value not in ALLOWED_PAYMENT_TYPES:
            return (
                False,
                f"Tipo de pagamento inválido. Use: {', '.join(sorted(ALLOWED_PAYMENT_TYPES))}",
                400,
            )

    if "valor" in data and data.get("valor") is not None:
        try:
            valor = float(data["valor"])
            if valor <= 0:
                return False, "Valor deve ser maior que 0", 400
        except (ValueError, TypeError):
            return False, "Valor inválido", 400

    # Validação de data: formato e não pode ser futura
    if data.get("data"):
        d = parse_date(str(data["data"]))
        if not d:
            return False, "Formato de data inválido. Use AAAA-MM-DD ou DD/MM/AAAA", 400
        if is_future_date(d):
            return (
                False,
                "Não é permitido lançar pagamentos com data futura.",
                400,
            )

    # Desconto: aceita bool real ou string "true/false"
    if "possui_desconto" in data or "valor_desconto" in data:
        possui = parse_bool(data.get("possui_desconto"))
        if possui is None:
            possui = False if not is_update else None

        if possui:
            try:
                valor = float(data.get("valor", 0) or 0)
                desc = float(data.get("valor_desconto", 0) or 0)
                if desc < 0 or desc > valor:
                    return (
                        False,
                        "Valor de desconto inválido (não pode ser negativo nem maior que o valor)",
                        400,
                    )
            except (ValueError, TypeError):
                return False, "Valor de desconto inválido", 400

    if "qtd_parcelas_credito" in data and data.get("qtd_parcelas_credito") not in (
        None,
        "",
    ):
        try:
            q = int(data["qtd_parcelas_credito"])
            if q < 1:
                return False, "Quantidade de parcelas inválida", 400
        except (ValueError, TypeError):
            return False, "Quantidade de parcelas inválida", 400

    if "cpf" in data:
        try:
            validate_dv = bool(
                current_app.config.get("VALIDATE_CPF_CHECK_DIGITS", False)
            )
            cpf_norm = normalize_cpf(
                str(data.get("cpf") or ""), validate_check_digits=validate_dv
            )
        except ValueError as exc:
            return False, str(exc), 400

        if cpf_norm:
            if not Pacientes.query.filter(Pacientes.cpf == cpf_norm).first():
                return False, "Paciente não encontrado para o CPF informado", 404

    if "empresa_id" in data and data.get("empresa_id") not in (None, ""):
        try:
            empresa_id = coerce_int(data["empresa_id"])
        except (ValueError, TypeError):
            return False, "empresa_id inválido", 400
        if empresa_id is not None and not Empresas.query.get(empresa_id):
            return False, "Empresa não encontrada", 404

    if "convenio_id" in data and data.get("convenio_id") not in (None, ""):
        try:
            convenio_id = coerce_int(data["convenio_id"])
        except (ValueError, TypeError):
            return False, "convenio_id inválido", 400
        if convenio_id is not None and not Convenios.query.get(convenio_id):
            return False, "Convênio não encontrado", 404

    # Validar campos PIX
    ok, msg, status = validate_pix_fields(data, tipo_value, is_update, pagamento)
    if not ok:
        return ok, msg, status

    # Validar campos de nota fiscal
    ok, msg, status = validate_nota_fiscal_fields(data, is_update, pagamento)
    if not ok:
        return ok, msg, status

    return True, None, None


def apply_value_filters(query, valor, valor_min, valor_max):
    """Aplica filtros de valor à query."""
    if valor is not None:
        query = query.filter(Pagamentos.valor == valor)
    else:
        if valor_min is not None:
            query = query.filter(Pagamentos.valor >= valor_min)
        if valor_max is not None:
            query = query.filter(Pagamentos.valor <= valor_max)
    return query


# ============================================
# GET - Listar pagamentos com filtros + paginação
# ============================================
@pagamentos_bp.route("/pagamentos", methods=["GET"])
def get_pagamentos():
    """
    Query params:
      - search, cpf, empresa_id, convenio_id, origem, tipo
      - data (exata), data_inicio, data_fim (intervalo)
      - valor (exato), valor_min, valor_max (intervalo)
      - possui_desconto (true/false)
      - sem_vinculo (true -> cpf/empresa_id/convenio_id nulos)
      - conta_destinada_pix (PF/PJ)
      - vinculado_nota_fiscal (true/false)
      - numero_nota_fiscal (busca exata ou parcial)
      - limit, offset
      - order (data_desc|data_asc|valor_desc|valor_asc)
    """
    try:
        query = Pagamentos.query

        search = request.args.get("search")
        cpf = request.args.get("cpf")
        empresa_id = request.args.get("empresa_id")
        convenio_id = request.args.get("convenio_id")
        origem = request.args.get("origem")
        tipo = request.args.get("tipo")
        data_exata = parse_date(request.args.get("data", ""))
        data_inicio = parse_date(request.args.get("data_inicio", ""))
        data_fim = parse_date(request.args.get("data_fim", ""))
        valor = parse_float(request.args.get("valor"))
        valor_min = parse_float(request.args.get("valor_min"))
        valor_max = parse_float(request.args.get("valor_max"))
        possui_desconto = parse_bool(request.args.get("possui_desconto"))
        sem_vinculo = parse_bool(request.args.get("sem_vinculo"))
        conta_destinada_pix = request.args.get("conta_destinada_pix")
        vinculado_nota_fiscal = parse_bool(request.args.get("vinculado_nota_fiscal"))
        numero_nota_fiscal = request.args.get("numero_nota_fiscal")
        limit = request.args.get("limit", type=int)
        offset = request.args.get("offset", type=int)
        order = (request.args.get("order") or "data_desc").lower()

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Pagamentos.nome_do_paciente.ilike(s),
                    Pagamentos.nome_empresa.ilike(s),
                    Pagamentos.nome_convenio.ilike(s),
                    Pagamentos.descricao.ilike(s),
                    Pagamentos.numero_nota_fiscal.ilike(s),
                )
            )

        if cpf:
            try:
                validate_dv = bool(
                    current_app.config.get("VALIDATE_CPF_CHECK_DIGITS", False)
                )
                cpf_norm = normalize_cpf(cpf, validate_check_digits=validate_dv)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400
            if cpf_norm:
                query = query.filter(Pagamentos.cpf == cpf_norm)

        if empresa_id not in (None, ""):
            try:
                eid = coerce_int(empresa_id)
            except ValueError:
                return jsonify({"error": "empresa_id inválido"}), 400
            if eid is not None:
                query = query.filter(Pagamentos.empresa_id == eid)

        if convenio_id not in (None, ""):
            try:
                cid = coerce_int(convenio_id)
            except ValueError:
                return jsonify({"error": "convenio_id inválido"}), 400
            if cid is not None:
                query = query.filter(Pagamentos.convenio_id == cid)

        if origem:
            query = query.filter(Pagamentos.origem == normalize_origin(origem))

        if tipo:
            query = query.filter(Pagamentos.tipo == str(tipo).strip().upper())

        # Filtro por conta destinada PIX
        if conta_destinada_pix:
            normalized = str(conta_destinada_pix).strip().upper()
            if normalized in PIX_PERSON_TYPES:
                query = query.filter(Pagamentos.conta_destinada_pix == normalized)

        # Filtro por vinculado_nota_fiscal
        if vinculado_nota_fiscal is not None:
            query = query.filter(
                Pagamentos.vinculado_nota_fiscal == vinculado_nota_fiscal
            )

        # Filtro por numero_nota_fiscal (busca parcial)
        if numero_nota_fiscal:
            query = query.filter(
                Pagamentos.numero_nota_fiscal.ilike(f"%{numero_nota_fiscal.strip()}%")
            )

        if data_exata:
            query = query.filter(Pagamentos.data == data_exata)
        else:
            if data_inicio and data_fim:
                query = query.filter(Pagamentos.data.between(data_inicio, data_fim))
            elif data_inicio:
                query = query.filter(Pagamentos.data >= data_inicio)
            elif data_fim:
                query = query.filter(Pagamentos.data <= data_fim)

        query = apply_value_filters(query, valor, valor_min, valor_max)

        if possui_desconto is not None:
            if possui_desconto:
                query = query.filter(
                    Pagamentos.valor_desconto.isnot(None),
                    Pagamentos.valor_desconto > 0,
                )
            else:
                query = query.filter(
                    or_(
                        Pagamentos.valor_desconto.is_(None),
                        Pagamentos.valor_desconto <= 0,
                    )
                )

        if sem_vinculo:
            query = query.filter(
                Pagamentos.cpf.is_(None),
                Pagamentos.empresa_id.is_(None),
                Pagamentos.convenio_id.is_(None),
            )

        order_mapping = {
            "data_asc": (Pagamentos.data.asc(), Pagamentos.id.asc()),
            "valor_desc": (Pagamentos.valor.desc(), Pagamentos.id.desc()),
            "valor_asc": (Pagamentos.valor.asc(), Pagamentos.id.asc()),
        }
        order_cols = order_mapping.get(
            order, (Pagamentos.data.desc(), Pagamentos.id.desc())
        )
        query = query.order_by(*order_cols)

        if offset is not None and offset >= 0:
            query = query.offset(offset)
        if limit is not None and limit > 0:
            query = query.limit(limit)

        pagamentos = query.all()
        return jsonify([payment_to_dict(p) for p in pagamentos])

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "[Pagamentos] Erro ao listar: %s\n%s", exc, traceback.format_exc()
        )
        return jsonify({"error": "Erro ao listar pagamentos"}), 500


# ============================================
# GET - Buscar pagamento por ID
# ============================================
@pagamentos_bp.route("/pagamentos/<int:id>", methods=["GET"])
def get_pagamento_by_id(id: int):
    """Retorna um pagamento específico pelo ID."""
    try:
        p = Pagamentos.query.get(id)
        if not p:
            return jsonify({"error": "Pagamento não encontrado"}), 404
        return jsonify(payment_to_dict(p))
    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "[Pagamentos] Erro ao buscar %s: %s", id, exc, exc_info=True
        )
        return jsonify({"error": "Erro ao buscar pagamento"}), 500


# ============================================
# POST - Criar pagamento
# ============================================
@pagamentos_bp.route("/pagamentos", methods=["POST"])
def create_pagamento():
    """Cria um novo pagamento."""
    try:
        data = request.json or {}

        ok, msg, status = validate_payload(data, is_update=False)
        if not ok:
            return jsonify({"error": msg}), status

        tipo = str(data["tipo"]).strip().upper()
        valor = float(data["valor"])
        data_pagamento = parse_date(str(data["data"]))
        origem = normalize_origin(str(data["origem"]))

        if not data_pagamento:
            return jsonify({"error": "Data inválida"}), 400

        # Campos PIX
        tipo_pessoa_pix = None
        conta_destinada_pix = None
        if tipo == "PIX":
            tipo_pessoa_pix = normalize_pix_person_type(data.get("tipo_pessoa_pix"))
            conta_destinada_pix = normalize_pix_person_type(
                data.get("conta_destinada_pix")
            )

        possui_desconto = parse_bool(data.get("possui_desconto")) or False
        valor_desconto = None
        if possui_desconto:
            valor_desconto = float(data.get("valor_desconto") or 0)

        qtd_parcelas_credito = None
        if tipo == "CRÉDITO":
            qtd_parcelas_credito = int(data.get("qtd_parcelas_credito") or 1)

        cpf_str = None
        if "cpf" in data:
            validate_dv = bool(
                current_app.config.get("VALIDATE_CPF_CHECK_DIGITS", False)
            )
            cpf_str = normalize_cpf(
                str(data.get("cpf") or ""), validate_check_digits=validate_dv
            )

        empresa_id = None
        if "empresa_id" in data:
            empresa_id = coerce_int(data.get("empresa_id"))

        convenio_id = None
        if "convenio_id" in data:
            convenio_id = coerce_int(data.get("convenio_id"))

        # Campos de nota fiscal
        vinculado_nota_fiscal = parse_bool(data.get("vinculado_nota_fiscal")) or False
        numero_nota_fiscal = normalize_numero_nota_fiscal(
            data.get("numero_nota_fiscal")
        )

        # Se informou numero sem marcar vinculado, marca automaticamente
        if numero_nota_fiscal and not vinculado_nota_fiscal:
            vinculado_nota_fiscal = True

        novo = Pagamentos(
            tipo=tipo,
            tipo_pessoa_pix=tipo_pessoa_pix,
            conta_destinada_pix=conta_destinada_pix,
            valor=valor,
            possui_desconto=possui_desconto,
            valor_desconto=valor_desconto if possui_desconto else None,
            data=data_pagamento,
            nome_do_paciente=(data.get("nome_do_paciente") or "").strip() or None,
            cpf=cpf_str,
            empresa_id=empresa_id,
            convenio_id=convenio_id,
            origem=origem,
            nome_empresa=(data.get("nome_empresa") or "").strip() or None,
            nome_convenio=(data.get("nome_convenio") or "").strip() or None,
            descricao=(data.get("descricao") or "").strip() or None,
            qtd_parcelas_credito=qtd_parcelas_credito,
            vinculado_nota_fiscal=vinculado_nota_fiscal,
            numero_nota_fiscal=numero_nota_fiscal if vinculado_nota_fiscal else None,
        )

        db.session.add(novo)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Pagamento criado",
                    "pagamento": payment_to_dict(novo),
                }
            ),
            201,
        )

    except IntegrityError as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Pagamentos] Integridade: %s", getattr(exc, "orig", exc), exc_info=True
        )
        return jsonify({"error": "Erro de integridade no banco de dados"}), 409
    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error(
            "[Pagamentos] Erro ao criar: %s\n%s", exc, traceback.format_exc()
        )
        return jsonify({"error": "Erro interno no servidor"}), 500


# ============================================
# PUT - Atualizar pagamento
# ============================================
@pagamentos_bp.route("/pagamentos/<int:id>", methods=["PUT"])
def update_pagamento(id: int):
    """Atualiza um pagamento existente."""
    try:
        p = Pagamentos.query.get(id)
        if not p:
            return jsonify({"error": "Pagamento não encontrado"}), 404

        data = request.json or {}

        ok, msg, status = validate_payload(data, is_update=True, pagamento=p)
        if not ok:
            return jsonify({"error": msg}), status

        if data.get("tipo"):
            p.tipo = str(data["tipo"]).strip().upper()

        if "valor" in data and data.get("valor") is not None:
            p.valor = float(data["valor"])

        if "data" in data and data.get("data"):
            d = parse_date(str(data["data"]))
            if d:
                p.data = d

        if data.get("origem"):
            p.origem = normalize_origin(str(data["origem"]))

        # Campos PIX
        if "tipo_pessoa_pix" in data:
            p.tipo_pessoa_pix = normalize_pix_person_type(data.get("tipo_pessoa_pix"))

        if "conta_destinada_pix" in data:
            p.conta_destinada_pix = normalize_pix_person_type(
                data.get("conta_destinada_pix")
            )

        if "descricao" in data:
            p.descricao = (data.get("descricao") or "").strip() or None

        if "nome_do_paciente" in data:
            p.nome_do_paciente = (data.get("nome_do_paciente") or "").strip() or None

        if "nome_empresa" in data:
            p.nome_empresa = (data.get("nome_empresa") or "").strip() or None

        if "nome_convenio" in data:
            p.nome_convenio = (data.get("nome_convenio") or "").strip() or None

        if "empresa_id" in data:
            p.empresa_id = coerce_int(data.get("empresa_id"))

        if "convenio_id" in data:
            p.convenio_id = coerce_int(data.get("convenio_id"))

        if "possui_desconto" in data or "valor_desconto" in data:
            possui = parse_bool(data.get("possui_desconto"))
            if possui is None:
                possui = bool(p.possui_desconto or False)

            p.possui_desconto = possui
            if possui:
                p.valor_desconto = float(data.get("valor_desconto") or 0)
            else:
                p.valor_desconto = None

        if "qtd_parcelas_credito" in data:
            raw = data.get("qtd_parcelas_credito")
            if raw in (None, ""):
                p.qtd_parcelas_credito = None
            else:
                p.qtd_parcelas_credito = int(raw)

        # Campos de nota fiscal
        if "vinculado_nota_fiscal" in data or "numero_nota_fiscal" in data:
            vinculado = parse_bool(data.get("vinculado_nota_fiscal"))
            numero = normalize_numero_nota_fiscal(data.get("numero_nota_fiscal"))

            # Se não informou vinculado, mantém o atual
            if vinculado is None:
                vinculado = p.vinculado_nota_fiscal or False

            # Se informou numero sem marcar vinculado, marca automaticamente
            if numero and not vinculado:
                vinculado = True

            p.vinculado_nota_fiscal = vinculado
            if vinculado:
                # Se informou numero, usa; senão mantém o existente
                if "numero_nota_fiscal" in data:
                    p.numero_nota_fiscal = numero
            else:
                p.numero_nota_fiscal = None

        db.session.commit()

        return jsonify(
            {
                "message": "Pagamento atualizado",
                "pagamento": payment_to_dict(p),
            }
        )

    except IntegrityError as exc:
        db.session.rollback()
        current_app.logger.error(
            "[Pagamentos] Integridade update: %s",
            getattr(exc, "orig", exc),
            exc_info=True,
        )
        return jsonify({"error": "Erro de integridade no banco de dados"}), 409
    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error(
            "[Pagamentos] Erro ao atualizar %s: %s\n%s", id, exc, traceback.format_exc()
        )
        return jsonify({"error": "Erro ao atualizar pagamento"}), 500


# ============================================
# DELETE - Excluir pagamento
# ============================================
@pagamentos_bp.route("/pagamentos/<int:id>", methods=["DELETE"])
def delete_pagamento(id: int):
    """Exclui um pagamento pelo ID."""
    try:
        p = Pagamentos.query.get(id)
        if not p:
            return jsonify({"error": "Pagamento não encontrado"}), 404

        db.session.delete(p)
        db.session.commit()
        return jsonify({"message": "Pagamento excluído com sucesso"})

    except Exception as exc:  # pylint: disable=broad-except
        db.session.rollback()
        current_app.logger.error(
            "[Pagamentos] Erro ao excluir %s: %s\n%s", id, exc, traceback.format_exc()
        )
        return jsonify({"error": "Erro ao excluir pagamento"}), 500


# ============================================
# GET - Resumo mensal (para cards e gráficos)
# ============================================
@pagamentos_bp.route("/pagamentos/resumo", methods=["GET"])
def get_resumo_pagamentos():
    """
    Retorna resumo financeiro mensal para dashboards.

    Query params:
      - mes (1-12)
      - ano (ex: 2025)

    Resposta:
      - total_bruto, total_descontos, total_liquido
      - por_tipo: [{ tipo, total }]
      - por_origem: [{ origem, total }]
    """
    try:
        mes = request.args.get("mes", type=int)
        ano = request.args.get("ano", type=int)

        if not mes or not (1 <= mes <= 12) or not ano:
            return jsonify({"error": "Informe mes (1-12) e ano"}), 400

        data_inicio = date(ano, mes, 1)
        data_fim = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)

        base = Pagamentos.query.filter(
            Pagamentos.data >= data_inicio, Pagamentos.data < data_fim
        )

        total_bruto = (
            base.with_entities(func.coalesce(func.sum(Pagamentos.valor), 0)).scalar()
            or 0
        )
        total_descontos = (
            base.with_entities(
                func.coalesce(func.sum(func.coalesce(Pagamentos.valor_desconto, 0)), 0)
            ).scalar()
            or 0
        )
        total_liquido = float(total_bruto) - float(total_descontos)

        por_tipo = (
            base.with_entities(
                Pagamentos.tipo,
                func.coalesce(func.sum(Pagamentos.valor), 0).label("total"),
            )
            .group_by(Pagamentos.tipo)
            .order_by(func.sum(Pagamentos.valor).desc())
            .all()
        )

        por_origem = (
            base.with_entities(
                Pagamentos.origem,
                func.coalesce(func.sum(Pagamentos.valor), 0).label("total"),
            )
            .group_by(Pagamentos.origem)
            .order_by(func.sum(Pagamentos.valor).desc())
            .all()
        )

        return jsonify(
            {
                "mes": mes,
                "ano": ano,
                "total_bruto": float(total_bruto),
                "total_descontos": float(total_descontos),
                "total_liquido": float(total_liquido),
                "por_tipo": [{"tipo": t[0], "total": float(t[1])} for t in por_tipo],
                "por_origem": [
                    {"origem": o[0], "total": float(o[1])} for o in por_origem
                ],
            }
        )

    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "[Pagamentos] Erro resumo: %s\n%s", exc, traceback.format_exc()
        )
        return jsonify({"error": "Erro ao gerar resumo"}), 500


# ============================================
# GET - Nota fiscal (PDF) de um pagamento
# ============================================
@pagamentos_bp.route("/pagamentos/<int:id>/nota_fiscal", methods=["GET"])
def gerar_nota_fiscal_pagamento(id: int):
    """
    Gera a nota fiscal (PDF) para um pagamento específico.
    """
    try:
        pagamento = Pagamentos.query.get(id)
        if not pagamento:
            return jsonify({"error": "Pagamento não encontrado"}), 404

        pdf_report = PaymentInvoicePdfReport(pagamento)
        return pdf_report.generate_response()
    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.error(
            "[Pagamentos] Erro ao gerar nota fiscal para pagamento %s: %s",
            id,
            exc,
            exc_info=True,
        )
        return jsonify({"error": "Erro ao gerar nota fiscal"}), 500
