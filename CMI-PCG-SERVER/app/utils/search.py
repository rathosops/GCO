"""
Utilitários de busca inteligente para PostgreSQL.

Combina:
- unaccent: tolerância a acentos (café → cafe)
- pg_trgm / similarity: tolerância a typos e ordem de palavras
- ilike com tokens: cada palavra do query vira um filtro independente
- Prioridade: correspondência exata > prefixo > trigrama

Regras:
- DRY: lógica centralizada, reutilizável por qualquer controller
- KISS: sem dependências externas, só SQLAlchemy + PostgreSQL nativo
- Zero regex frágil: normalização via unicodedata do Python
"""

from __future__ import annotations

import unicodedata
from typing import Any

from sqlalchemy import Float, and_, cast, func, or_
from sqlalchemy.sql.functions import ReturnTypeFromArgs


# ── Função SQL customizada ──────────────────────────────────────────────


class unaccent(ReturnTypeFromArgs):  # noqa: N801  (nome espelha função SQL)
    """Wrapper SQLAlchemy para a função unaccent do PostgreSQL."""


# ── Normalização Python-side ────────────────────────────────────────────


def normalize_query(value: Any) -> str:
    """
    Normaliza query de busca para comparação.

    - Remove acentos (NFD → filtra Mn)
    - Lowercase
    - Colapsa espaços
    - Preserva dígitos e caracteres especiais relevantes (-, /)
    """
    if not value:
        return ""
    nfd = unicodedata.normalize("NFD", str(value).strip())
    sem_acento = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return " ".join(sem_acento.lower().split())


def tokenize(query: str) -> list[str]:
    """
    Divide query em tokens significativos (mín. 1 char).

    Exemplos:
        "hemograma completo" → ["hemograma", "completo"]
        "TSH T4"             → ["tsh", "t4"]
        "EX001"              → ["ex001"]
    """
    normalized = normalize_query(query)
    return [t for t in normalized.split() if t]


# ── Construtor de filtros ────────────────────────────────────────────────


def build_smart_search_filter(
    columns: list,
    raw_query: str,
    *,
    similarity_threshold: float = 0.2,
) -> Any:
    """
    Constrói filtro SQLAlchemy de busca inteligente multi-coluna.

    Estratégia por token:
        1. unaccent(col) ILIKE '%token%'   → substring tolerante a acento
        2. similarity(unaccent(col), token) → fuzzy match para typos

    Todos os tokens devem dar match em pelo menos uma coluna (AND entre tokens,
    OR entre colunas).

    Args:
        columns: Lista de colunas SQLAlchemy a pesquisar.
        raw_query: Texto digitado pelo usuário.
        similarity_threshold: Limiar de similaridade trigrama (0–1).

    Returns:
        Filtro SQLAlchemy ou None se query vazia.
    """
    tokens = tokenize(raw_query)
    if not tokens:
        return None

    token_filters = []

    for token in tokens:
        like_pattern = f"%{token}%"
        col_filters = []

        for col in columns:
            col_unaccent = unaccent(col)
            # Substring tolerante a acento (usa índice GIN trgm)
            col_filters.append(col_unaccent.ilike(like_pattern))
            # Fuzzy para typos (ex: "hemograna" → "hemograma")
            col_filters.append(
                func.similarity(col_unaccent, token) >= similarity_threshold
            )

        token_filters.append(or_(*col_filters))

    return and_(*token_filters)


def build_relevance_score(
    primary_column,
    raw_query: str,
) -> Any:
    """
    Calcula score de relevância para ordenação.

    Prioridade (maior = mais relevante):
        3 — começa com a query (prefixo exato sem acento)
        2 — contém a query como substring
        1 — similaridade trigrama alta
        0 — baixa similaridade

    Args:
        primary_column: Coluna principal para ranking (geralmente nome).
        raw_query: Texto original do usuário.

    Returns:
        Expressão SQLAlchemy para uso em order_by().
    """
    normalized = normalize_query(raw_query)
    if not normalized:
        return func.similarity(unaccent(primary_column), "").desc()

    col_u = unaccent(primary_column)
    sim = cast(func.similarity(col_u, normalized), Float)

    # CASE WHEN para prioridade escalonada
    from sqlalchemy import case  # noqa: PLC0415

    score = case(
        (col_u.ilike(f"{normalized}%"), 3.0 + sim),  # prefixo exato
        (col_u.ilike(f"%{normalized}%"), 2.0 + sim),  # substring
        else_=sim,  # só similaridade
    )
    return score.desc()
