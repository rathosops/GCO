"""
Event listeners para audit trail automático (LEGACY-SAFE).

Persiste eventos de INSERT/UPDATE/DELETE na tabela audit_logs,
identificando o usuário autenticado (Autenticadores ou Staff).

Estratégia de gravação:
- Usa connection.execute() dentro do after_flush_postexec (mesma transação).
- Sem session separada — evita deadlocks e garante atomicidade.
- Se o INSERT falhar, loga em stdout como fallback (nunca quebra o flush).
- Rastreia objetos criados via session.info para evitar duplicação
  create+update causada pelo _set_audit_fields no before_flush.

Compatível com:
- Autenticadores (legado)
- Staff (auth novo, quando ativado)
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from flask import has_request_context, request
from sqlalchemy import event, inspect, text
from sqlalchemy.orm import Session

from app.database import db

if TYPE_CHECKING:
    from flask import Flask
    from sqlalchemy.orm import InstanceState

logger = logging.getLogger(__name__)


# =============================================================================
# Labels para detalhes legíveis
# =============================================================================

_RESOURCE_DISPLAY = {
    "pacientes": "Paciente",
    "medicos": "Médico",
    "consultas": "Consulta",
    "agendamentos": "Agendamento",
    "exames": "Exame",
    "exames_clinica": "Exame Clínico",
    "pagamentos": "Pagamento",
    "despesas": "Despesa",
    "empresas": "Empresa",
    "empresa_setores": "Setor",
    "empresa_cargos": "Cargo",
    "vinculos_empregaticios": "Vínculo",
    "convenios": "Convênio",
    "prontuarios": "Prontuário",
    "receituarios": "Receituário",
    "itens_receituario": "Item de Receituário",
    "medicamentos": "Medicamento",
    "lotes_medicamento": "Lote de Medicamento",
    "fornecedores": "Fornecedor",
    "estoque_movimentacoes": "Movimentação de Estoque",
    "pericias_imesc": "Perícia IMESC",
    "feriados": "Feriado",
    "procedimentos": "Procedimento",
    "solicitacoes_exames": "Solicitação de Exame",
    "aso_requests": "ASO",
    "assistentes_sociais": "Assistente Social",
}

# Campos que servem como "nome de exibição" do objeto (por prioridade)
_DISPLAY_NAME_FIELDS = (
    "nome_completo",
    "nome",
    "descricao",
    "titulo",
    "usuario",
    "razao_social",
    "nome_fantasia",
    "nome_comercial",
    "principio_ativo",
)

# Campos internos/técnicos que não agregam valor no detalhe
_HIDDEN_FIELDS = frozenset(
    {
        "id",
        "created_at",
        "updated_at",
        "created_by_id",
        "updated_by_id",
        "_sa_instance_state",
    }
)

# Labels legíveis para campos comuns
_FIELD_LABELS: dict[str, str] = {
    "nome": "Nome",
    "nome_completo": "Nome completo",
    "cpf": "CPF",
    "rg": "RG",
    "data_nascimento": "Data de nascimento",
    "sexo": "Sexo",
    "telefone": "Telefone",
    "celular": "Celular",
    "email": "E-mail",
    "endereco": "Endereço",
    "cep": "CEP",
    "bairro": "Bairro",
    "cidade": "Cidade",
    "uf": "UF",
    "observacoes": "Observações",
    "status": "Status",
    "ativo": "Ativo",
    "data_consulta": "Data da consulta",
    "hora_consulta": "Hora da consulta",
    "tipo": "Tipo",
    "valor": "Valor",
    "desconto": "Desconto",
    "valor_total": "Valor total",
    "forma_pagamento": "Forma de pagamento",
    "data_pagamento": "Data de pagamento",
    "descricao": "Descrição",
    "quantidade": "Quantidade",
    "razao_social": "Razão social",
    "nome_fantasia": "Nome fantasia",
    "cnpj": "CNPJ",
    "crm": "CRM",
    "especialidade": "Especialidade",
    "principio_ativo": "Princípio ativo",
    "nome_comercial": "Nome comercial",
    "apresentacao": "Apresentação",
    "classificacao_anvisa": "Classificação ANVISA",
    "validade": "Validade",
    "lote": "Lote",
    "motivo": "Motivo",
    "data_inicio": "Data de início",
    "data_fim": "Data de fim",
    "paciente_id": "Paciente (ID)",
    "medico_id": "Médico (ID)",
    "empresa_id": "Empresa (ID)",
    "convenio_id": "Convênio (ID)",
    "fornecedor_id": "Fornecedor (ID)",
    "paciente_compareceu": "Paciente compareceu",
    "data_agendamento": "Data do agendamento",
    "hora_agendamento": "Hora do agendamento",
}


def _field_label(field: str) -> str:
    """Retorna label legível para um campo, ou o próprio campo formatado."""
    if field in _FIELD_LABELS:
        return _FIELD_LABELS[field]
    return field.replace("_", " ").capitalize()


def _resource_label(table_name: str) -> str:
    """Label legível para o nome da tabela."""
    return _RESOURCE_DISPLAY.get(table_name, table_name.replace("_", " ").title())


def _get_display_name(obj: Any) -> str | None:
    """Extrai nome de exibição do objeto (primeiro campo disponível)."""
    for field in _DISPLAY_NAME_FIELDS:
        val = getattr(obj, field, None)
        if val:
            return str(val).strip()
    return None


def _build_summary(
    action: str, table_name: str, obj: Any = None, changes: dict | None = None
) -> str:
    """Monta frase-resumo legível da ação."""
    label = _resource_label(table_name)
    display = _get_display_name(obj) if obj else None

    if action == "create":
        return f'{label} "{display}" criado' if display else f"{label} criado"

    if action == "update":
        changed_fields = [_field_label(f) for f in (changes or {}).keys()]
        suffix = f": {', '.join(changed_fields[:5])}" if changed_fields else ""
        if len(changed_fields) > 5:
            suffix += f" (+{len(changed_fields) - 5})"
        return (
            f'{label} "{display}" atualizado{suffix}'
            if display
            else f"{label} atualizado{suffix}"
        )

    if action == "delete":
        return f'{label} "{display}" excluído' if display else f"{label} excluído"

    return f"{label} — {action}"


# =============================================================================
# Helpers para obter contexto do request
# =============================================================================


def _get_current_user_info() -> dict[str, Any]:
    """
    Obtém informações do usuário autenticado via JWT.

    Retorna dict com user_id, user_nome, user_type.
    Funciona com Autenticadores (legado) e Staff (auth novo).
    """
    default = {"user_id": None, "user_nome": None, "user_type": None}

    if not has_request_context():
        return default

    try:
        from flask_jwt_extended import current_user

        if not current_user:
            return default

        user_id = getattr(current_user, "id", None)

        # Autenticadores usa 'usuario' como nome, Staff usa 'nome'
        user_nome = getattr(current_user, "nome", None) or getattr(
            current_user, "usuario", None
        )

        # Autenticadores usa 'tipo', Staff usa 'staff_type'
        user_type = getattr(current_user, "staff_type", None) or getattr(
            current_user, "tipo", None
        )

        return {
            "user_id": int(user_id) if user_id is not None else None,
            "user_nome": str(user_nome) if user_nome else None,
            "user_type": str(user_type) if user_type else None,
        }
    except (ImportError, RuntimeError, ValueError, TypeError):
        return default


def _get_request_context() -> dict[str, Optional[str]]:
    """Extrai IP e User-Agent do request atual."""
    if not has_request_context():
        return {"ip_address": None, "user_agent": None}

    # IP real (respeita proxy headers)
    ip_address = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.headers.get("X-Real-IP")
        or request.remote_addr
    )

    user_agent = None
    if request.user_agent:
        user_agent = request.user_agent.string[:500]

    return {"ip_address": ip_address, "user_agent": user_agent}


# =============================================================================
# Serialização de valores para JSON
# =============================================================================


def _serialize_value(value: Any) -> Any:
    """Serializa valor para armazenamento em JSONB."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return "<binary>"
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


