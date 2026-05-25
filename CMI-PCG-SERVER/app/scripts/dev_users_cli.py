"""
CLI de criação de usuários de teste (ROLLBACK LEGADO)

O projeto está em modo legacy-only:
- Não existe Staff/Role
- Login é via tabela `autenticadores`

Mantemos stub para compatibilidade.
"""

from __future__ import annotations

import click


@click.command("dev-users")
def dev_users_command():
    click.echo("⚠️  dev-users-cli está desabilitado no modo legacy-only.")
    click.echo("Use a tabela `autenticadores` (SQL) ou crie um script legado específico.")


def register_cli(app):
    app.cli.add_command(dev_users_command)


if __name__ == "__main__":
    dev_users_command()
