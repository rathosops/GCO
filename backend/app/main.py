"""FastAPI application factory for GCO V2."""

import asyncio
import logging
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app import models as _models  # noqa: F401
from app.api.health import router as health_router
from app.api.v1.router import router as api_v1_router
from app.api.ws import router as ws_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.modules.panel.broadcaster import subscribe_panel_events

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    """Start background infrastructure tasks."""

    panel_task = asyncio.create_task(subscribe_panel_events())
    try:
        yield
    finally:
        panel_task.cancel()
        with suppress(asyncio.CancelledError):
            await panel_task


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    settings = get_settings()
    configure_logging(settings.log_level)
    docs_url = f"{settings.api_prefix}/docs" if settings.is_development else None
    redoc_url = f"{settings.api_prefix}/redoc" if settings.is_development else None
    openapi_url = (
        f"{settings.api_prefix}/openapi.json" if settings.is_development else None
    )

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_logging_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid4()))
        started_at = perf_counter()
        response = await call_next(request)
        elapsed_ms = round((perf_counter() - started_at) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request method=%s path=%s status=%s duration_ms=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            extra={"request_id": request_id},
        )
        return response

    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(api_v1_router, prefix=settings.api_prefix)
    app.include_router(ws_router)

    return app


app = create_app()