# =============================================================================
# Extração de dados do model
# =============================================================================

# Campos ignorados na detecção de mudanças
_IGNORED_FIELDS = frozenset(
    {
        "created_at",
        "updated_at",
        "created_by_id",
        "updated_by_id",
    }
)


def _get_model_changes(obj: Any) -> dict[str, dict[str, Any]]:
    """Extrai campos alterados de um objeto SQLAlchemy (para UPDATEs)."""
    state: InstanceState = inspect(obj)
    changes: dict[str, dict[str, Any]] = {}

    for attr in state.attrs:
        if attr.key in _IGNORED_FIELDS:
            continue

        hist = attr.history
        if not hist.has_changes():
            continue

        old_val = hist.deleted[0] if hist.deleted else None
        new_val = hist.added[0] if hist.added else None

        changes[attr.key] = {
            "old": _serialize_value(old_val),
            "new": _serialize_value(new_val),
            "label": _field_label(attr.key),
        }

    return changes


def _get_model_data(obj: Any) -> dict[str, Any]:
    """Extrai dados serializáveis, excluindo campos internos e relações."""
    state: InstanceState = inspect(obj)
    data: dict[str, Any] = {}

    for attr in state.attrs:
        key = attr.key
        if key.startswith("_") or key in _HIDDEN_FIELDS:
            continue

        try:
            value = getattr(obj, key, None)
            if hasattr(value, "__tablename__") or isinstance(value, list):
                continue
            data[key] = _serialize_value(value)
        except Exception:
            continue

    return data


