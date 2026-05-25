"""
Constantes e enumerações do sistema de autenticação.

Define:
- Tipos de staff
- Permissões disponíveis
- Perfis padrão do sistema
- Configurações de segurança
"""

from __future__ import annotations

from enum import Enum
from typing import Final


class StaffType(str, Enum):
    """Tipos de funcionários do sistema."""

    MEDICO = "medico"
    ENFERMEIRO = "enfermeiro"
    ATENDENTE = "atendente"
    ADMIN = "admin"
    DESENVOLVEDOR = "desenvolvedor"
    ASSISTENTE_SOCIAL = "assistente_social"
    FINANCEIRO = "financeiro"
    OUTRO = "outro"


class AuditAction(str, Enum):
    """Ações auditáveis do sistema."""

    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_RESET = "password_reset"
    TOKEN_REFRESH = "token_refresh"
    SESSION_REVOKE = "session_revoke"

    STAFF_CREATE = "staff_create"
    STAFF_UPDATE = "staff_update"
    STAFF_DELETE = "staff_delete"
    STAFF_PERMISSION_GRANT = "staff_permission_grant"
    STAFF_PERMISSION_REVOKE = "staff_permission_revoke"

    ROLE_CREATE = "role_create"
    ROLE_UPDATE = "role_update"
    ROLE_DELETE = "role_delete"
    ROLE_PERMISSION_UPDATE = "role_permission_update"


# ============================================
# Permissões do Sistema
# ============================================
# Formato: {modulo}.{acao}
# Ações padrão: ver, criar, editar, deletar

PERMISSIONS: Final[dict[str, str]] = {
    # --- Pacientes ---
    "pacientes.ver": "Visualizar pacientes",
    "pacientes.criar": "Criar pacientes",
    "pacientes.editar": "Editar pacientes",
    "pacientes.deletar": "Deletar pacientes",
    "pacientes.exportar": "Exportar dados de pacientes",
    # --- Médicos ---
    "medicos.ver": "Visualizar médicos",
    "medicos.criar": "Criar médicos",
    "medicos.editar": "Editar médicos",
    "medicos.deletar": "Deletar médicos",
    # --- Enfermeiros ---
    "enfermeiros.ver": "Visualizar enfermeiros",
    "enfermeiros.criar": "Criar enfermeiros",
    "enfermeiros.editar": "Editar enfermeiros",
    "enfermeiros.deletar": "Deletar enfermeiros",
    # --- Consultas ---
    "consultas.ver": "Visualizar consultas",
    "consultas.criar": "Agendar consultas",
    "consultas.editar": "Editar consultas",
    "consultas.deletar": "Cancelar consultas",
    # --- Exames ---
    "exames.ver": "Visualizar exames",
    "exames.criar": "Solicitar exames",
    "exames.editar": "Editar exames",
    "exames.deletar": "Cancelar exames",
    "exames.laudar": "Emitir laudos de exames",
    # --- Financeiro ---
    "financeiro.ver": "Visualizar financeiro",
    "financeiro.criar": "Criar lançamentos financeiros",
    "financeiro.editar": "Editar lançamentos financeiros",
    "financeiro.deletar": "Deletar lançamentos financeiros",
    "financeiro.relatorios": "Gerar relatórios financeiros",
    # --- Prontuários ---
    "prontuarios.ver": "Visualizar prontuários",
    "prontuarios.criar": "Criar prontuários",
    "prontuarios.editar": "Editar prontuários",
    # --- Agendamentos ---
    "agendamentos.ver": "Visualizar agenda",
    "agendamentos.criar": "Criar agendamentos",
    "agendamentos.editar": "Editar agendamentos",
    "agendamentos.deletar": "Cancelar agendamentos",
    # --- Empresas ---
    "empresas.ver": "Visualizar empresas",
    "empresas.criar": "Criar empresas",
    "empresas.editar": "Editar empresas",
    "empresas.deletar": "Deletar empresas",
    # --- Convênios ---
    "convenios.ver": "Visualizar convênios",
    "convenios.criar": "Criar convênios",
    "convenios.editar": "Editar convênios",
    "convenios.deletar": "Deletar convênios",
    # --- Pagamentos ---
    "pagamentos.ver": "Visualizar pagamentos",
    "pagamentos.criar": "Registrar pagamentos",
    "pagamentos.editar": "Editar pagamentos",
    "pagamentos.deletar": "Estornar pagamentos",
    # --- ASO ---
    "aso.ver": "Visualizar ASO",
    "aso.criar": "Emitir ASO",
    "aso.editar": "Editar ASO",
    "aso.deletar": "Cancelar ASO",
    # --- Procedimentos ---
    "procedimentos.ver": "Visualizar procedimentos",
    "procedimentos.criar": "Criar procedimentos",
    "procedimentos.editar": "Editar procedimentos",
    "procedimentos.deletar": "Deletar procedimentos",
    # --- Relatórios ---
    "relatorios.pacientes": "Relatórios de pacientes",
    "relatorios.financeiro": "Relatórios financeiros",
    "relatorios.producao": "Relatórios de produção",
    "relatorios.dashboard": "Acessar dashboard",
    # --- Administração ---
    "admin.staff": "Gerenciar funcionários",
    "admin.roles": "Gerenciar perfis de acesso",
    "admin.permissions": "Gerenciar permissões",
    "admin.audit": "Visualizar logs de auditoria",
    "admin.sistema": "Configurações do sistema",
}


