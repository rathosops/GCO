# app/view/documentos_livres_view.py
"""
Documentos Livres - página HTML para gerar atestados e receitas sem persistência.

Rota:
    GET /documentos-livres  → Formulário interativo
"""

from __future__ import annotations

from flask import Blueprint, render_template

documentos_livres_view_bp = Blueprint(
    "documentos_livres_view",
    __name__,
    url_prefix="/documentos-livres",
)


@documentos_livres_view_bp.route("/", methods=["GET"])
def index():
    """Renderiza formulário de documentos livres."""
    return render_template("documentos_livres/index.html")
