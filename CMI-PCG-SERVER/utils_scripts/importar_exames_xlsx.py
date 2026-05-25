#!/usr/bin/env python3
"""Importa/atualiza exames no CMI-PCG diretamente no PostgreSQL.

Uso:
    python importar_exames_xlsx.py [--irpp ARQUIVO] [--unilab ARQUIVO] [--dry-run]

Credenciais lidas do .env (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
import psycopg2
import psycopg2.extras

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
PLANILHAS_DIR = SCRIPT_DIR.parent / "planilhas"
ROOT_DIR = SCRIPT_DIR.parent

TIPO_IMAGEM = "IMAGEM"
TIPO_LABORATORIAL = "LABORATORIAL"
SEP = "=" * 60


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------
def _to_float(value) -> float:
    try:
        return float(str(value).replace(",", "."))
    except (ValueError, TypeError):
        return 0.0


def _carregar_env() -> dict[str, str]:
    candidates = [ROOT_DIR / ".env", Path(".env")]
    for path in candidates:
        resolved = path.resolve()
        if not resolved.exists():
            continue
        env: dict[str, str] = {}
        for line in resolved.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                env[key.strip()] = val.strip()
        return env
    return {}


def _resolve_xlsx(arg: Optional[str], glob_pattern: str) -> Optional[Path]:
    if arg:
        path = Path(arg)
        if not path.exists():
            print(f"[ERRO] Arquivo não encontrado: {arg}")
            sys.exit(1)
        return path
    for base in [PLANILHAS_DIR, Path(".")]:
        found = sorted(base.glob(glob_pattern))
        if found:
            return found[-1]
    return None


# ---------------------------------------------------------------------------
# Banco
# ---------------------------------------------------------------------------
def _conectar(env: dict[str, str]):
    return psycopg2.connect(
        host=env.get("POSTGRES_HOST", "db"),
        port=int(env.get("POSTGRES_PORT", 5432)),
        dbname=env.get("POSTGRES_DB", "clinicacmi"),
        user=env.get("POSTGRES_USER", "postgres"),
        password=env.get("POSTGRES_PASSWORD", ""),
    )


def _carregar_existentes(cur, tipo: str) -> dict[str, int]:
    """Retorna {NOME_UPPER: id} para todos os exames do tipo."""
    cur.execute(
        "SELECT id, upper(trim(nome)) FROM exames WHERE upper(tipo) = %s",
        (tipo.upper(),),
    )
    return {nome: eid for eid, nome in cur.fetchall()}


def _processar(
    cur,
    exames: list[dict],
    dry_run: bool,
    label: str,
) -> None:
    tipo = exames[0]["tipo"] if exames else ""
    existentes = _carregar_existentes(cur, tipo)
    total = len(exames)
    criados = atualizados = erros = 0

    for i, ex in enumerate(exames, 1):
        nome = ex["nome"]
        exame_id = existentes.get(nome)
        print(f"  [{i:3}/{total}] {nome[:60]:<60}", end=" ... ", flush=True)

        try:
            if exame_id:
                if not dry_run:
                    cur.execute(
                        """
                        UPDATE exames SET
                            valor_venda    = %s,
                            valor_parceiro = %s,
                            valor_cmi      = %s,
                            codigo_parceiro = COALESCE(%s, codigo_parceiro),
                            updated_at     = now()
                        WHERE id = %s
                        """,
                        (
                            ex["valor_venda"],
                            ex["valor_parceiro"],
                            ex["valor_cmi"],
                            ex.get("codigo_parceiro"),
                            exame_id,
                        ),
                    )
                print("DRY-RUN (ATUALIZADO)" if dry_run else "ATUALIZADO")
                atualizados += 1
            else:
                if not dry_run:
                    cur.execute(
                        """
                        INSERT INTO exames
                            (nome, tipo, valor_venda, valor_parceiro, valor_cmi,
                             codigo_parceiro, ativo, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, true, now(), now())
                        """,
                        (
                            nome,
                            ex["tipo"],
                            ex["valor_venda"],
                            ex["valor_parceiro"],
                            ex["valor_cmi"],
                            ex.get("codigo_parceiro"),
                        ),
                    )
                print("DRY-RUN (CRIADO)" if dry_run else "CRIADO")
                criados += 1

        except psycopg2.Error as exc:
            print(f"ERRO: {exc}")
            erros += 1

    print(
        f"\n  [{label}] Criados: {criados} | Atualizados: {atualizados} | Erros: {erros}"
    )


# ---------------------------------------------------------------------------
# Parsers de planilha
# ---------------------------------------------------------------------------
def _linhas_validas(path: Path, sheet: str) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=sheet, header=None)
    mask = pd.to_numeric(df[0], errors="coerce").notna()
    return df[mask].copy()


def _parse_irpp(path: Path) -> list[dict]:
    """sheet 'IRPP VENDA': col0=QTDE | col1=NOME | col2=VALOR_VENDA"""
    exames = []
    for _, row in _linhas_validas(path, "IRPP VENDA").iterrows():
        nome = str(row[1]).strip().upper()
        if not nome or nome == "NAN":
            continue
        valor = _to_float(row[2])
        exames.append(
            {
                "nome": nome,
                "tipo": TIPO_IMAGEM,
                "valor_venda": valor,
                "valor_parceiro": valor,
                "valor_cmi": 0.0,
            }
        )
    return exames


def _parse_unilab(path: Path) -> list[dict]:
    """sheet 'UNILAB - RELATÓRIO VENDAS': col0=QTDE | col1=MNEMÔNICO | col2=PROCEDIMENTO | col3=CUSTO | col4=VENDA"""
    exames = []
    for _, row in _linhas_validas(path, "UNILAB - RELATÓRIO VENDAS").iterrows():
        nome = str(row[2]).strip().upper() if pd.notna(row[2]) else ""
        if not nome or nome == "NAN":
            continue
        mnemonico = str(row[1]).strip().upper() if pd.notna(row[1]) else ""
        custo = _to_float(row[3]) if pd.notna(row[3]) else 0.0
        venda = _to_float(row[4]) if pd.notna(row[4]) else 0.0
        payload: dict = {
            "nome": nome,
            "tipo": TIPO_LABORATORIAL,
            "valor_parceiro": custo,
            "valor_venda": venda,
            "valor_cmi": custo,
        }
        if mnemonico and mnemonico != "NAN":
            payload["codigo_parceiro"] = mnemonico
        exames.append(payload)
    return exames


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Importa/atualiza exames IRPP e UNILAB direto no PostgreSQL."
    )
    parser.add_argument("--irpp", default=None, help="Planilha IRPP (.xlsx)")
    parser.add_argument("--unilab", default=None, help="Planilha UNILAB (.xlsx)")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar")
    args = parser.parse_args()

    irpp_path = _resolve_xlsx(args.irpp, "IRPP*.xlsx")
    unilab_path = _resolve_xlsx(args.unilab, "UNILAB*.xlsx")

    if not irpp_path and not unilab_path:
        print(f"[ERRO] Nenhuma planilha encontrada em {PLANILHAS_DIR}")
        sys.exit(1)

    env = _carregar_env()

    try:
        conn = _conectar(env)
    except psycopg2.OperationalError as exc:
        print(f"[ERRO] Falha ao conectar no PostgreSQL: {exc}")
        sys.exit(1)

    print(
        f"[INFO] Conectado em {env.get('POSTGRES_HOST', 'db')}:{env.get('POSTGRES_DB', 'clinicacmi')}"
    )
    if args.dry_run:
        print("[INFO] DRY-RUN — nenhum dado será gravado")

    with conn:
        with conn.cursor() as cur:
            for path, parser_fn, label in [
                (irpp_path, _parse_irpp, "IRPP"),
                (unilab_path, _parse_unilab, "UNILAB"),
            ]:
                if not path:
                    continue
                print(f"\n{SEP}\n[{label}] {path.name}")
                exames = parser_fn(path)
                print(f"[{label}] {len(exames)} exames na planilha")
                _processar(cur, exames, args.dry_run, label)

            if args.dry_run:
                conn.rollback()

    conn.close()
    print(f"\n{SEP}\n[INFO] Concluído.")


if __name__ == "__main__":
    main()
