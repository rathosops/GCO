"""Controller para procedimentos da clínica"""

from flask import Blueprint
from app.control.base_clinical_procedures_controller import BaseClinicalProcedureController
from app.models.procedures_model import Procedimentos

procedimentos_bp = Blueprint("procedimentos", __name__)
controller = BaseClinicalProcedureController(Procedimentos, "nome", "Procedimento")


@procedimentos_bp.route("/procedimentos", methods=["GET"])
def get_procedimentos():
    return controller.get_all()


@procedimentos_bp.route("/procedimentos", methods=["POST"])
def create_procedimento():
    return controller.create()
