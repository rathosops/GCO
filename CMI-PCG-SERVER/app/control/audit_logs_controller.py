"""
Controller de Audit Logs - Consulta do histórico de auditoria.

Endpoints:
    GET /audit-logs                              → Listar logs (compacto por default)
    GET /audit-logs/stats                        → Estatísticas de auditoria
    GET /audit-logs/resources                    → Lista recursos auditados
    GET /audit-logs/insights                     → Insights narrativos + dados para gráficos
    GET /audit-logs/history/<resource>/<res_id>  → Timeline de um recurso específico
    GET /audit-logs/<id>                         → Detalhe completo de um log

Todos os endpoints exigem permissão admin.audit.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from app.models.auth.audit_log_model import AuditLog
from app.database import db
from app.src.auth.decorators import require_permission
from app.utils.responses import get_pagination, json_error
from app.utils.timezone import SAO_PAULO_TZ, get_now_sao_paulo

audit_logs_bp = Blueprint("audit_logs", __name__, url_prefix="/audit-logs")


# ── Helpers ──────────────────────────────────────────────────────────────


def _parse_datetime(value: str | None) -> datetime | None:
    """Parse ISO date ou YYYY-MM-DD para datetime aware em São Paulo."""
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            naive = datetime.strptime(value.strip(), fmt)
            return naive.replace(tzinfo=SAO_PAULO_TZ)
        except ValueError:
            continue
    return None


def _to_sp(dt: datetime | None) -> datetime | None:
    """Converte datetime para America/Sao_Paulo."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=SAO_PAULO_TZ)
    return dt.astimezone(SAO_PAULO_TZ)


def _apply_date_filters(query, date_from: datetime | None, date_to: datetime | None):
    """Aplica filtros de data na query (DRY)."""
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)
    return query


# ── Labels ───────────────────────────────────────────────────────────────


_RESOURCE_LABELS = {
    "pacientes": "Pacientes",
    "medicos": "Médicos",
    "consultas": "Consultas",
    "agendamentos": "Agendamentos",
    "exames": "Exames",
    "exames_clinica": "Exames Clínicos",
    "pagamentos": "Pagamentos",
    "empresas": "Empresas",
    "empresa_setores": "Setores",
    "empresa_cargos": "Cargos",
    "vinculos_empregaticios": "Vínculos",
    "convenios": "Convênios",
    "prontuarios": "Prontuários",
    "receituarios": "Receituários",
    "medicamentos": "Medicamentos",
    "fornecedores": "Fornecedores",
    "estoque_movimentacoes": "Movimentações",
    "pericias_imesc": "Perícias IMESC",
    "feriados": "Feriados",
    "procedimentos": "Procedimentos",
    "solicitacoes_exames": "Solicitações de Exame",
}

_ACTION_LABELS = {
    "create": "criações",
    "update": "edições",
    "delete": "exclusões",
}

_WEEKDAY_LABELS = [
    "segunda",
    "terça",
    "quarta",
    "quinta",
    "sexta",
    "sábado",
    "domingo",
]


def _rl(resource: str) -> str:
    return _RESOURCE_LABELS.get(resource, resource.replace("_", " ").title())


def _al(action: str) -> str:
    return _ACTION_LABELS.get(action, action)


# ── GET /audit-logs ──────────────────────────────────────────────────────


@audit_logs_bp.route("", methods=["GET"])
@require_permission("admin.audit")
def list_audit_logs():
    """
    Lista logs de auditoria com filtros opcionais.

    Query params:
        user_id, action, resource, resource_id, date_from, date_to,
        limit, offset, compact (bool, default true)
    """
    try:
        query = AuditLog.query

        # Filtros
        if user_id := request.args.get("user_id"):
            try:
                query = query.filter(AuditLog.user_id == int(user_id))
            except (ValueError, TypeError):
                return json_error("user_id deve ser um número inteiro")

        if action := request.args.get("action"):
            query = query.filter(AuditLog.action == action.strip().lower())

        if resource := request.args.get("resource"):
            query = query.filter(AuditLog.resource == resource.strip().lower())

        if resource_id := request.args.get("resource_id"):
            query = query.filter(AuditLog.resource_id == resource_id.strip())

        query = _apply_date_filters(
            query,
            _parse_datetime(request.args.get("date_from")),
            _parse_datetime(request.args.get("date_to")),
        )

        total = query.count()

        query = query.order_by(AuditLog.created_at.desc())
        limit, offset = get_pagination()
        logs = query.offset(offset).limit(limit).all()

        # Modo compacto por default na listagem (menos payload)
        compact = request.args.get("compact", "true").lower() != "false"
        serializer = AuditLog.to_compact_dict if compact else AuditLog.to_dict

        return jsonify(
            {
                "total": total,
                "limit": limit,
                "offset": offset,
                "logs": [serializer(log) for log in logs],
            }
        )

    except Exception as exc:
        return json_error(f"Erro ao listar audit logs: {exc}", 500)


