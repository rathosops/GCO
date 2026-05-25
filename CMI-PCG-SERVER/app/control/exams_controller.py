"""Controller para gerenciamento de exames.

Endpoints:
    GET    /exames              - Lista exames com filtros
    GET    /exames/<id>         - Busca exame por ID
    GET    /exames/codigo/<cod> - Busca exame por código
    POST   /exames              - Cria novo exame
    PUT    /exames/<id>         - Atualiza exame
    DELETE /exames/<id>         - Remove exame (soft delete)
    GET    /exames/tipos        - Lista tipos únicos
    GET    /exames/stats        - Estatísticas gerais
    POST   /exames/calcular     - Calcula total de lista de exames
    GET    /exames/exportar     - Exporta lista em CSV
    POST   /exames/importar     - Importa exames de CSV
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from flask import Blueprint, Response, current_app, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.exams_model import Exames
from app.utils.responses import get_pagination, json_error, json_success
from app.utils.search import build_relevance_score, build_smart_search_filter
from app.utils.validators import normalize_float, normalize_string

exames_bp = Blueprint("exames", __name__)

# ── Constantes ────────────────────────────────────────────────────────────
_DEFAULT_LIMIT = 50
_MAX_LIMIT = 500
_SEARCH_COLS = [Exames.nome, Exames.tipo, Exames.codigo, Exames.codigo_parceiro]

_ORDER_MAPPING = {
    "nome_asc": Exames.nome.asc(),
    "nome_desc": Exames.nome.desc(),
    "valor_asc": Exames.valor_venda.asc(),
    "valor_desc": Exames.valor_venda.desc(),
    "codigo_asc": Exames.codigo.asc(),
    "codigo_desc": Exames.codigo.desc(),
    "tipo_asc": Exames.tipo.asc(),
    "created_desc": Exames.created_at.desc(),
}


# ── Helpers ───────────────────────────────────────────────────────────────


def _gerar_codigo_exame() -> str:
    """Gera próximo código sequencial para exame."""
    ultimo = db.session.query(func.max(Exames.id)).scalar()
    proximo_id = (ultimo or 0) + 1
    return f"EX{proximo_id:04d}"


def _build_exame_payload(data: dict, exame: Optional[Exames] = None) -> dict:
    """
    Constrói payload validado para criação/atualização.

    Raises:
        ValueError: Se campos obrigatórios estiverem ausentes na criação.
    """
    payload: dict = {}

    nome = normalize_string(data.get("nome"))
    if nome:
        payload["nome"] = nome
    elif exame is None:
        raise ValueError("Nome é obrigatório")

    tipo = normalize_string(data.get("tipo"))
    if tipo:
        payload["tipo"] = tipo.upper()
    elif exame is None:
        raise ValueError("Tipo é obrigatório")

    codigo = normalize_string(data.get("codigo"))
    if codigo:
        payload["codigo"] = codigo.upper()
    elif exame is None and "codigo" not in data:
        payload["codigo"] = _gerar_codigo_exame()

    # Preserva None explícito para limpeza do campo
    if "codigo_parceiro" in data:
        payload["codigo_parceiro"] = normalize_string(data.get("codigo_parceiro"))

    for campo in ("valor_cmi", "valor_venda", "valor_parceiro"):
        if campo in data:
            valor = normalize_float(data.get(campo))
            payload[campo] = valor if valor is not None else 0.0

    if "ativo" in data:
        payload["ativo"] = bool(data.get("ativo", True))

    return payload


def _apply_ativo_filter(query, args):
    """Aplica filtro de status ativo se informado."""
    ativo_param = args.get("ativo")
    if ativo_param is not None:
        ativo = str(ativo_param).lower() in ("true", "1", "sim", "yes")
        return query.filter(Exames.ativo == ativo)
    return query


# =============================================================================
# Rotas CRUD
# =============================================================================


@exames_bp.route("/exames", methods=["GET"])
def get_exames():
    """
    Lista exames com filtros opcionais.

    Query params:
        search    : Busca inteligente (nome, tipo, código, código parceiro)
        tipo      : Filtra por tipo
        ativo     : Filtra por status (true/false)
        valor_min : Valor mínimo de venda
        valor_max : Valor máximo de venda
        order     : Ordenação (nome_asc, nome_desc, valor_asc, valor_desc,
                    codigo_asc, codigo_desc, tipo_asc, created_desc)
        limit     : Limite de resultados (máx 500)
        offset    : Offset para paginação
    """
    try:
        query = Exames.query
        search = normalize_string(request.args.get("search"))
        use_relevance = False

        # Busca inteligente (unaccent + trigrama)
        if search:
            smart_filter = build_smart_search_filter(_SEARCH_COLS, search)
            if smart_filter is not None:
                query = query.filter(smart_filter)
                use_relevance = True

        # Filtro por tipo
        if tipo := normalize_string(request.args.get("tipo")):
            from app.utils.search import unaccent  # noqa: PLC0415

            query = query.filter(unaccent(Exames.tipo).ilike(f"%{tipo}%"))

        # Filtro por status ativo
        query = _apply_ativo_filter(query, request.args)

        # Filtro por faixa de valor
        if valor_min := normalize_float(request.args.get("valor_min")):
            query = query.filter(Exames.valor_venda >= valor_min)
        if valor_max := normalize_float(request.args.get("valor_max")):
            query = query.filter(Exames.valor_venda <= valor_max)

        # Ordenação: relevância tem prioridade quando há busca textual
        order = request.args.get("order", "nome_asc")
        if use_relevance and order == "nome_asc":
            query = query.order_by(build_relevance_score(Exames.nome, search))
        else:
            query = query.order_by(_ORDER_MAPPING.get(order, Exames.nome.asc()))

        # Paginação
        limit, offset = get_pagination(
            default_limit=_DEFAULT_LIMIT, max_limit=_MAX_LIMIT
        )
        exames = query.limit(limit).offset(offset).all()

        return jsonify([e.to_dict() for e in exames])

    except Exception as exc:
        current_app.logger.exception("Erro ao listar exames")
        return json_error(f"Erro ao listar exames: {exc}", 500)


@exames_bp.route("/exames/<int:exame_id>", methods=["GET"])
def get_exame_by_id(exame_id: int):
    """Busca exame por ID."""
    try:
        exame = Exames.query.get(exame_id)
        if not exame:
            return json_error("Exame não encontrado", 404)
        return jsonify(exame.to_dict())
    except Exception as exc:
        current_app.logger.exception("Erro ao buscar exame")
        return json_error(f"Erro ao buscar exame: {exc}", 500)


@exames_bp.route("/exames/codigo/<codigo>", methods=["GET"])
def get_exame_by_codigo(codigo: str):
    """Busca exame por código único."""
    try:
        exame = Exames.query.filter(func.upper(Exames.codigo) == codigo.upper()).first()
        if not exame:
            return json_error("Exame não encontrado", 404)
        return jsonify(exame.to_dict())
    except Exception as exc:
        current_app.logger.exception("Erro ao buscar exame por código")
        return json_error(f"Erro ao buscar exame: {exc}", 500)


@exames_bp.route("/exames", methods=["POST"])
def create_exame():
    """
    Cria novo exame.

    Body JSON:
        nome            : str   (obrigatório)
        tipo            : str   (obrigatório)
        codigo          : str   (opcional, auto-gerado)
        codigo_parceiro : str   (opcional)
        valor_cmi       : float (opcional, default 0)
        valor_venda     : float (opcional, default 0)
        valor_parceiro  : float (opcional, default 0)
        ativo           : bool  (default true)
    """
    try:
        data = request.json or {}

        try:
            payload = _build_exame_payload(data)
        except ValueError as err:
            return json_error(str(err), 400)

        # Verifica duplicidade de código
        if codigo := payload.get("codigo"):
            if Exames.query.filter(func.upper(Exames.codigo) == codigo.upper()).first():
                return json_error(f"Código '{codigo}' já existe", 409)

        # Verifica duplicidade de nome + tipo
        nome = payload.get("nome")
        tipo = payload.get("tipo")
        if nome and tipo:
            if Exames.query.filter(
                func.lower(Exames.nome) == nome.lower(),
                func.lower(Exames.tipo) == tipo.lower(),
            ).first():
                return json_error(f"Exame '{nome}' do tipo '{tipo}' já existe", 409)

        exame = Exames(**payload)
        db.session.add(exame)
        db.session.commit()

        return json_success("Exame criado com sucesso", exame.to_dict(), 201)

    except IntegrityError:
        db.session.rollback()
        current_app.logger.exception("Erro de integridade ao criar exame")
        return json_error("Erro de integridade: código duplicado", 409)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Erro ao criar exame")
        return json_error(f"Erro ao criar exame: {exc}", 500)


@exames_bp.route("/exames/<int:exame_id>", methods=["PUT"])
def update_exame(exame_id: int):
    """Atualiza exame existente."""
    try:
        exame = Exames.query.get(exame_id)
        if not exame:
            return json_error("Exame não encontrado", 404)

        data = request.json or {}

        try:
            payload = _build_exame_payload(data, exame)
        except ValueError as err:
            return json_error(str(err), 400)

        # Verifica duplicidade de código se alterado
        novo_codigo = payload.get("codigo")
        if novo_codigo and novo_codigo != exame.codigo:
            if Exames.query.filter(
                func.upper(Exames.codigo) == novo_codigo.upper(),
                Exames.id != exame_id,
            ).first():
                return json_error(f"Código '{novo_codigo}' já existe", 409)

        for key, value in payload.items():
            setattr(exame, key, value)

        db.session.commit()

        return json_success("Exame atualizado com sucesso", exame.to_dict())

    except IntegrityError:
        db.session.rollback()
        return json_error("Erro de integridade: código duplicado", 409)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Erro ao atualizar exame")
        return json_error(f"Erro ao atualizar exame: {exc}", 500)


@exames_bp.route("/exames/<int:exame_id>", methods=["DELETE"])
def delete_exame(exame_id: int):
    """
    Remove exame (soft delete por padrão).

    Query param:
        hard: Se 'true', remove permanentemente do banco.
    """
    try:
        exame = Exames.query.get(exame_id)
        if not exame:
            return json_error("Exame não encontrado", 404)

        hard_delete = request.args.get("hard", "").lower() in ("true", "1")

        if hard_delete:
            db.session.delete(exame)
            message = "Exame removido permanentemente"
        else:
            exame.ativo = False
            message = "Exame desativado com sucesso"

        db.session.commit()

        return json_success(message)

    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Erro ao remover exame")
        return json_error(f"Erro ao remover exame: {exc}", 500)


# =============================================================================
# Rotas auxiliares
# =============================================================================


@exames_bp.route("/exames/tipos", methods=["GET"])
def get_tipos():
    """Lista todos os tipos únicos de exames ativos."""
    try:
        tipos = (
            db.session.query(Exames.tipo)
            .filter(Exames.ativo.is_(True))
            .distinct()
            .order_by(Exames.tipo)
            .all()
        )
        return jsonify([t[0] for t in tipos if t[0]])
    except Exception as exc:
        current_app.logger.exception("Erro ao listar tipos")
        return json_error(f"Erro ao listar tipos: {exc}", 500)


@exames_bp.route("/exames/stats", methods=["GET"])
def get_stats():
    """Retorna estatísticas gerais dos exames."""
    try:
        total = Exames.query.count()
        ativos = Exames.query.filter(Exames.ativo.is_(True)).count()

        # Por tipo
        por_tipo = (
            db.session.query(Exames.tipo, func.count(Exames.id))
            .filter(Exames.ativo.is_(True))
            .group_by(Exames.tipo)
            .order_by(func.count(Exames.id).desc())
            .all()
        )

        # Valores médios
        medias = (
            db.session.query(
                func.avg(Exames.valor_cmi),
                func.avg(Exames.valor_venda),
                func.avg(Exames.valor_parceiro),
            )
            .filter(Exames.ativo.is_(True))
            .first()
        )

        # Exames sem código
        sem_codigo = Exames.query.filter(
            Exames.codigo.is_(None) | (Exames.codigo == "")
        ).count()

        return jsonify(
            {
                "total": total,
                "ativos": ativos,
                "inativos": total - ativos,
                "sem_codigo": sem_codigo,
                "por_tipo": [{"tipo": t, "total": c} for t, c in por_tipo],
                "media_valor_cmi": round(float(medias[0] or 0), 2),
                "media_valor_venda": round(float(medias[1] or 0), 2),
                "media_valor_parceiro": round(float(medias[2] or 0), 2),
            }
        )

    except Exception as exc:
        current_app.logger.exception("Erro ao buscar estatísticas")
        return json_error(f"Erro ao buscar estatísticas: {exc}", 500)


@exames_bp.route("/exames/calcular", methods=["POST"])
def calcular_total():
    """
    Calcula o total de uma lista de exames.

    Body JSON:
        exames_ids           : list[int] (obrigatório)
        desconto_percentual  : float     (opcional)
        desconto_valor       : float     (opcional)
    """
    try:
        data = request.json or {}
        exames_ids = data.get("exames_ids", [])

        if not exames_ids:
            return json_error("Lista de exames_ids é obrigatória", 400)

        exames = Exames.query.filter(
            Exames.id.in_(exames_ids),
            Exames.ativo.is_(True),
        ).all()

        if not exames:
            return json_error("Nenhum exame encontrado", 404)

        total_cmi = sum(float(e.valor_cmi or 0) for e in exames)
        total_venda = sum(float(e.valor_venda or 0) for e in exames)
        total_parceiro = sum(float(e.valor_parceiro or 0) for e in exames)

        desconto_percentual = normalize_float(data.get("desconto_percentual")) or 0.0
        desconto_valor = normalize_float(data.get("desconto_valor")) or 0.0

        desconto_calculado = (
            total_venda * (desconto_percentual / 100)
            if desconto_percentual > 0
            else desconto_valor
        )
        total_final = max(0.0, total_venda - desconto_calculado)

        return jsonify(
            {
                "quantidade": len(exames),
                "exames": [e.to_dict() for e in exames],
                "total_cmi": round(total_cmi, 2),
                "total_venda": round(total_venda, 2),
                "total_parceiro": round(total_parceiro, 2),
                "desconto": round(desconto_calculado, 2),
                "total_final": round(total_final, 2),
                "margem_bruta": round(total_final - total_cmi, 2),
            }
        )

    except Exception as exc:
        current_app.logger.exception("Erro ao calcular total")
        return json_error(f"Erro ao calcular total: {exc}", 500)


@exames_bp.route("/exames/exportar", methods=["GET"])
def exportar_csv():
    """
    Exporta lista de exames em CSV.

    Aplica os mesmos filtros do GET /exames (search, tipo, ativo).
    """
    try:
        query = Exames.query

        # Busca inteligente consistente com GET /exames
        if search := normalize_string(request.args.get("search")):
            smart_filter = build_smart_search_filter(
                [Exames.nome, Exames.codigo], search
            )
            if smart_filter is not None:
                query = query.filter(smart_filter)

        if tipo := normalize_string(request.args.get("tipo")):
            from app.utils.search import unaccent  # noqa: PLC0415

            query = query.filter(unaccent(Exames.tipo).ilike(f"%{tipo}%"))

        query = _apply_ativo_filter(query, request.args)

        exames = query.order_by(Exames.nome).all()

        header = (
            "id;codigo;codigo_parceiro;nome;tipo;"
            "valor_cmi;valor_venda;valor_parceiro;ativo"
        )
        rows = [header]
        for e in exames:
            rows.append(
                ";".join(
                    [
                        str(e.id),
                        e.codigo or "",
                        e.codigo_parceiro or "",
                        f'"{e.nome}"',
                        e.tipo or "",
                        f"{float(e.valor_cmi or 0):.2f}",
                        f"{float(e.valor_venda or 0):.2f}",
                        f"{float(e.valor_parceiro or 0):.2f}",
                        "Sim" if e.ativo else "Não",
                    ]
                )
            )

        return Response(
            "\n".join(rows),
            mimetype="text/csv",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=exames_{datetime.now():%Y%m%d}.csv"
                )
            },
        )

    except Exception as exc:
        current_app.logger.exception("Erro ao exportar exames")
        return json_error(f"Erro ao exportar: {exc}", 500)


@exames_bp.route("/exames/importar", methods=["POST"])
def importar_csv():
    """
    Importa exames de CSV.

    Body: multipart/form-data com arquivo 'file'.
    Formato esperado: codigo;nome;tipo;valor_cmi;valor_venda;valor_parceiro
    """
    try:
        if "file" not in request.files:
            return json_error("Arquivo não enviado", 400)

        file = request.files["file"]
        if not file.filename.endswith(".csv"):
            return json_error("Formato inválido. Envie um arquivo CSV", 400)

        content = file.read().decode("utf-8-sig")
        lines = content.strip().split("\n")

        if len(lines) < 2:
            return json_error("Arquivo vazio ou sem dados", 400)

        criados = 0
        atualizados = 0
        erros: list[str] = []

        for i, line in enumerate(lines[1:], start=2):
            try:
                parts = line.strip().split(";")
                if len(parts) < 3:
                    erros.append(f"Linha {i}: formato inválido")
                    continue

                codigo = parts[0].strip().upper() or None
                nome = parts[1].strip().replace('"', "")
                tipo = parts[2].strip().upper()

                if not nome or not tipo:
                    erros.append(f"Linha {i}: nome e tipo são obrigatórios")
                    continue

                # Busca existente por código ou nome+tipo
                existente = None
                if codigo:
                    existente = Exames.query.filter(
                        func.upper(Exames.codigo) == codigo
                    ).first()

                if not existente:
                    existente = Exames.query.filter(
                        func.lower(Exames.nome) == nome.lower(),
                        func.lower(Exames.tipo) == tipo.lower(),
                    ).first()

                def _parse_valor(idx: int) -> float:
                    if len(parts) > idx and parts[idx].strip():
                        return float(parts[idx].replace(",", "."))
                    return 0.0

                valores = {
                    "nome": nome,
                    "tipo": tipo,
                    "valor_cmi": _parse_valor(3),
                    "valor_venda": _parse_valor(4),
                    "valor_parceiro": _parse_valor(5),
                }

                if existente:
                    for key, value in valores.items():
                        setattr(existente, key, value)
                    atualizados += 1
                else:
                    db.session.add(
                        Exames(codigo=codigo or _gerar_codigo_exame(), **valores)
                    )
                    criados += 1

            except Exception as err:
                erros.append(f"Linha {i}: {err}")

        db.session.commit()

        return json_success(
            f"Importação concluída: {criados} criados, {atualizados} atualizados",
            {"criados": criados, "atualizados": atualizados, "erros": erros[:10]},
        )

    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Erro ao importar exames")
        return json_error(f"Erro ao importar: {exc}", 500)