# ============================================
# Perfis Padrão (Seeds)
# ============================================
# hierarchy_level: Quanto maior, mais privilégios
# is_system: True = não pode ser deletado

DEFAULT_ROLES: Final[dict[str, dict]] = {
    "master": {
        "name": "Master",
        "description": "Acesso total ao sistema - controle absoluto",
        "hierarchy_level": 100,
        "is_system": True,
        "permissions": ["*"],  # Wildcard = todas as permissões
    },
    "desenvolvedor": {
        "name": "Desenvolvedor",
        "description": "Desenvolvedor do sistema - acesso para manutenção",
        "hierarchy_level": 95,
        "is_system": True,
        "permissions": ["*"],
    },
    "admin": {
        "name": "Administrador",
        "description": "Administrador da clínica",
        "hierarchy_level": 90,
        "is_system": True,
        "permissions": [
            "pacientes.*",
            "medicos.*",
            "enfermeiros.*",
            "consultas.*",
            "exames.*",
            "financeiro.*",
            "prontuarios.*",
            "agendamentos.*",
            "empresas.*",
            "convenios.*",
            "pagamentos.*",
            "aso.*",
            "procedimentos.*",
            "relatorios.*",
            "admin.staff",
        ],
    },
    "medico": {
        "name": "Médico",
        "description": "Médico - atendimento e prontuários",
        "hierarchy_level": 50,
        "is_system": True,
        "permissions": [
            "pacientes.ver",
            "pacientes.editar",
            "consultas.*",
            "exames.*",
            "prontuarios.*",
            "agendamentos.ver",
            "aso.*",
            "procedimentos.*",
        ],
    },
    "enfermeiro": {
        "name": "Enfermeiro",
        "description": "Enfermeiro - suporte ao atendimento",
        "hierarchy_level": 40,
        "is_system": True,
        "permissions": [
            "pacientes.ver",
            "consultas.ver",
            "exames.ver",
            "exames.criar",
            "prontuarios.ver",
            "agendamentos.ver",
            "procedimentos.ver",
            "procedimentos.criar",
        ],
    },
    "atendente": {
        "name": "Atendente",
        "description": "Atendente/Recepcionista",
        "hierarchy_level": 30,
        "is_system": True,
        "permissions": [
            "pacientes.*",
            "agendamentos.*",
            "consultas.ver",
            "consultas.criar",
            "exames.ver",
            "empresas.ver",
            "convenios.ver",
            "pagamentos.ver",
            "pagamentos.criar",
        ],
    },
    "assistente_social": {
        "name": "Assistente Social",
        "description": "Assistente Social",
        "hierarchy_level": 35,
        "is_system": True,
        "permissions": [
            "pacientes.ver",
            "pacientes.editar",
            "consultas.ver",
            "agendamentos.ver",
        ],
    },
    "financeiro": {
        "name": "Financeiro",
        "description": "Setor Financeiro",
        "hierarchy_level": 45,
        "is_system": True,
        "permissions": [
            "financeiro.*",
            "pagamentos.*",
            "relatorios.financeiro",
            "pacientes.ver",
            "empresas.*",
            "convenios.*",
        ],
    },
}


# ============================================
# Configurações de Segurança
# ============================================
PASSWORD_MIN_LENGTH: Final[int] = 12
PASSWORD_MAX_LENGTH: Final[int] = 128
PASSWORD_REQUIRE_UPPERCASE: Final[bool] = True
PASSWORD_REQUIRE_LOWERCASE: Final[bool] = True
PASSWORD_REQUIRE_DIGIT: Final[bool] = True
PASSWORD_REQUIRE_SPECIAL: Final[bool] = False

MAX_LOGIN_ATTEMPTS: Final[int] = 5
LOGIN_LOCKOUT_MINUTES: Final[int] = 15

# Duração dos tokens (em segundos)
ACCESS_TOKEN_EXPIRES: Final[int] = 900  # 15 minutos
REFRESH_TOKEN_EXPIRES: Final[int] = 604800  # 7 dias

# Redis keys prefixes
REDIS_BLOCKLIST_PREFIX: Final[str] = "jwt:blocklist:"
REDIS_SESSION_PREFIX: Final[str] = "jwt:session:"
REDIS_LOGIN_ATTEMPTS_PREFIX: Final[str] = "auth:attempts:"


def get_permission_modules() -> list[str]:
    """Retorna lista de módulos únicos das permissões."""
    modules = set()
    for code in PERMISSIONS:
        module = code.split(".")[0]
        modules.add(module)
    return sorted(modules)


def get_permissions_by_module(module: str) -> dict[str, str]:
    """Retorna permissões filtradas por módulo."""
    return {
        code: desc
        for code, desc in PERMISSIONS.items()
        if code.startswith(f"{module}.")
    }


def expand_permission_wildcards(permissions: list[str]) -> set[str]:
    """
    Expande wildcards em permissões.

    Exemplos:
        ["*"] -> todas as permissões
        ["pacientes.*"] -> todas as permissões de pacientes
        ["pacientes.ver", "medicos.*"] -> pacientes.ver + todas de médicos
    """
    expanded = set()

    for perm in permissions:
        if perm == "*":
            # Todas as permissões
            expanded.update(PERMISSIONS.keys())
        elif perm.endswith(".*"):
            # Todas as permissões do módulo
            module = perm[:-2]  # Remove ".*"
            expanded.update(get_permissions_by_module(module).keys())
        else:
            # Permissão específica
            if perm in PERMISSIONS:
                expanded.add(perm)

    return expanded
