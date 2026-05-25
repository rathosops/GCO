"""Publish panel events to Redis."""

from redis import RedisError

from app.core.redis import get_redis_client
from app.modules.calls.models import Call
from app.modules.panel.events import (
    PANEL_EVENT_SOURCE_ID,
    PANEL_EVENTS_CHANNEL,
    PanelEvent,
)


def publish_panel_event(event: PanelEvent) -> bool:
    """Publish a panel event, returning False when Redis is unavailable."""

    try:
        get_redis_client().publish(
            PANEL_EVENTS_CHANNEL,
            event.model_dump_json(),
        )
    except RedisError:
        return False
    return True


def build_call_event(event_type: str, call: Call) -> PanelEvent:
    """Build a call event for panel consumers."""

    return PanelEvent(
        type=event_type,
        payload={
            "_source_id": PANEL_EVENT_SOURCE_ID,
            "id": call.id,
            "appointment_id": call.appointment_id,
            "room_id": call.room_id,
            "status": call.status,
            "kind": call.kind,
            "sequence_number": call.sequence_number,
            "message": call.message,
            "called_at": call.called_at.isoformat(),
        },
    )


def publish_call_event(event_type: str, call: Call) -> PanelEvent:
    """Publish a call event and return the event envelope."""

    event = build_call_event(event_type, call)
    publish_panel_event(event)
    return event
