"""classe base para procedimentos e exames clínicos"""

from flask import request, jsonify
from app.database import db


class BaseClinicalProcedureController:
    """
    Controller base para recursos simples com nome único e busca parcial por nome.
    """

    def __init__(self, model, field_name: str, resource_label: str):
        """
        :param model: Modelo SQLAlchemy
        :param field_name: Nome do campo principal (ex: 'nome' ou 'exame')
        :param resource_label: Nome descritivo do recurso (usado nas mensagens)
        """
        self.model = model
        self.field_name = field_name
        self.resource_label = resource_label

    def get_all(self):
        """
        Busca todos os registros do recurso, com filtro parcial por nome.
        """
        nome_busca = request.args.get(self.field_name)
        query = self.model.query

        if nome_busca:
            column = getattr(self.model, self.field_name)
            query = query.filter(column.ilike(f"%{nome_busca}%"))

        resultados = query.all()
        return jsonify(resultados)

    def create(self):
        """
        Cria um novo recurso com base nos dados JSON recebidos.
        """
        data = request.json
        valor = data.get(self.field_name)

        if not valor or not valor.strip():
            return jsonify({"error": f"Campo '{self.field_name}' é obrigatório"}), 400

        novo_registro = self.model(**{self.field_name: valor})
        db.session.add(novo_registro)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": f"{self.resource_label} criado com sucesso",
                    self.field_name: novo_registro,
                }
            ),
            201,
        )
