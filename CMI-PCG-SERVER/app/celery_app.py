"""
Configuração do Celery.

- Usa create_app(register_blueprints=False) para ter app_context/db sem controllers.
- Padroniza logging (mesmo formato do Flask).
"""

from __future__ import annotations

import os

from celery import Celery

from app.app_factory import create_app
from app.logging_conf import configure_logging, set_task_id

# Configura logging cedo também no worker
configure_logging(service_name="cmi-pcg-celery")

_flask_app = create_app(register_blueprints=False)


def _make_celery() -> Celery:
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1")
    result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2")

    celery = Celery(_flask_app.import_name, broker=broker_url, backend=result_backend)

    celery.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone=os.getenv("TZ", "America/Sao_Paulo"),
        enable_utc=True,
        broker_connection_retry_on_startup=True,
        # Evita Celery “tomar” o root logger e bagunçar seu formato
        worker_hijack_root_logger=False,
    )

    class FlaskContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            # Task id no contexto de logging
            set_task_id(getattr(self.request, "id", None))
            with _flask_app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = FlaskContextTask
    return celery


celery = _make_celery()
