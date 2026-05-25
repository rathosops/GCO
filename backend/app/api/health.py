"""Health endpoints for process and dependency checks."""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from redis import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.redis import get_redis_client

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health() -> dict[str, str]:
    """Return process-level health without external dependency checks."""

    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@router.get("/ready")
async def readiness() -> JSONResponse:
    """Return readiness status for PostgreSQL and Redis."""

    checks = {
        "postgres": _check_postgres(),
        "redis": _check_redis(),
    }
    is_ready = all(value == "ok" for value in checks.values())
    payload = {
        "status": "ready" if is_ready else "not_ready",
        **checks,
    }
    return JSONResponse(
        status_code=status.HTTP_200_OK
        if is_ready
        else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=payload,
    )


def _check_postgres() -> str:
    """Return PostgreSQL readiness state."""

    try:
        with SessionLocal() as session:
            session.execute(text("select 1"))
    except SQLAlchemyError:
        return "error"
    return "ok"


def _check_redis() -> str:
    """Return Redis readiness state."""

    try:
        client = get_redis_client()
        client.ping()
    except RedisError:
        return "error"
    return "ok"
