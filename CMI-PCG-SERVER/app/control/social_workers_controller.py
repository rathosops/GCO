"""
Controller de Assistentes Sociais.

Rotas:
- GET    /assistentes-sociais
- GET    /assistentes-sociais/<id>
- GET    /assistentes-sociais/cress/<cress>
- POST   /assistentes-sociais
- PUT    /assistentes-sociais/<id>
- DELETE /assistentes-sociais/<id>
- GET    /assistentes-sociais/autocomplete
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Any, Optional

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.social_workers_model import AssistentesSociais

assistentes_sociais_bp = Blueprint("assistentes_sociais", __name__)

DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y")
ALLOWED_SEX = {"M", "F"}


def _json_error(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


def _only_digits(value: Any) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _clean_cpf(cpf: Any) -> Optional[str]:
    digits = _only_digits(cpf)
    return digits if len(digits) == 11 else None


def _format_cpf(cpf: str) -> str:
    s = _only_digits(cpf)
    if len(s) != 11:
        return s
    return f"{s[:3]}.{s[3:6]}.{s[6:9]}-{s[9:]}"


def _normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    s = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _clean_phone(phone: Any) -> Optional[int]:
    digits = _only_digits(phone)
    return int(digits) if digits else None


def _assistente_to_dict(assistente: AssistentesSociais) -> dict:
    """Serializa assistente social com campos formatados."""
    data = assistente.to_dict()
    data["cpf_formatado"] = _format_cpf(assistente.cpf)
    return data


@assistentes_sociais_bp.route("/assistentes-sociais", methods=["GET"])
def listar_assistentes():
    """Lista assistentes sociais com filtros."""
    try:
        query = AssistentesSociais.query

        if nome := request.args.get("nome"):
            query = query.filter(AssistentesSociais.nome.ilike(f"%{nome}%"))

        if cress := request.args.get("cress"):
            query = query.filter(AssistentesSociais.cress.ilike(f"%{cress}%"))

        if cpf := request.args.get("cpf"):
            cpf_limpo = _clean_cpf(cpf)
            if cpf_limpo:
                query = query.filter(AssistentesSociais.cpf == cpf_limpo)

        ativo = request.args.get("ativo")
        if ativo is not None:
            query = query.filter(
                AssistentesSociais.ativo == (ativo.lower() == "true")
            )

        if search := request.args.get("search"):
            term = f"%{search}%"
            query = query.filter(
                or_(
                    AssistentesSociais.nome.ilike(term),
                    AssistentesSociais.cress.ilike(term),
                )
            )

        query = query.order_by(AssistentesSociais.nome.asc())

        if limit := _parse_int(request.args.get("limit")):
            query = query.limit(min(limit, 100))
        if offset := _parse_int(request.args.get("offset")):
            query = query.offset(offset)

        return jsonify([_assistente_to_dict(a) for a in query.all()])

    except Exception:
        current_app.logger.error("Erro ao listar assistentes sociais", exc_info=True)
        return _json_error("Erro ao listar assistentes sociais", 500)


@assistentes_sociais_bp.route("/assistentes-sociais/<int:assistente_id>", methods=["GET"])
def buscar_assistente(assistente_id: int):
    """Busca assistente social por ID."""
    try:
        assistente = AssistentesSociais.query.get(assistente_id)
        if not assistente:
            return _json_error("Assistente social não encontrado", 404)
        return jsonify(_assistente_to_dict(assistente))
    except Exception:
        current_app.logger.error("Erro ao buscar assistente social", exc_info=True)
        return _json_error("Erro ao buscar assistente social", 500)


@assistentes_sociais_bp.route("/assistentes-sociais/cress/<cress>", methods=["GET"])
def buscar_por_cress(cress: str):
    """Busca assistente social por CRESS."""
    try:
        assistente = AssistentesSociais.query.filter(
            AssistentesSociais.cress == cress.strip()
        ).first()
        if not assistente:
            return _json_error("Assistente social não encontrado", 404)
        return jsonify(_assistente_to_dict(assistente))
    except Exception:
        current_app.logger.error("Erro ao buscar assistente por CRESS", exc_info=True)
        return _json_error("Erro ao buscar assistente social", 500)


@assistentes_sociais_bp.route("/assistentes-sociais", methods=["POST"])
def criar_assistente():
    """
    Cria novo assistente social.

    Body JSON:
        - nome (obrigatório)
        - cpf (obrigatório)
        - cress (obrigatório)
        - data_de_nascimento (obrigatório)
        - sexo (obrigatório): M ou F
        - telefone (opcional)
        - email (opcional)
    """
    try:
        data = request.json or {}

        nome = _normalize_text(data.get("nome"))
        if not nome:
            return _json_error("nome é obrigatório", 400)

        cpf = _clean_cpf(data.get("cpf"))
        if not cpf:
            return _json_error("cpf é obrigatório e deve ter 11 dígitos", 400)

        cress = _normalize_text(data.get("cress"))
        if not cress:
            return _json_error("cress é obrigatório", 400)

        data_nascimento = _parse_date(data.get("data_de_nascimento"))
        if not data_nascimento:
            return _json_error("data_de_nascimento é obrigatória (YYYY-MM-DD ou DD/MM/YYYY)", 400)

        sexo = (data.get("sexo") or "").strip().upper()
        if sexo not in ALLOWED_SEX:
            return _json_error("sexo inválido (use 'M' ou 'F')", 400)

        if AssistentesSociais.query.filter(AssistentesSociais.cpf == cpf).first():
            return _json_error("Já existe assistente social com este CPF", 409)

        if AssistentesSociais.query.filter(AssistentesSociais.cress == cress).first():
            return _json_error("Já existe assistente social com este CRESS", 409)

        novo = AssistentesSociais(
            nome=nome,
            cpf=cpf,
            cress=cress,
            data_de_nascimento=data_nascimento,
            sexo=sexo,
            telefone=_clean_phone(data.get("telefone")),
            email=_normalize_text(data.get("email")),
            ativo=True,
        )

        db.session.add(novo)
        db.session.commit()

        return jsonify({
            "message": "Assistente social criado com sucesso",
            "assistente_social": _assistente_to_dict(novo),
        }), 201

    except IntegrityError:
        db.session.rollback()
        return _json_error("CPF ou CRESS já cadastrado", 409)
    except Exception:
        db.session.rollback()
        current_app.logger.error("Erro ao criar assistente social", exc_info=True)
        return _json_error("Erro ao criar assistente social", 500)


@assistentes_sociais_bp.route("/assistentes-sociais/<int:assistente_id>", methods=["PUT"])
def atualizar_assistente(assistente_id: int):
    """Atualiza assistente social."""
    try:
        assistente = AssistentesSociais.query.get(assistente_id)
        if not assistente:
            return _json_error("Assistente social não encontrado", 404)

        data = request.json or {}

        if "nome" in data:
            nome = _normalize_text(data.get("nome"))
            if not nome:
                return _json_error("nome não pode ser vazio", 400)
            assistente.nome = nome

        if "cpf" in data:
            cpf = _clean_cpf(data.get("cpf"))
            if not cpf:
                return _json_error("cpf inválido (11 dígitos)", 400)
            existente = AssistentesSociais.query.filter(
                AssistentesSociais.cpf == cpf,
                AssistentesSociais.id != assistente_id
            ).first()
            if existente:
                return _json_error("CPF já cadastrado para outro assistente", 409)
            assistente.cpf = cpf

        if "cress" in data:
            cress = _normalize_text(data.get("cress"))
            if not cress:
                return _json_error("cress não pode ser vazio", 400)
            existente = AssistentesSociais.query.filter(
                AssistentesSociais.cress == cress,
                AssistentesSociais.id != assistente_id
            ).first()
            if existente:
                return _json_error("CRESS já cadastrado para outro assistente", 409)
            assistente.cress = cress

        if "data_de_nascimento" in data:
            dt = _parse_date(data.get("data_de_nascimento"))
            if not dt:
                return _json_error("data_de_nascimento inválida", 400)
            assistente.data_de_nascimento = dt

        if "sexo" in data:
            sexo = (data.get("sexo") or "").strip().upper()
            if sexo not in ALLOWED_SEX:
                return _json_error("sexo inválido (use 'M' ou 'F')", 400)
            assistente.sexo = sexo

        if "telefone" in data:
            assistente.telefone = _clean_phone(data.get("telefone"))

        if "email" in data:
            assistente.email = _normalize_text(data.get("email"))

        if "ativo" in data:
            assistente.ativo = bool(data.get("ativo"))

        db.session.commit()

        return jsonify({
            "message": "Assistente social atualizado",
            "assistente_social": _assistente_to_dict(assistente),
        })

    except IntegrityError:
        db.session.rollback()
        return _json_error("CPF ou CRESS já cadastrado", 409)
    except Exception:
        db.session.rollback()
        current_app.logger.error("Erro ao atualizar assistente social", exc_info=True)
        return _json_error("Erro ao atualizar assistente social", 500)


@assistentes_sociais_bp.route("/assistentes-sociais/<int:assistente_id>", methods=["DELETE"])
def excluir_assistente(assistente_id: int):
    """Exclui assistente social (desativa se houver vínculos)."""
    try:
        assistente = AssistentesSociais.query.get(assistente_id)
        if not assistente:
            return _json_error("Assistente social não encontrado", 404)

        # Verifica vínculos com perícias
        from app.models.pericia_imesc_model import PericiaIMESC
        pericias_count = PericiaIMESC.query.filter(
            PericiaIMESC.cress_assistente == assistente.cress
        ).count()

        if pericias_count > 0:
            assistente.ativo = False
            db.session.commit()
            return jsonify({
                "message": f"Assistente desativado (possui {pericias_count} perícia(s) vinculada(s))",
            })

        db.session.delete(assistente)
        db.session.commit()

        return jsonify({"message": "Assistente social excluído com sucesso"})

    except Exception:
        db.session.rollback()
        current_app.logger.error("Erro ao excluir assistente social", exc_info=True)
        return _json_error("Erro ao excluir assistente social", 500)


@assistentes_sociais_bp.route("/assistentes-sociais/autocomplete", methods=["GET"])
def autocomplete_assistentes():
    """Busca rápida para autocomplete."""
    try:
        q = (request.args.get("q") or "").strip()
        limit = _parse_int(request.args.get("limit")) or 10

        if len(q) < 2:
            return jsonify([])

        term = f"%{q}%"
        assistentes = (
            AssistentesSociais.query
            .filter(
                AssistentesSociais.ativo == True,
                or_(
                    AssistentesSociais.nome.ilike(term),
                    AssistentesSociais.cress.ilike(term),
                )
            )
            .order_by(AssistentesSociais.nome)
            .limit(limit)
            .all()
        )

        return jsonify([
            {
                "id": a.id,
                "nome": a.nome,
                "cress": a.cress,
            }
            for a in assistentes
        ])

    except Exception:
        current_app.logger.error("Erro no autocomplete de assistentes", exc_info=True)
        return jsonify([])