# ── GET /audit-logs/history/<resource>/<resource_id> ─────────────────────


@audit_logs_bp.route("/history/<string:resource>/<string:resource_id>", methods=["GET"])
@require_permission("admin.audit")
def resource_history(resource: str, resource_id: str):
    """
    Timeline completa de um recurso específico.

    Útil para modal de "histórico de alterações" em qualquer entidade.
    Retorna logs completos (não compactos) ordenados cronologicamente.
    """
    try:
        limit = min(int(request.args.get("limit", 50)), 200)

        logs = AuditLog.get_resource_history(
            resource=resource.strip().lower(),
            resource_id=resource_id.strip(),
            limit=limit,
        )

        return jsonify(
            {
                "resource": resource,
                "resource_id": resource_id,
                "resource_label": _rl(resource),
                "total": len(logs),
                "timeline": [log.to_dict() for log in logs],
            }
        )

    except Exception as exc:
        return json_error(f"Erro ao buscar histórico: {exc}", 500)


# ── GET /audit-logs/stats ────────────────────────────────────────────────


@audit_logs_bp.route("/stats", methods=["GET"])
@require_permission("admin.audit")
def audit_stats():
    """
    Estatísticas de auditoria.

    Query params: date_from, date_to
    Retorna contadores por ação, recurso e usuário.
    """
    try:
        base_query = db.session.query(AuditLog)
        base_query = _apply_date_filters(
            base_query,
            _parse_datetime(request.args.get("date_from")),
            _parse_datetime(request.args.get("date_to")),
        )

        total = base_query.count()

        by_action = (
            base_query.with_entities(AuditLog.action, db.func.count(AuditLog.id))
            .group_by(AuditLog.action)
            .order_by(db.func.count(AuditLog.id).desc())
            .all()
        )

        by_resource = (
            base_query.with_entities(AuditLog.resource, db.func.count(AuditLog.id))
            .group_by(AuditLog.resource)
            .order_by(db.func.count(AuditLog.id).desc())
            .all()
        )

        top_users = (
            base_query.filter(AuditLog.user_id.isnot(None))
            .with_entities(
                AuditLog.user_id,
                AuditLog.user_nome,
                AuditLog.user_type,
                db.func.count(AuditLog.id),
            )
            .group_by(AuditLog.user_id, AuditLog.user_nome, AuditLog.user_type)
            .order_by(db.func.count(AuditLog.id).desc())
            .limit(10)
            .all()
        )

        anonymous_count = base_query.filter(AuditLog.user_id.is_(None)).count()

        return jsonify(
            {
                "total": total,
                "anonymous_actions": anonymous_count,
                "by_action": [
                    {"action": a, "label": _al(a), "count": c} for a, c in by_action
                ],
                "by_resource": [
                    {"resource": r, "label": _rl(r), "count": c} for r, c in by_resource
                ],
                "top_users": [
                    {"user_id": uid, "user_nome": nome, "user_type": ut, "count": c}
                    for uid, nome, ut, c in top_users
                ],
            }
        )

    except Exception as exc:
        return json_error(f"Erro ao gerar estatísticas: {exc}", 500)


# ── GET /audit-logs/resources ────────────────────────────────────────────


