# app/blueprints.py
"""
Centraliza todas as blueprints do projeto.

JWT Guard:
- _write_protected: JWT em POST/PUT/PATCH/DELETE, GETs abertos.
- _master_protected: JWT + master em TODOS os métodos (incl. GET).
- _unprotected: sem JWT guard (auth própria ou read-only).
"""

# --- Módulos existentes ---
from app.control.patients_controller import pacientes_bp
from app.control.doctors_controller import medicos_bp
from app.control.companies_controller import empresas_bp
from app.control.company_sectors_controller import empresa_setores_bp
from app.control.company_positions_controller import empresa_cargos_bp
# --- Faturamento posterior ---
from app.control.company_billing_controller import faturamento_posterior_bp
from app.control.company_billing_pdf_controller import faturamento_posterior_pdf_bp
from app.control.employee_bonds_controller import vinculos_bp
from app.control.insurances_controller import convenios_bp
from app.control.payments_controller import pagamentos_bp
from app.control.financial_analytics_controller import financial_analytics_bp
from app.control.expenses_controller import despesas_bp
from app.control.expenses_analytics_controller import expenses_analytics_bp
from app.control.exams_controller import exames_bp
from app.control.clinic_exams_controller import exames_clinica_bp
from app.control.medical_appointments_controller import consultas_bp
from app.control.medical_records_controller import prontuarios_bp
from app.control.medical_records_pdf_controller import prontuario_pdf_bp
from app.control.procedures_controller import procedimentos_bp
from app.control.appointments_controller import agendamentos_bp
from app.control.appointment_receipt_pdf_controller import agendamento_comprovante_bp
from app.control.exam_request_controller import solicitacoes_exames_bp
from app.control.financial_controller import financial_bp
from app.control.aso_controller import aso_bp
from app.control.health_controller import health_bp
from app.control.dashboard_controller import dashboard_bp
from app.control.cep_controller import cep_bp
from app.control.patient_reports_controller import patient_reports_api_bp
from app.control.autocomplete_controller import autocomplete_bp
from app.control.patient_reports_pdf_controller import patient_reports_pdf_bp
from app.control.nfse_import_controller import nfse_import_bp
from app.control.reports_async_controller import reports_async_bp
from app.control.pericia_imesc_controller import pericias_imesc_bp
from app.control.pericia_imesc_pdf_controller import pericia_imesc_pdf_bp
from app.control.social_workers_controller import assistentes_sociais_bp
from app.control.holidays_controller import feriados_bp
from app.control.suppliers_controller import fornecedores_bp
from app.control.medications_controller import medicamentos_bp
from app.control.stock_controller import estoque_bp
from app.control.prescriptions_controller import receituarios_bp
from app.control.prescriptions_pdf_controller import receituario_pdf_bp
from app.control.audit_logs_controller import audit_logs_bp
from app.control.aso_questionario_controller import aso_questionarios_bp
from app.control.aso_questionario_pdf_controller import aso_questionario_pdf_bp
from app.control.staff_admin_controller import staff_admin_bp
from app.webhooks.google_forms_webhook import google_forms_webhook_bp

# --- módulos de autenticação ---
from app.control.auth_controller import auth_bp

# --- DevTools / Dev Admin ---
from app.control.devtools_controller import devtools_bp
from app.control.devtools_auth_debug import devtools_auth_bp
from app.view.dev_admin import dev_admin_bp
from app.view.staff_admin_view import staff_admin_view_bp

# --- Documentos sem registros ---
from app.view.documentos_livres_view import documentos_livres_view_bp
from app.control.documentos_livres_controller import documentos_livres_bp

# --- JWT Guard ---
from app.utils.jwt_guard import require_jwt_for_writes, require_master_for_all


# ============================================
# Blueprints MASTER-ONLY (JWT + master em TODOS os métodos)
# ============================================
_master_protected = [
    despesas_bp,
    expenses_analytics_bp,
    financial_bp,
    financial_analytics_bp,
    staff_admin_bp,
]

for _bp in _master_protected:
    require_master_for_all(_bp)


# ============================================
# Blueprints que exigem JWT em escrita
# ============================================
_write_protected = [
    # Pacientes
    pacientes_bp,
    patient_reports_api_bp,
    patient_reports_pdf_bp,
    nfse_import_bp,
    # Profissionais
    medicos_bp,
    assistentes_sociais_bp,
    # Estoque / Farmácia
    fornecedores_bp,
    medicamentos_bp,
    estoque_bp,
    # Receituários
    receituarios_bp,
    receituario_pdf_bp,
    # Empresas e Convênios
    empresas_bp,
    empresa_setores_bp,
    empresa_cargos_bp,
    faturamento_posterior_bp,
    faturamento_posterior_pdf_bp,
    vinculos_bp,
    convenios_bp,
    # Financeiro
    pagamentos_bp,
    # Exames
    exames_bp,
    exames_clinica_bp,
    solicitacoes_exames_bp,
    # Consultas e Prontuários
    consultas_bp,
    prontuarios_bp,
    prontuario_pdf_bp,
    procedimentos_bp,
    # Pericias do imesc
    pericias_imesc_bp,
    pericia_imesc_pdf_bp,
    # Agendamentos
    agendamentos_bp,
    agendamento_comprovante_bp,
    feriados_bp,
    # ASO
    aso_bp,
    aso_questionarios_bp,
    aso_questionario_pdf_bp,
    # Utilitários com escrita
    dashboard_bp,
    autocomplete_bp,
    reports_async_bp,
    # Auditoria (GETs protegidos por @require_permission)
    audit_logs_bp,
]

for _bp in _write_protected:
    require_jwt_for_writes(_bp)


# ============================================
# Blueprints SEM JWT guard
# ============================================
_unprotected = [
    auth_bp,
    health_bp,
    cep_bp,
    devtools_bp,
    devtools_auth_bp,
    dev_admin_bp,
    staff_admin_view_bp,
    google_forms_webhook_bp,
    documentos_livres_view_bp,
    documentos_livres_bp,
]


# ============================================
# Lista final exportada (ordem de registro)
# ============================================
blueprints = _master_protected + _write_protected + _unprotected
