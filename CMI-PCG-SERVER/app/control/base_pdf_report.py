"""Classe principal para todos os controllers que geram pdf's"""

import io
import os
import traceback
from abc import ABC, abstractmethod
from flask import current_app, render_template, send_file
from weasyprint import HTML


class BasePdfReport(ABC):
    """Classe base para geração de relatórios PDF."""

    template_path: str
    filename: str
    context: dict

    @abstractmethod
    def build_context(self):
        """Montar o contexto para o template HTML."""
        pass

    def render_html(self):
        """Renderiza o HTML com o contexto fornecido."""
        return render_template(self.template_path, **self.context)

    def generate_pdf(self, html_str):
        """Gera um PDF a partir de uma string HTML."""
        pdf_buffer = io.BytesIO()
        base_url = f"file://{os.path.abspath(current_app.root_path)}/"
        HTML(string=html_str, base_url=base_url).write_pdf(pdf_buffer)
        pdf_buffer.seek(0)
        return pdf_buffer

    def generate_response(self):
        """Renderiza o HTML, gera o PDF e retorna como resposta."""
        try:
            self.build_context()
            html = self.render_html()
            pdf_file = self.generate_pdf(html)
            return send_file(
                pdf_file,
                as_attachment=True,
                download_name=self.filename,
                mimetype="application/pdf",
            )
        except Exception as error:
            traceback.print_exc()
            return {"error": str(error)}, 500
