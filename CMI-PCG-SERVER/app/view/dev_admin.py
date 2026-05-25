# view/dev_admin.py
"""
Dev Admin UI - painel HTML/JS para utilidades de desenvolvimento.

Rota principal:
- GET /dev-admin
"""

from __future__ import annotations

from flask import Blueprint, render_template

dev_admin_bp = Blueprint("dev_admin", __name__, url_prefix="/dev-admin")


@dev_admin_bp.route("/", methods=["GET"])
def index():
    return render_template("dev_admin/index.html")
