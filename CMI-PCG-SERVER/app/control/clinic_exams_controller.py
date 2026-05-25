"""Controller para exames da clínica"""

from flask import Blueprint
from app.control.base_clinical_procedures_controller import BaseClinicalProcedureController
from app.models.clinic_exams_model import ExamesClinica

exames_clinica_bp = Blueprint("exames_clinica", __name__)
controller = BaseClinicalProcedureController(ExamesClinica, "exame", "Exame da clínica")


@exames_clinica_bp.route("/exames-clinica", methods=["GET"])
def get_exames_clinica():
    return controller.get_all()


@exames_clinica_bp.route("/exames-clinica", methods=["POST"])
def create_exame_clinica():
    return controller.create()