@audit_logs_bp.route("/resources", methods=["GET"])
@require_permission("admin.audit")
def audit_resources():
    """Lista todos os recursos auditados com labels."""
    try:
        resources = (
            db.session.query(AuditLog.resource)
            .distinct()
            .order_by(AuditLog.resource)
            .all()
        )
        return jsonify(
            {
                "resources": [{"key": r[0], "label": _rl(r[0])} for r in resources],
            }
        )

    except Exception as exc:
        return json_error(f"Erro ao listar recursos: {exc}", 500)


# ── GET /audit-logs/insights ────────────────────────────────────────────


@audit_logs_bp.route("/insights", methods=["GET"])
@require_permission("admin.audit")
def audit_insights():
    """
    Insights narrativos + dados analíticos para gráficos.

    Query params:
        days (int) — Janela de análise em dias (default 30, max 365)
    """
    try:
        days = min(int(request.args.get("days", 30)), 365)
        now = get_now_sao_paulo()
        start = now - timedelta(days=days)
        prev_start = start - timedelta(days=days)

        current_logs = AuditLog.query.filter(AuditLog.created_at >= start).all()

        prev_count = AuditLog.query.filter(
            AuditLog.created_at >= prev_start,
            AuditLog.created_at < start,
        ).count()

        if not current_logs:
            return jsonify(
                {
                    "period_days": days,
                    "total_actions": 0,
                    "narrative_cards": [
                        {
                            "type": "info",
                            "icon": "📊",
                            "title": "Sem atividade recente",
                            "description": f"Nenhuma ação registrada nos últimos {days} dias.",
                        }
                    ],
                    "user_profiles": [],
                    "activity_timeline": [],
                    "heatmap_data": [],
                    "resource_trend": [],
                    "action_distribution": [],
                }
            )

        # ── Estruturas de análise ────────────────────────────────────
        total = len(current_logs)
        by_user: dict[int, list] = defaultdict(list)
        by_resource: Counter = Counter()
        by_action: Counter = Counter()
        heatmap: dict[tuple[int, int], int] = defaultdict(int)
        daily_counts: dict[str, int] = defaultdict(int)

        for log in current_logs:
            if log.user_id:
                by_user[log.user_id].append(log)
            by_resource[log.resource] += 1
            by_action[log.action] += 1

            dt = _to_sp(log.created_at)
            if dt:
                daily_counts[dt.strftime("%Y-%m-%d")] += 1
                heatmap[(dt.weekday(), dt.hour)] += 1

        cards = _build_narrative_cards(
            total, prev_count, days, by_resource, by_action, heatmap
        )
        user_profiles = _build_user_profiles(by_user, days)

        # Timeline diária
        activity_timeline = []
        d = start
        while d <= now:
            day_str = d.strftime("%Y-%m-%d")
            activity_timeline.append(
                {"date": day_str, "count": daily_counts.get(day_str, 0)}
            )
            d += timedelta(days=1)

        # Heatmap
        heatmap_data = [
            {"weekday": wd, "hour": h, "count": c}
            for (wd, h), c in heatmap.items()
            if c > 0
        ]

        # Resource trend com delta
        prev_by_resource: Counter = Counter()
        prev_logs = (
            AuditLog.query.filter(
                AuditLog.created_at >= prev_start,
                AuditLog.created_at < start,
            )
            .with_entities(AuditLog.resource)
            .all()
        )
        for (r,) in prev_logs:
            prev_by_resource[r] += 1

        resource_trend = []
        for resource, count in by_resource.most_common():
            prev_c = prev_by_resource.get(resource, 0)
            delta = count - prev_c
            delta_pct = round(((delta / prev_c) * 100), 1) if prev_c > 0 else None
            resource_trend.append(
                {
                    "resource": resource,
                    "label": _rl(resource),
                    "count": count,
                    "previous": prev_c,
                    "delta": delta,
                    "delta_pct": delta_pct,
                }
            )

        action_distribution = [
            {"action": a, "label": _al(a), "count": c}
            for a, c in by_action.most_common()
        ]

        return jsonify(
            {
                "period_days": days,
                "total_actions": total,
                "narrative_cards": cards,
                "user_profiles": user_profiles,
                "activity_timeline": activity_timeline,
                "heatmap_data": heatmap_data,
                "resource_trend": resource_trend,
                "action_distribution": action_distribution,
            }
        )

    except Exception as exc:
        return json_error(f"Erro ao gerar insights: {exc}", 500)


