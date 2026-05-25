"""
Controller para importação e reconciliação de NFS-e via PDF.

Endpoints:
    POST /nfse/upload/preview  — Dry-run: mostra o que seria vinculado.
    POST /nfse/upload/apply    — Efetiva as vinculações no banco.

O PDF deve ser enviado como multipart/form-data com campo "file".
"""

from __future__ import annotations

import traceback

from flask import Blueprint, current_app, jsonify, request

from app.src.nfse_pdf_parser import NfsePdfParser
from app.src.nfse_reconciliation import NfseReconciliationService

nfse_import_bp = Blueprint("nfse_import", __name__, url_prefix="/nfse")

ALLOWED_EXTENSIONS = {"pdf"}
MAX_FILE_SIZE_MB = 10

parser = NfsePdfParser()
reconciliation_service = NfseReconciliationService()


def _validate_upload() -> tuple[bytes | None, str | None, int | None]:
    """
    Valida o arquivo enviado no request.

    Returns:
        (file_bytes, error_msg, status_code)
    """
    if "file" not in request.files:
        return None, "Campo 'file' é obrigatório.", 400

    file = request.files["file"]

    if not file or not file.filename:
        return None, "Nenhum arquivo selecionado.", 400

    # Verificar extensão
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return None, "Apenas arquivos PDF são aceitos.", 400

    # Ler bytes
    file_bytes = file.read()

    if not file_bytes:
        return None, "Arquivo vazio.", 400

    # Verificar tamanho
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        return None, f"Arquivo excede o limite de {MAX_FILE_SIZE_MB}MB.", 400

    return file_bytes, None, None


# ============================================
# POST /nfse/upload/preview
# ============================================
@nfse_import_bp.route("/upload/preview", methods=["POST"])
def preview_nfse_import():
    """
    Faz upload do PDF de NFS-e e retorna preview da reconciliação
    sem alterar o banco (dry-run).

    Request: multipart/form-data com campo "file" (PDF).

    Response:
        {
            "parse": { cnpj_prestador, periodo, total_registros, ... },
            "reconciliation": { matched, unmatched, already_linked, ... }
        }
    """
    try:
        file_bytes, error, status = _validate_upload()
        if error:
            return jsonify({"error": error}), status

        # Parse do PDF
        parse_result = parser.parse(file_bytes)

        if parse_result.erros and not parse_result.registros:
            return (
                jsonify(
                    {
                        "error": "Falha ao extrair dados do PDF.",
                        "detalhes": parse_result.erros,
                    }
                ),
                422,
            )

        # Reconciliação (dry-run)
        report = reconciliation_service.preview(parse_result)

        return jsonify(
            {
                "parse": {
                    "cnpj_prestador": parse_result.cnpj_prestador,
                    "razao_social": parse_result.razao_social_prestador,
                    "periodo_inicio": (
                        parse_result.periodo_inicio.isoformat()
                        if parse_result.periodo_inicio
                        else None
                    ),
                    "periodo_fim": (
                        parse_result.periodo_fim.isoformat()
                        if parse_result.periodo_fim
                        else None
                    ),
                    "total_registros": parse_result.total_notas_emitidas,
                    "total_normais": len(parse_result.registros_normais),
                    "total_canceladas": len(parse_result.registros_cancelados),
                    "erros_parse": parse_result.erros,
                },
                "reconciliation": report.to_dict(),
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[NFS-e Import] Erro no preview: %s\n%s",
            exc,
            traceback.format_exc(),
        )
        return jsonify({"error": "Erro ao processar PDF."}), 500


# ============================================
# POST /nfse/upload/apply
# ============================================
@nfse_import_bp.route("/upload/apply", methods=["POST"])
def apply_nfse_import():
    """
    Faz upload do PDF de NFS-e e efetiva as vinculações no banco.

    Request: multipart/form-data com campo "file" (PDF).

    Response:
        {
            "message": "Vinculações aplicadas com sucesso.",
            "applied": 42,
            "reconciliation": { ... }
        }
    """
    try:
        file_bytes, error, status = _validate_upload()
        if error:
            return jsonify({"error": error}), status

        # Parse do PDF
        parse_result = parser.parse(file_bytes)

        if parse_result.erros and not parse_result.registros:
            return (
                jsonify(
                    {
                        "error": "Falha ao extrair dados do PDF.",
                        "detalhes": parse_result.erros,
                    }
                ),
                422,
            )

        # Reconciliação (aplica no banco)
        report = reconciliation_service.apply(parse_result)

        return jsonify(
            {
                "message": f"{report.applied} vinculações aplicadas com sucesso.",
                "applied": report.applied,
                "reconciliation": report.to_dict(),
            }
        )

    except Exception as exc:
        current_app.logger.error(
            "[NFS-e Import] Erro ao aplicar: %s\n%s",
            exc,
            traceback.format_exc(),
        )
        return jsonify({"error": "Erro ao aplicar vinculações."}), 500
