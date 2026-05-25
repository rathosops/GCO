# app/scripts/seed_auth.py
"""
CLI de Autenticação — Comandos para gestão de usuários.

Comandos:
    flask auth create-admin    → Cria usuário admin/master
    flask auth list-users      → Lista todos os autenticadores
    flask auth promote         → Promove usuário para admin
    flask auth reset-password  → Reseta senha de um usuário
    flask auth check           → Mostra detalhes de um usuário (debug)

Uso:
    docker exec -it cmi-pcg-server-app flask auth list-users
    docker exec -it cmi-pcg-server-app flask auth create-admin
"""

from __future__ import annotations

import click
from flask import Flask
from flask.cli import AppGroup

from app.database import db
from app.models.auth_model import Autenticadores


auth_cli = AppGroup("auth", help="Gestão de autenticação e usuários.")


# ── Tipos válidos ────────────────────────────────────────────────────────

TIPOS_VALIDOS = ("admin", "medico", "atendente", "enfermeiro", "financeiro")


def _hash_password(password: str) -> str:
    """Hash com argon2 se disponível, senão plaintext (dev)."""
    try:
        from app.src.auth.utils import hash_password

        return hash_password(password)
    except Exception:
        click.echo("⚠  argon2 indisponível, salvando como plaintext.")
        return password


def _print_user(user: Autenticadores) -> None:
    """Imprime detalhes de um usuário."""
    master = "★ MASTER" if user.is_master else ""
    click.echo(f"  ID={user.id}  usuario={user.usuario}  tipo={user.tipo}  {master}")


# ── create-admin ─────────────────────────────────────────────────────────


@auth_cli.command("create-admin")
@click.option("--usuario", prompt="Usuário (login)", help="Identificador de login")
@click.option(
    "--senha",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
    help="Senha do admin",
)
def create_admin(usuario: str, senha: str):
    """Cria um novo usuário admin (master)."""
    usuario = usuario.strip().lower()

    if len(senha) < 4:
        click.echo("✗ Senha muito curta (mín. 4 caracteres).")
        return

    existing = Autenticadores.query.filter(
        db.func.lower(Autenticadores.usuario) == usuario
    ).first()

    if existing:
        click.echo(
            f"✗ Usuário '{usuario}' já existe (ID={existing.id}, tipo={existing.tipo})."
        )
        if existing.tipo != "admin":
            if click.confirm(f"  Promover para admin?"):
                existing.tipo = "admin"
                db.session.commit()
                click.echo(f"✓ Promovido para admin.")
        return

    novo = Autenticadores(
        usuario=usuario,
        senha=_hash_password(senha),
        tipo="admin",
    )
    db.session.add(novo)
    db.session.commit()

    click.echo(f"✓ Admin criado: ID={novo.id}  usuario={novo.usuario}")


# ── list-users ───────────────────────────────────────────────────────────


@auth_cli.command("list-users")
@click.option("--tipo", default=None, help="Filtrar por tipo")
def list_users(tipo: str | None):
    """Lista todos os usuários do sistema."""
    query = Autenticadores.query.order_by(Autenticadores.tipo, Autenticadores.usuario)

    if tipo:
        query = query.filter(Autenticadores.tipo == tipo.strip().lower())

    users = query.all()

    if not users:
        click.echo("Nenhum usuário encontrado.")
        return

    click.echo(f"\n{'='*60}")
    click.echo(f"  Usuários ({len(users)} total)")
    click.echo(f"{'='*60}")

    current_tipo = None
    for user in users:
        if user.tipo != current_tipo:
            current_tipo = user.tipo
            label = "★ ADMIN" if current_tipo == "admin" else current_tipo.upper()
            click.echo(f"\n  [{label}]")

        master = " ★" if user.is_master else ""
        click.echo(f"    #{user.id:<4}  {user.usuario}{master}")

    click.echo(f"\n{'='*60}\n")


# ── promote ──────────────────────────────────────────────────────────────


@auth_cli.command("promote")
@click.option("--usuario", prompt="Usuário a promover", help="Identificador do usuário")
@click.option(
    "--tipo",
    prompt="Novo tipo",
    type=click.Choice(TIPOS_VALIDOS, case_sensitive=False),
    help="Novo tipo do usuário",
)
def promote(usuario: str, tipo: str):
    """Altera o tipo/nível de acesso de um usuário."""
    user = Autenticadores.query.filter(
        db.func.lower(Autenticadores.usuario) == usuario.strip().lower()
    ).first()

    if not user:
        click.echo(f"✗ Usuário '{usuario}' não encontrado.")
        return

    old_tipo = user.tipo
    user.tipo = tipo.lower()
    db.session.commit()

    click.echo(f"✓ {user.usuario}: {old_tipo} → {user.tipo}")
    if user.is_master:
        click.echo("  ★ Agora é MASTER (acesso total).")


