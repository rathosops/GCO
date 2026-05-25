"""Controller para convênios"""

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.exc import IntegrityError
from app.database import db
from app.models.insurances_model import Convenios

convenios_bp = Blueprint("convenios", __name__)


def format_cnpj(cnpj: str | int) -> str:
    """Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX"""
    cnpj_str = str(cnpj).zfill(14)
    return f"{cnpj_str[:2]}.{cnpj_str[2:5]}.{cnpj_str[5:8]}/{cnpj_str[8:12]}-{cnpj_str[12:14]}"


def clean_cnpj(cnpj: str) -> int:
    """Remove formatação do CNPJ e retorna como inteiro"""
    return int("".join(filter(str.isdigit, str(cnpj))))


def convenio_to_dict(convenio: Convenios, include_pacientes: bool = False) -> dict:
    """Converte convênio para dicionário com CNPJ formatado"""
    result = {
        "id": convenio.id,
        "cnpj": format_cnpj(convenio.cnpj),
        "cnpj_raw": convenio.cnpj,
        "nome": convenio.nome,
        "numero_para_contato": convenio.numero_para_contato,
        "email": convenio.email,
        "emite_guia": convenio.emite_guia if hasattr(convenio, "emite_guia") else False,
    }

    if include_pacientes and hasattr(convenio, "pacientes"):
        result["pacientes"] = [
            {"id": p.id, "nome": p.nome, "cpf": p.cpf} for p in convenio.pacientes
        ]
        result["total_pacientes"] = len(convenio.pacientes)

    return result


# ============================================
# GET - Listar todos os convênios
# ============================================
@convenios_bp.route("/convenios", methods=["GET"])
def get_convenios():
    """
    Lista todos os convênios.

    Query params:
        - cnpj: filtra por CNPJ exato
        - nome: filtra por nome (case insensitive, parcial)
        - emite_guia: filtra por exigência de guia (true/false)
        - include_pacientes: se 'true', inclui lista de pacientes
    """
    try:
        query = Convenios.query

        # Filtro por CNPJ
        if cnpj := request.args.get("cnpj"):
            cnpj_limpo = clean_cnpj(cnpj)
            query = query.filter(Convenios.cnpj == cnpj_limpo)

        # Filtro por nome
        if nome := request.args.get("nome"):
            query = query.filter(Convenios.nome.ilike(f"%{nome}%"))

        # Filtro por emite_guia
        if emite_guia := request.args.get("emite_guia"):
            query = query.filter(Convenios.emite_guia == (emite_guia.lower() == "true"))

        # Ordenação
        query = query.order_by(Convenios.nome.asc())

        convenios = query.all()
        include_pacientes = request.args.get("include_pacientes", "").lower() == "true"

        return jsonify([convenio_to_dict(c, include_pacientes) for c in convenios])

    except Exception as e:
        current_app.logger.error(f"Erro ao listar convênios: {e}")
        return jsonify({"error": "Erro ao listar convênios"}), 500


# ============================================
# GET - Buscar convênio por ID
# ============================================
@convenios_bp.route("/convenios/<int:id>", methods=["GET"])
def get_convenio_by_id(id: int):
    """Busca convênio por ID"""
    try:
        convenio = Convenios.query.get(id)

        if not convenio:
            return jsonify({"error": "Convênio não encontrado"}), 404

        return jsonify(convenio_to_dict(convenio, include_pacientes=True))

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar convênio {id}: {e}")
        return jsonify({"error": "Erro ao buscar convênio"}), 500


# ============================================
# GET - Buscar convênio por CNPJ
# ============================================
@convenios_bp.route("/convenios/cnpj/<cnpj>", methods=["GET"])
def get_convenio_by_cnpj(cnpj: str):
    """Busca convênio por CNPJ"""
    try:
        cnpj_limpo = clean_cnpj(cnpj)
        convenio = Convenios.query.filter(Convenios.cnpj == cnpj_limpo).first()

        if not convenio:
            return jsonify({"error": "Convênio não encontrado"}), 404

        return jsonify(convenio_to_dict(convenio, include_pacientes=True))

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar convênio por CNPJ {cnpj}: {e}")
        return jsonify({"error": "Erro ao buscar convênio"}), 500


