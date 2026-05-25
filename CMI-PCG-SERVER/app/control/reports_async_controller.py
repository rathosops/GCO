"""Endpoints para relatórios assíncronos (Celery) e status de tasks."""

from __future__ import annotations

from celery.result import AsyncResult
from flask import Blueprint, jsonify, request

from app.tasks.reports_tasks import export_faturamento_csv

reports_async_bp = Blueprint("reports_async", __name__)


@reports_async_bp.route("/relatorios/exports/faturamento", methods=["POST"])
def start_export_faturamento():
    """
    Dispara export do faturamento em background.

    Body JSON:
      - data_inicio: YYYY-MM-DD
      - data_fim: YYYY-MM-DD
    """
    body = request.get_json(force=True) or {}
    data_inicio = body.get("data_inicio")
    data_fim = body.get("data_fim")

    if not data_inicio or not data_fim:
        return jsonify({"error": "Campos obrigatórios: data_inicio, data_fim"}), 400

    task = export_faturamento_csv.delay(data_inicio, data_fim)
    return jsonify({"task_id": task.id}), 202


@reports_async_bp.route("/tasks/<task_id>", methods=["GET"])
def get_task_status(task_id: str):
    """Retorna estado e resultado (quando pronto) de uma task Celery."""
    res = AsyncResult(task_id)

    payload: dict = {"task_id": task_id, "state": res.state}

    if res.successful():
        payload["result"] = res.result
    elif res.failed():
        payload["error"] = str(res.result)

    return jsonify(payload), 200