# ── Builders internos (insights) ─────────────────────────────────────────


def _build_narrative_cards(
    total: int,
    prev_count: int,
    days: int,
    by_resource: Counter,
    by_action: Counter,
    heatmap: dict[tuple[int, int], int],
) -> list[dict]:
    cards: list[dict] = []

    # Delta vs período anterior
    if prev_count > 0:
        delta_pct = round(((total - prev_count) / prev_count) * 100, 1)
        if delta_pct > 0:
            cards.append(
                {
                    "type": "success",
                    "icon": "📈",
                    "title": f"+{delta_pct}% de atividade",
                    "description": (
                        f"O sistema registrou {total} ações nos últimos {days} dias, "
                        f"um aumento de {delta_pct}% comparado ao período anterior."
                    ),
                    "metric": {
                        "current": total,
                        "previous": prev_count,
                        "delta_pct": delta_pct,
                    },
                }
            )
        elif delta_pct < 0:
            cards.append(
                {
                    "type": "warning",
                    "icon": "📉",
                    "title": f"{delta_pct}% de atividade",
                    "description": (
                        f"Houve {total} ações nos últimos {days} dias, "
                        f"uma redução de {abs(delta_pct)}% em relação ao período anterior."
                    ),
                    "metric": {
                        "current": total,
                        "previous": prev_count,
                        "delta_pct": delta_pct,
                    },
                }
            )
        else:
            cards.append(
                {
                    "type": "info",
                    "icon": "➡️",
                    "title": "Atividade estável",
                    "description": f"{total} ações registradas, mesmo volume do período anterior.",
                    "metric": {
                        "current": total,
                        "previous": prev_count,
                        "delta_pct": 0,
                    },
                }
            )
    else:
        cards.append(
            {
                "type": "info",
                "icon": "🆕",
                "title": f"{total} ações registradas",
                "description": f"Primeiros registros nos últimos {days} dias. Sem período anterior para comparação.",
                "metric": {"current": total, "previous": 0, "delta_pct": None},
            }
        )

    # Recurso mais ativo
    if by_resource:
        top_resource, top_count = by_resource.most_common(1)[0]
        pct = round((top_count / total) * 100, 1)
        cards.append(
            {
                "type": "highlight",
                "icon": "🎯",
                "title": f"Foco principal: {_rl(top_resource)}",
                "description": (
                    f"{_rl(top_resource)} concentra {pct}% de toda a atividade "
                    f"({top_count} ações)."
                ),
                "metric": {"resource": top_resource, "count": top_count, "pct": pct},
            }
        )

    # Horário de pico
    if heatmap:
        peak_key = max(heatmap, key=heatmap.get)
        peak_day, peak_hour = peak_key
        cards.append(
            {
                "type": "info",
                "icon": "⏰",
                "title": f"Pico: {_WEEKDAY_LABELS[peak_day]}s às {peak_hour}h",
                "description": (
                    f"Maior concentração de ações em "
                    f"{_WEEKDAY_LABELS[peak_day]}-feira às {peak_hour}:00."
                ),
                "metric": {
                    "weekday": peak_day,
                    "hour": peak_hour,
                    "count": heatmap[peak_key],
                },
            }
        )

    # Ação predominante
    if by_action:
        top_action, top_count = by_action.most_common(1)[0]
        pct = round((top_count / total) * 100, 1)
        icon = {"update": "✏️", "create": "➕", "delete": "🗑️"}.get(top_action, "📋")
        contexto = {
            "update": "Sistema maduro com dados sendo mantidos atualizados.",
            "create": "Fase de crescimento com muitos novos cadastros.",
            "delete": "Volume relevante de exclusões — vale monitorar.",
        }.get(top_action, "")

        cards.append(
            {
                "type": "info",
                "icon": icon,
                "title": f"{pct}% das ações são {_al(top_action)}",
                "description": f"Atividade predominante: {_al(top_action)} ({top_count}/{total}). {contexto}",
                "metric": {"action": top_action, "count": top_count, "pct": pct},
            }
        )

    # Recursos inativos
    all_resources = {r[0] for r in db.session.query(AuditLog.resource).distinct().all()}
    inactive = all_resources - set(by_resource.keys())

    if inactive:
        labels = ", ".join(_rl(r) for r in sorted(inactive)[:5])
        suffix = f" e mais {len(inactive) - 5}" if len(inactive) > 5 else ""
        cards.append(
            {
                "type": "attention",
                "icon": "💤",
                "title": f"{len(inactive)} módulo(s) sem atividade",
                "description": f"Sem ações nos últimos {days} dias em: {labels}{suffix}.",
                "metric": {"inactive_resources": sorted(inactive)},
            }
        )

    return cards