# ── reset-password ───────────────────────────────────────────────────────


@auth_cli.command("reset-password")
@click.option("--usuario", prompt="Usuário", help="Identificador do usuário")
@click.option(
    "--senha",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
    help="Nova senha",
)
def reset_password(usuario: str, senha: str):
    """Reseta a senha de um usuário."""
    user = Autenticadores.query.filter(
        db.func.lower(Autenticadores.usuario) == usuario.strip().lower()
    ).first()

    if not user:
        click.echo(f"✗ Usuário '{usuario}' não encontrado.")
        return

    if len(senha) < 4:
        click.echo("✗ Senha muito curta (mín. 4 caracteres).")
        return

    user.senha = _hash_password(senha)
    db.session.commit()

    click.echo(f"✓ Senha de '{user.usuario}' resetada.")


# ── check ────────────────────────────────────────────────────────────────


@auth_cli.command("check")
@click.option("--usuario", prompt="Usuário", help="Identificador do usuário")
def check_user(usuario: str):
    """Mostra detalhes completos de um usuário (debug)."""
    user = Autenticadores.query.filter(
        db.func.lower(Autenticadores.usuario) == usuario.strip().lower()
    ).first()

    if not user:
        click.echo(f"✗ Usuário '{usuario}' não encontrado.")
        return

    click.echo(f"\n{'='*60}")
    click.echo(f"  DEBUG: {user.usuario}")
    click.echo(f"{'='*60}")
    click.echo(f"  ID:           {user.id}")
    click.echo(f"  usuario:      {user.usuario}")
    click.echo(f"  tipo:         '{user.tipo}'")
    click.echo(f"  is_master:    {user.is_master}")
    click.echo(f"  is_active:    {user.is_active}")
    click.echo(f"  is_legacy:    {user._is_legacy}")

    # Check senha format
    senha = user.senha or ""
    if senha.startswith("$argon2"):
        click.echo(f"  senha_format: argon2 (hash)")
    else:
        click.echo(f"  senha_format: plaintext (INSEGURO)")

    click.echo(f"\n  Permissões ({len(user.get_all_permissions())}):")
    for perm in user.get_all_permissions()[:20]:
        click.echo(f"    • {perm}")
    if len(user.get_all_permissions()) > 20:
        click.echo(f"    ... e mais {len(user.get_all_permissions()) - 20}")

    # JWT identity
    click.echo(f"\n  JWT identity:")
    for k, v in user.to_jwt_identity().items():
        click.echo(f"    {k}: {v}")

    # to_dict check
    d = user.to_dict()
    click.echo(f"\n  to_dict().is_master = {d.get('is_master')}")
    click.echo(
        f"  to_dict().role.slug = {d.get('role', {}).get('slug') if d.get('role') else 'None'}"
    )
    click.echo(f"{'='*60}\n")


# ── create-user (genérico) ───────────────────────────────────────────────


@auth_cli.command("create-user")
@click.option("--usuario", prompt="Usuário (login)", help="Identificador de login")
@click.option(
    "--senha",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
    help="Senha",
)
@click.option(
    "--tipo",
    prompt="Tipo",
    type=click.Choice(TIPOS_VALIDOS, case_sensitive=False),
    help="Tipo do usuário",
)
def create_user(usuario: str, senha: str, tipo: str):
    """Cria um novo usuário com tipo especificado."""
    usuario = usuario.strip().lower()

    if len(senha) < 4:
        click.echo("✗ Senha muito curta (mín. 4 caracteres).")
        return

    existing = Autenticadores.query.filter(
        db.func.lower(Autenticadores.usuario) == usuario
    ).first()

    if existing:
        click.echo(f"✗ Usuário '{usuario}' já existe (ID={existing.id}).")
        return

    novo = Autenticadores(
        usuario=usuario,
        senha=_hash_password(senha),
        tipo=tipo.lower(),
    )
    db.session.add(novo)
    db.session.commit()

    master = " ★ MASTER" if novo.is_master else ""
    click.echo(
        f"✓ Criado: ID={novo.id}  usuario={novo.usuario}  tipo={novo.tipo}{master}"
    )


# ── Registro ─────────────────────────────────────────────────────────────


def register_cli(app: Flask) -> None:
    """Registra comandos CLI no app Flask."""
    app.cli.add_command(auth_cli)
