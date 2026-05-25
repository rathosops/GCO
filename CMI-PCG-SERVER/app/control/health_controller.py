"""Controller para health check do sistema"""

from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_check():
    """Endpoint de health check para Docker/Kubernetes"""
    return jsonify({"status": "healthy", "service": "cmi-pcg-server"}), 200