def _build_user_profiles(by_user: dict[int, list], days: int) -> list[dict]:
    profiles = []
    sorted_users = sorted(by_user.items(), key=lambda x: len(x[1]), reverse=True)

    for uid, logs in sorted_users[:15]:
        user_actions = Counter(log.action for log in logs)
        user_resources = Counter(log.resource for log in logs)
        count = len(logs)

        fav_resource, fav_count = user_resources.most_common(1)[0]
        fav_pct = round((fav_count / count) * 100, 1)

        active_days = len(
            {
                _to_sp(log.created_at).strftime("%Y-%m-%d")
                for log in logs
                if log.created_at
            }
        )

        user_hours = Counter(
            _to_sp(log.created_at).hour for log in logs if log.created_at
        )
        peak_hour = user_hours.most_common(1)[0][0] if user_hours else None

        phrases = []
        phrases.append(f"Foco em **{_rl(fav_resource)}** ({fav_pct}% das ações).")

        ratio = active_days / days if days > 0 else 0
        if ratio >= 0.7:
            phrases.append(f"Muito consistente! Ativo em {active_days}/{days} dias.")
        elif ratio >= 0.3:
            phrases.append(f"Atividade moderada: {active_days}/{days} dias.")
        else:
            phrases.append(
                f"Atividade concentrada: apenas {active_days} dias no período."
            )

        if peak_hour is not None:
            periodo = (
                "manhã"
                if 6 <= peak_hour < 12
                else (
                    "tarde"
                    if 12 <= peak_hour < 18
                    else "noite" if 18 <= peak_hour < 22 else "madrugada"
                )
            )
            phrases.append(f"Mais produtivo de {periodo} (pico às {peak_hour}h).")

        num_resources = len(user_resources)
        if num_resources >= 5:
            phrases.append(f"Perfil generalista: {num_resources} módulos.")
        elif num_resources <= 2:
            phrases.append(f"Perfil especialista: {num_resources} módulo(s).")

        top_action = user_actions.most_common(1)[0][0]
        action_phrases = {
            "update": "Foco em manutenção: maioria são edições.",
            "create": "Foco em cadastro: maioria são criações.",
            "delete": "⚠️ Volume alto de exclusões.",
        }
        if top_action in action_phrases:
            phrases.append(action_phrases[top_action])

        sample = logs[0]
        profiles.append(
            {
                "user_id": uid,
                "user_nome": sample.user_nome,
                "user_type": sample.user_type,
                "total_actions": count,
                "active_days": active_days,
                "peak_hour": peak_hour,
                "favorite_resource": fav_resource,
                "favorite_resource_label": _rl(fav_resource),
                "favorite_resource_pct": fav_pct,
                "resources_count": num_resources,
                "action_breakdown": dict(user_actions),
                "top_resources": [
                    {"resource": r, "label": _rl(r), "count": c}
                    for r, c in user_resources.most_common(5)
                ],
                "phrases": phrases,
            }
        )

    return profiles


# ── GET /audit-logs/<id> ─────────────────────────────────────────────────


@audit_logs_bp.route("/<int:log_id>", methods=["GET"])
@require_permission("admin.audit")
def get_audit_log(log_id: int):
    """Retorna detalhe completo de um registro de auditoria."""
    try:
        log = AuditLog.query.get(log_id)
        if not log:
            return json_error("Registro de auditoria não encontrado", 404)
        return jsonify(log.to_dict())

    except Exception as exc:
        return json_error(f"Erro ao buscar audit log: {exc}", 500)
