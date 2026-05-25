"""
Check DB (ROLLBACK LEGADO)

No modo legacy-only, este script não valida tabelas do auth novo.
Mantemos stub para compatibilidade.
"""

from __future__ import annotations


def run_check():
    print("⚠️  check_db está em modo legacy-only.")
    print("Não há validação de Staff/Role/Permission/RefreshToken/AuditLog.")
    print("Valide apenas tabelas do domínio e `autenticadores`.")


if __name__ == "__main__":
    run_check()