def _get_model_data_labeled(obj: Any) -> list[dict[str, Any]]:
    """Retorna dados como lista de {field, label, value} para exibição."""
    raw = _get_model_data(obj)
    return [
        {"field": k, "label": _field_label(k), "value": v}
        for k, v in raw.items()
        if v is not None
    ]


def _get_primary_key(obj: Any) -> Optional[str]:
    """Obtém valor da primary key como string."""
    mapper = inspect(obj.__class__)
    pk_columns = mapper.primary_key
    if pk_columns:
        pk_value = getattr(obj, pk_columns[0].name, None)
        return str(pk_value) if pk_value is not None else None
    return None


def _get_table_name(obj: Any) -> str:
    """Obtém nome da tabela do objeto."""
    return getattr(obj, "__tablename__", obj.__class__.__name__.lower())


# =============================================================================
# Verificação de auditabilidade
# =============================================================================


def _should_audit(obj: Any) -> bool:
    """Verifica se o objeto deve ser auditado (possui AuditableMixin)."""
    from app.src.audit.mixin import AuditableMixin

    return isinstance(obj, AuditableMixin)


# =============================================================================
# Rastreamento anti-duplicação
# =============================================================================


def _get_seen_keys(session: Session) -> set:
    """Set de (action, table_name, pk) já capturados neste commit."""
    return session.info.setdefault("_audit_seen_keys", set())


# =============================================================================
# Persistência no banco
# =============================================================================

# SQL de INSERT direto (evita usar Session durante flush)
_INSERT_AUDIT_SQL = text(
    """
    INSERT INTO audit_logs
        (user_id, user_nome, user_type, action, resource, resource_id,
         ip_address, user_agent, details, created_at)
    VALUES
        (:user_id, :user_nome, :user_type, :action, :resource, :resource_id,
         :ip_address, :user_agent, :details, :created_at)
"""
)


def _persist_audit(
    connection,
    action: str,
    resource: str,
    resource_id: Optional[str],
    details: dict,
) -> None:
    """
    Grava registro de auditoria via connection.execute (mesma transação).

    Se falhar, loga em stdout como fallback — nunca quebra o flush.
    """
    user_info = _get_current_user_info()
    req_ctx = _get_request_context()

    params = {
        "user_id": user_info["user_id"],
        "user_nome": user_info["user_nome"],
        "user_type": user_info["user_type"],
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "ip_address": req_ctx["ip_address"],
        "user_agent": req_ctx["user_agent"],
        "details": json.dumps(details, ensure_ascii=False, default=str),
        "created_at": datetime.now(timezone.utc),
    }

    try:
        connection.execute(_INSERT_AUDIT_SQL, params)
    except Exception as exc:
        # Fallback: log em stdout (nunca quebra a operação principal)
        logger.warning(
            "Falha ao persistir audit log: %s | action=%s resource=%s id=%s",
            exc,
            action,
            resource,
            resource_id,
        )
        _fallback_log(action, resource, resource_id, params, details)


def _fallback_log(
    action: str,
    resource: str,
    resource_id: Optional[str],
    params: dict,
    details: dict,
) -> None:
    """Log em stdout como fallback quando o INSERT falha."""
    payload = {
        "audit_fallback": True,
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "user_id": params.get("user_id"),
        "user_nome": params.get("user_nome"),
        "details": details,
    }
    try:
        logger.info(json.dumps(payload, ensure_ascii=False, default=str))
    except Exception:
        logger.info(
            "audit_fallback action=%s resource=%s id=%s", action, resource, resource_id
        )


# =============================================================================
# Handlers de eventos
# =============================================================================


def _set_audit_fields(obj: Any, is_insert: bool = False) -> None:
    """Define created_by_id e updated_by_id no objeto."""
    user_info = _get_current_user_info()
    user_id = user_info["user_id"]

    if is_insert and hasattr(obj, "created_by_id"):
        if getattr(obj, "created_by_id", None) is None:
            try:
                obj.created_by_id = user_id
            except Exception:
                pass

    if hasattr(obj, "updated_by_id"):
        try:
            obj.updated_by_id = user_id
        except Exception:
            pass


def _on_before_flush(session: Session, flush_context: Any, instances: Any) -> None:
    """Antes do flush: preenche created_by_id e updated_by_id."""
    for obj in session.new:
        if _should_audit(obj):
            _set_audit_fields(obj, is_insert=True)

    for obj in session.dirty:
        if session.is_modified(obj) and _should_audit(obj):
            _set_audit_fields(obj, is_insert=False)


def _get_pending_events(session: Session) -> list[dict]:
    """Retorna lista de eventos pendentes (thread-safe via session.info)."""
    if "_audit_pending" not in session.info:
        session.info["_audit_pending"] = []
    return session.info["_audit_pending"]


