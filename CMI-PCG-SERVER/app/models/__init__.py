"""
Models Package - CMI-PCG Server

Exporta todos os modelos do sistema para facilitar imports.

IMPORTANTE: Os nomes aqui devem corresponder EXATAMENTE aos nomes das classes
definidas em cada arquivo de modelo.
"""

# Core models
from app.models.patients_model import Pacientes
from app.models.doctors_model import Medicos
from app.models.nurses_model import Enfermeiros
from app.models.attendants_model import Atendentes
from app.models.insurances_model import Convenios
from app.models.clinic_infos_model import ClinicaInfos

# Empresas
from app.models.companies_model import Empresas
from app.models.company_sectors_model import SetoresEmpresa
from app.models.company_positions_model import CargosEmpresa
from app.models.employee_bonds_model import VinculosEmpregado

# Appointments & Consultations
from app.models.appointments_model import Agendamentos
from app.models.medical_appointments_model import Consultas

# Exams
from app.models.exams_model import Exames
from app.models.clinic_exams_model import ExamesClinica
from app.models.exam_request_model import SolicitacoesDeExames

# ASO & Procedures
from app.models.aso_request_model import SolicitacoesDeAso
from app.models.procedures_model import Procedimentos
from app.models.aso_questionario_model import AsoQuestionario

# Payments & Risks
from app.models.payments_model import Pagamentos
from app.models.expenses_model import Despesas
from app.models.risks_model import Riscos

# Receitas médicas
from app.models.prescriptions_model import Receituarios
from app.models.prescription_items_model import ReceituarioItens

# Estoque / Farmácia
from app.models.suppliers_model import Fornecedores
from app.models.medications_model import Medicamentos
from app.models.medication_batches_model import MedicamentoLotes
from app.models.stock_movements_model import MovimentacoesEstoque

# Auditoria
from app.models.auth.audit_log_model import AuditLog

# ============================================
# Exports
# ============================================
__all__ = [
    # Core
    "Pacientes",
    "Medicos",
    "Enfermeiros",
    "Atendentes",
    # Empresas
    "Empresas",
    "SetoresEmpresa",
    "CargosEmpresa",
    "VinculosEmpregado",
    "Convenios",
    "ClinicaInfos",
    # Appointments
    "Agendamentos",
    "Consultas",
    # Exams
    "Exames",
    "ExamesClinica",
    "SolicitacoesDeExames",
    # ASO & Procedures
    "SolicitacoesDeAso",
    "Procedimentos",
    "AsoQuestionario",
    # Payments & Risks
    "Pagamentos",
    "Despesas",
    "Riscos",
    # Receitas Médicas
    "Receituarios",
    "ReceituarioItens",
    # Estoque / Farmácia
    "Fornecedores",
    "Medicamentos",
    "MedicamentoLotes",
    "MovimentacoesEstoque",
    # Auditoria
    "AuditLog",
]