# ============================================
# POST - Criar novo convênio
# ============================================
@convenios_bp.route("/convenios", methods=["POST"])
def create_convenio():
    """
    Cria novo convênio.

    Body JSON:
        - cnpj (obrigatório): CNPJ do convênio
        - nome (obrigatório): Nome do convênio
        - numero_para_contato: Telefone
        - email: Email
        - emite_guia: Se exige guia de autorização (default: false)
    """
    try:
        data = request.json

        # Validações
        if not data.get("cnpj"):
            return jsonify({"error": "CNPJ é obrigatório"}), 400
        if not data.get("nome"):
            return jsonify({"error": "Nome é obrigatório"}), 400

        cnpj_limpo = clean_cnpj(data["cnpj"])

        # Verifica se já existe
        if Convenios.query.filter(Convenios.cnpj == cnpj_limpo).first():
            return jsonify({"error": "Convênio com este CNPJ já está cadastrado"}), 409

        novo_convenio = Convenios(
            cnpj=cnpj_limpo,
            nome=data["nome"].strip(),
            numero_para_contato=(
                clean_cnpj(data["numero_para_contato"])
                if data.get("numero_para_contato")
                else None
            ),
            email=data.get("email", "").strip() or None,
            emite_guia=data.get("emite_guia", False),
        )

        db.session.add(novo_convenio)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": "Convênio criado com sucesso",
                    "convenio": convenio_to_dict(novo_convenio),
                }
            ),
            201,
        )

    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(f"Erro de integridade ao criar convênio: {e}")
        return jsonify({"error": "Convênio com este CNPJ já está cadastrado"}), 409

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Erro ao criar convênio: {e}")
        return jsonify({"error": "Erro ao criar convênio"}), 500


# ============================================
# PUT - Atualizar convênio
# ============================================
@convenios_bp.route("/convenios/<int:id>", methods=["PUT"])
def update_convenio(id: int):
    """
    Atualiza convênio existente.

    Body JSON (todos opcionais):
        - cnpj: Novo CNPJ
        - nome: Novo nome
        - numero_para_contato: Novo telefone
        - email: Novo email
        - emite_guia: Nova configuração de exigência de guia
    """
    try:
        convenio = Convenios.query.get(id)

        if not convenio:
            return jsonify({"error": "Convênio não encontrado"}), 404

        data = request.json

        # Atualiza CNPJ se fornecido
        if "cnpj" in data and data["cnpj"]:
            novo_cnpj = clean_cnpj(data["cnpj"])
            # Verifica se novo CNPJ já existe em outro convênio
            existente = Convenios.query.filter(
                Convenios.cnpj == novo_cnpj, Convenios.id != id
            ).first()
            if existente:
                return (
                    jsonify(
                        {"error": "Este CNPJ já está cadastrado em outro convênio"}
                    ),
                    409,
                )
            convenio.cnpj = novo_cnpj

        # Atualiza outros campos
        if "nome" in data and data["nome"]:
            convenio.nome = data["nome"].strip()

        if "numero_para_contato" in data:
            convenio.numero_para_contato = (
                clean_cnpj(data["numero_para_contato"])
                if data["numero_para_contato"]
                else None
            )

        if "email" in data:
            convenio.email = data["email"].strip() if data["email"] else None

        if "emite_guia" in data:
            convenio.emite_guia = bool(data["emite_guia"])

        db.session.commit()

        return jsonify(
            {
                "message": "Convênio atualizado com sucesso",
                "convenio": convenio_to_dict(convenio),
            }
        )

    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(f"Erro de integridade ao atualizar convênio: {e}")
        return jsonify({"error": "Erro ao atualizar convênio"}), 409

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Erro ao atualizar convênio {id}: {e}")
        return jsonify({"error": "Erro ao atualizar convênio"}), 500


# ============================================
# DELETE - Excluir convênio
# ============================================
@convenios_bp.route("/convenios/<int:id>", methods=["DELETE"])
def delete_convenio(id: int):
    """
    Exclui convênio.

    Retorna erro se houver pacientes vinculados.
    """
    try:
        convenio = Convenios.query.get(id)

        if not convenio:
            return jsonify({"error": "Convênio não encontrado"}), 404

        # Verifica se tem pacientes vinculados
        if hasattr(convenio, "pacientes") and len(convenio.pacientes) > 0:
            return (
                jsonify(
                    {
                        "error": "Não é possível excluir convênio com pacientes vinculados",
                        "total_pacientes": len(convenio.pacientes),
                    }
                ),
                409,
            )

        nome_convenio = convenio.nome
        db.session.delete(convenio)
        db.session.commit()

        return jsonify({"message": f"Convênio '{nome_convenio}' excluído com sucesso"})

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Erro ao excluir convênio {id}: {e}")
        return jsonify({"error": "Erro ao excluir convênio"}), 500


# ============================================
# GET - Estatísticas de convênios
# ============================================
@convenios_bp.route("/convenios/stats", methods=["GET"])
def get_convenios_stats():
    """Retorna estatísticas dos convênios"""
    try:
        total = Convenios.query.count()
        total_emite_guia = Convenios.query.filter(Convenios.emite_guia == True).count()

        # Convênios com mais pacientes (top 5)
        convenios = Convenios.query.all()
        ranking = sorted(
            [
                {
                    "nome": c.nome,
                    "total": len(c.pacientes) if hasattr(c, "pacientes") else 0,
                }
                for c in convenios
            ],
            key=lambda x: x["total"],
            reverse=True,
        )[:5]

        return jsonify(
            {"total": total, "total_emite_guia": total_emite_guia, "ranking": ranking}
        )

    except Exception as e:
        current_app.logger.error(f"Erro ao buscar estatísticas de convênios: {e}")
        return jsonify({"error": "Erro ao buscar estatísticas"}), 500
