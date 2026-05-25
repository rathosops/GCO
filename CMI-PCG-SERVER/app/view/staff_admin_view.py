# app/view/staff_admin_view.py
"""
Staff Admin UI - painel HTML para gestão de usuários e permissões.

Rota:
- GET /dev-admin/users → Painel de gestão de usuários

NOTA: A autenticação das APIs é feita pelo staff_admin_controller.
      Esta view apenas serve o HTML (mesmo padrão do dev_admin).
"""

from __future__ import annotations

from flask import Blueprint, render_template

staff_admin_view_bp = Blueprint(
    "staff_admin_view",
    __name__,
    url_prefix="/dev-admin",
)


@staff_admin_view_bp.route("/users", methods=["GET"])
def users_panel():
    """Renderiza o painel de gestão de usuários."""
    return render_template("staff_admin/index.html")