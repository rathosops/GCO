import re
import requests
from flask import Blueprint, jsonify

cep_bp = Blueprint("cep", __name__)


def clean_cep(cep: str) -> str:
    return re.sub(r"\D", "", cep or "")


@cep_bp.route("/cep/<cep>", methods=["GET"])
def get_cep(cep: str):
    cep = clean_cep(cep)
    if len(cep) != 8:
        return jsonify({"error": "CEP inválido"}), 400

    # 1) BrasilAPI
    try:
        r = requests.get(f"https://brasilapi.com.br/api/cep/v1/{cep}", timeout=5)
        if r.status_code == 200:
            data = r.json()
            return jsonify(
                {
                    "cep": cep,
                    "logradouro": data.get("street") or "",
                    "bairro": data.get("neighborhood") or "",
                    "cidade": data.get("city") or "",
                    "uf": data.get("state") or "",
                    "complemento": "",
                    "fonte": "brasilapi",
                }
            )
    except Exception:
        pass

    # 2) ViaCEP fallback
    try:
        r = requests.get(f"https://viacep.com.br/ws/{cep}/json/", timeout=5)
        if r.status_code == 200:
            data = r.json()
            if data.get("erro"):
                return jsonify({"error": "CEP não encontrado"}), 404
            return jsonify(
                {
                    "cep": cep,
                    "logradouro": data.get("logradouro") or "",
                    "bairro": data.get("bairro") or "",
                    "cidade": data.get("localidade") or "",
                    "uf": data.get("uf") or "",
                    "complemento": data.get("complemento") or "",
                    "fonte": "viacep",
                }
            )
    except Exception:
        pass

    return jsonify({"error": "Falha ao consultar CEP"}), 502