def _on_after_flush(session: Session, flush_context: Any) -> None:
    """
    Após flush: acumula eventos de INSERT, UPDATE e DELETE.

    Camada 2: _audit_seen_keys garante que cada (action, resource, pk)
    só entre uma vez em pending por commit, mesmo que after_flush
    dispare múltiplas vezes.
    """
    pending = _get_pending_events(session)
    seen = _get_seen_keys(session)

    # ── INSERTs ──────────────────────────────────────────────────────
    for obj in session.new:
        if not _should_audit(obj):
            continue

        table_name = _get_table_name(obj)
        pk = _get_primary_key(obj)
        event_key = ("create", table_name, pk)

        if event_key in seen:
            continue
        seen.add(event_key)

        pending.append(
            {
                "action": "create",
                "resource": table_name,
                "resource_id": pk,
                "details": {
                    "summary": _build_summary("create", table_name, obj),
                    "resource_label": _resource_label(table_name),
                    "display_name": _get_display_name(obj),
                    "fields": _get_model_data_labeled(obj),
                },
            }
        )

    # ── UPDATEs ──────────────────────────────────────────────────────
    for obj in session.dirty:
        if not session.is_modified(obj) or not _should_audit(obj):
            continue

        table_name = _get_table_name(obj)
        pk = _get_primary_key(obj)

        # Criado neste commit → pula update espúrio do _set_audit_fields
        if ("create", table_name, pk) in seen:
            continue

        changes = _get_model_changes(obj)
        if not changes:
            continue

        event_key = ("update", table_name, pk)
        if event_key in seen:
            continue
        seen.add(event_key)

        pending.append(
            {
                "action": "update",
                "resource": table_name,
                "resource_id": pk,
                "details": {
                    "summary": _build_summary("update", table_name, obj, changes),
                    "resource_label": _resource_label(table_name),
                    "display_name": _get_display_name(obj),
                    "changes": changes,
                },
            }
        )

    # ── DELETEs ──────────────────────────────────────────────────────
    for obj in session.deleted:
        if not _should_audit(obj):
            continue

        table_name = _get_table_name(obj)
        pk = _get_primary_key(obj)
        event_key = ("delete", table_name, pk)

        if event_key in seen:
            continue
        seen.add(event_key)

        pending.append(
            {
                "action": "delete",
                "resource": table_name,
                "resource_id": pk,
                "details": {
                    "summary": _build_summary("delete", table_name, obj),
                    "resource_label": _resource_label(table_name),
                    "display_name": _get_display_name(obj),
                    "deleted_fields": _get_model_data_labeled(obj),
                },
            }
        )


def _on_after_flush_postexec(session: Session, flush_context: Any) -> None:
    """
    Após flush postexec: persiste eventos acumulados.

    Camada 3: dedup final por (action, resource, resource_id).
    Cobre qualquer edge case não capturado pelas camadas 1-2.
    """
    pending = session.info.get("_audit_pending")
    if not pending:
        return

    connection = session.connection()
    events_to_process = pending.copy()
    pending.clear()

    persisted: set[tuple[str, str, str | None]] = set()

    for evt in events_to_process:
        dedup_key = (evt["action"], evt["resource"], evt["resource_id"])
        if dedup_key in persisted:
            logger.debug("Audit dedup (camada 3): skip %s", dedup_key)
            continue
        persisted.add(dedup_key)

        _persist_audit(
            connection=connection,
            action=evt["action"],
            resource=evt["resource"],
            resource_id=evt["resource_id"],
            details=evt["details"],
        )


def _on_after_commit(session: Session) -> None:
    session.info.pop("_audit_seen_keys", None)
    session.info.pop("_audit_pending", None)


def _on_after_rollback(session: Session) -> None:
    session.info.pop("_audit_seen_keys", None)
    session.info.pop("_audit_pending", None)


# =============================================================================
# Inicialização
# =============================================================================


def init_audit_listeners(app: "Flask") -> None:
    """
    Registra event listeners de auditoria.

    Camada 1: event.contains() previne registro duplo caso init
    seja chamado mais de uma vez (ex: Flask reloader em debug mode).
    """
    with app.app_context():
        target = db.session

        if not event.contains(target, "before_flush", _on_before_flush):
            event.listen(target, "before_flush", _on_before_flush)

        if not event.contains(target, "after_flush", _on_after_flush):
            event.listen(target, "after_flush", _on_after_flush)

        if not event.contains(target, "after_flush_postexec", _on_after_flush_postexec):
            event.listen(target, "after_flush_postexec", _on_after_flush_postexec)

        if not event.contains(target, "after_commit", _on_after_commit):
            event.listen(target, "after_commit", _on_after_commit)

        if not event.contains(target, "after_soft_rollback", _on_after_rollback):
            event.listen(target, "after_soft_rollback", _on_after_rollback)

    logger.info("Audit listeners inicializados")
