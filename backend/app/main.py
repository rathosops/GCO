"""FastAPI application factory for GCO V2."""

import asyncio
from contextlib import asynccontextmanager, suppress
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models as _models  # noqa: F401
from app.api.health import router as health_router
from app.api.v1.router import router as api_v1_router
from app.api.ws import router as ws_router
from app.core.config import get_settings
from app.modules.panel.broadcaster import subscribe_panel_events


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
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

    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(api_v1_router, prefix=settings.api_prefix)
    app.include_router(ws_router)

    return app


app = create_app()
