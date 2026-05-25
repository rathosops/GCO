"""
Modelo AuditLog - Log de auditoria (LEGACY-SAFE).

Registra todas as ações de escrita (INSERT/UPDATE/DELETE) no sistema.

IMPORTANTE:
- Sem ForeignKey para staff/autenticadores (funciona com ambos).
- Campos user_id, user_nome, user_type gravados diretamente (desnormalizados).
- Imutável após criação — não possui update.
- NÃO usa AuditableMixin (evita recursão infinita nos listeners).

to_dict() normaliza AMBOS os formatos:
- Novo (v2): details.fields = [{field, label, value}, ...]
- Antigo (v1): details.data = {campo: valor, ...} → convertido para v2
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import JSONB

from app.database import db


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _field_label(key: str) -> str:
    """Label legível para campo (fallback quando não vem do listener v2)."""
    return key.replace("_", " ").capitalize()


def _normalize_fields(raw) -> list[dict] | None:
    """
    Normaliza campos para o formato [{field, label, value}, ...].

    Aceita:
    - list[dict] (v2, já normalizado) → retorna direto
    - dict (v1, formato antigo) → converte para lista
    - None → retorna None
    """
    if raw is None:
        return None

    # v2: já é lista de {field, label, value}
    if isinstance(raw, list):
        return raw

    # v1: dict plano {campo: valor} → converter
    if isinstance(raw, dict):
        return [
            {"field": k, "label": _field_label(k), "value": v}
            for k, v in raw.items()
            if v is not None
        ]

    return None


def _normalize_changes(raw) -> dict | None:
    """
    Normaliza changes para o formato {campo: {old, new, label}}.

    Aceita:
    - dict com label (v2) → retorna direto
    - dict sem label (v1) → adiciona label gerado
    - None → retorna None
    """
    if not raw or not isinstance(raw, dict):
        return None

    result = {}
    for key, change in raw.items():
        if not isinstance(change, dict):
            continue
        result[key] = {
            "old": change.get("old"),
            "new": change.get("new"),
            "label": change.get("label") or _field_label(key),
        }

    return result if result else None


class AuditLog(db.Model):
    """Log de auditoria para ações de escrita no sistema."""

    __tablename__ = "audit_logs"

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)

    # ── Quem ─────────────────────────────────────────────────────────
    user_id = db.Column(db.BigInteger, nullable=True, index=True)
    user_nome = db.Column(db.String(255), nullable=True)
    user_type = db.Column(db.String(50), nullable=True)

    # ── O quê ────────────────────────────────────────────────────────
    action = db.Column(db.String(50), nullable=False, index=True)
    resource = db.Column(db.String(100), nullable=False, index=True)
    resource_id = db.Column(db.String(50), nullable=True)

    # ── Contexto ─────────────────────────────────────────────────────
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)

    # ── Detalhes (JSONB flexível) ────────────────────────────────────
    details = db.Column(JSONB, nullable=False, default=dict)

    # ── Timestamp ────────────────────────────────────────────────────
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
        index=True,
    )

    __table_args__ = (
        db.Index("ix_audit_logs_resource_action", "resource", "action"),
        db.Index("ix_audit_logs_user_created", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.resource} by user={self.user_id}>"

    def to_dict(self, *, compact: bool = False) -> dict:
        """
        Serializa para resposta da API.

        Normaliza AMBOS os formatos de details (v1 antigo e v2 novo):
        - v2: details tem summary, fields, changes, deleted_fields
        - v1: details tem data (dict), changes (dict sem label), deleted_data (dict)

        Args:
            compact: Se True, retorna apenas summary sem details completo.
        """
        details = self.details or {}

        # Extrai campos v2 (ou gera fallback para v1)
        summary = details.get("summary")
        resource_label = details.get("resource_label", self.resource)
        display_name = details.get("display_name")

        base = {
            "id": self.id,
            "user_id": self.user_id,
            "user_nome": self.user_nome,
            "user_type": self.user_type,
            "action": self.action,
            "resource": self.resource,
            "resource_id": self.resource_id,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "summary": summary,
            "resource_label": resource_label,
            "display_name": display_name,
        }

        if compact:
            return base

        # ── Detalhes completos por tipo de ação ──────────────────────
        # Normaliza para o formato v2 independente do formato original

        if self.action == "create":
            # v2: details.fields (list) | v1: details.data (dict)
            raw_fields = details.get("fields") or details.get("data")
            base["fields"] = _normalize_fields(raw_fields)

        elif self.action == "update":
            raw_changes = details.get("changes")
            base["changes"] = _normalize_changes(raw_changes)

        elif self.action == "delete":
            # v2: details.deleted_fields (list) | v1: details.deleted_data (dict)
            raw_fields = details.get("deleted_fields") or details.get("deleted_data")
            base["fields"] = _normalize_fields(raw_fields)
            # Frontend usa deleted_fields para delete
            base["deleted_fields"] = base["fields"]

        # Raw para debug/JSON tab
        base["details_raw"] = details

        return base

    def to_compact_dict(self) -> dict:
        """Atalho para serialização compacta."""
        return self.to_dict(compact=True)

    # ── Class methods ────────────────────────────────────────────────

    @classmethod
    def get_by_user(cls, user_id: int, limit: int = 100, offset: int = 0):
        return (
            cls.query.filter_by(user_id=user_id)
            .order_by(cls.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    @classmethod
    def get_by_resource(
        cls,
        resource: str,
        resource_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ):
        query = cls.query.filter_by(resource=resource)
        if resource_id is not None:
            query = query.filter_by(resource_id=str(resource_id))
        return query.order_by(cls.created_at.desc()).offset(offset).limit(limit).all()

    @classmethod
    def get_recent(cls, limit: int = 100):
        return cls.query.order_by(cls.created_at.desc()).limit(limit).all()

    @classmethod
    def get_resource_history(cls, resource: str, resource_id: str, limit: int = 50):
        """Timeline completa de um recurso específico."""
        return (
            cls.query.filter_by(resource=resource, resource_id=str(resource_id))
            .order_by(cls.created_at.desc())
            .limit(limit)
            .all()
        )
