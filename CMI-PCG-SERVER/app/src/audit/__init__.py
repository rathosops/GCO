"""
Módulo de Audit Trail (LEGACY-SAFE).

Rastreia automaticamente INSERT/UPDATE/DELETE em models marcados
com AuditableMixin e persiste na tabela audit_logs.

Funciona com:
- Autenticadores (legado)
- Staff (auth novo, quando ativado)

Fallback: se o INSERT no banco falhar, loga em stdout.
"""

from __future__ import annotations

from app.src.audit.listeners import init_audit_listeners
from app.src.audit.mixin import AuditableMixin

__all__ = ["AuditableMixin", "init_audit_listeners"]