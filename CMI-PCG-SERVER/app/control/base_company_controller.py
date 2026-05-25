"""Controlador base para operações CRUD simples de recursos
relacionados a empresas ou convênios."""

import logging
from flask import request, jsonify, current_app
from sqlalchemy.exc import IntegrityError
from app.database import db


class BaseCompanyController:
    """
    Esta classe oferece métodos para:
    - Obter uma lista de instâncias filtradas por parâmetros opcionais na query string.
    - Criar uma nova instância do recurso com dados fornecidos em JSON.

    A classe é parametrizada pelo modelo SQLAlchemy e o nome do recurso para respostas.
    """

    def __init__(self, model, resource_name: str):
        self.model = model
        self.resource_name = resource_name

    def get_all(self):
        """
        Obtém todas as instâncias do recurso, podendo filtrar por 'cnpj' e 'nome'.

        Query params suportados:
            - cnpj: filtra pelo campo 'cnpj' exato.
            - nome: filtra por nome que contenha o valor (case insensitive).

        Returns:
            flask.Response: JSON com a lista de objetos encontrados.
        """
        filters = {}

        if cnpj := request.args.get("cnpj"):
            filters["cnpj"] = cnpj

        query = self.model.query.filter_by(**filters)

        if nome := request.args.get("nome"):
            query = query.filter(self.model.nome.ilike(f"%{nome}%"))

        results = query.all()
        return jsonify([item.to_dict() for item in results])

    def create(self):
        """
        Cria uma nova instância do recurso a partir dos dados JSON da requisição.

        Espera os campos obrigatórios:
            - cnpj (str ou int)
            - nome (str)

        Campos opcionais:
            - numero_para_contato
            - email

        Returns:
            flask.Response: JSON com mensagem de sucesso e dados da nova instância, código HTTP 201.
        """
        data = request.json

        new_instance = self.model(
            cnpj=data["cnpj"],
            nome=data["nome"],
            numero_para_contato=data.get("numero_para_contato"),
            email=data.get("email"),
        )
        try:
            db.session.add(new_instance)
            db.session.commit()
        except IntegrityError as e:
            db.session.rollback()

            # Verifica se o erro foi CNPJ duplicado
            if "cnpj" in str(e.orig).lower():
                current_app.logger.error(
                    f"{self.resource_name.capitalize()} com CNPJ: {new_instance.cnpj} já cadastrado"
                )
                return jsonify({
                    "error": f"{self.resource_name.capitalize()} já cadastrada no sistema."
                }), 409

            # Outros erros de integridade
            current_app.logger.error(
                f"[{self.resource_name}] Erro de integridade: {e.orig}"
            )
            return jsonify({"error": "Error de integridade no banco de dados."}), 500

        return (
            jsonify(
                {
                    "message": f"{self.resource_name} criado",
                    self.resource_name: new_instance.to_dict(),
                }
            ),
            201,
        )
