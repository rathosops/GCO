"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.appointments import router as appointments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.calls import router as calls_router
from app.api.v1.panel import router as panel_router
from app.api.v1.rooms import router as rooms_router
from app.api.v1.tenant import router as tenant_router
from app.api.v1.triage import router as triage_router

router = APIRouter(prefix="/v1")
router.include_router(auth_router)
router.include_router(tenant_router)
router.include_router(rooms_router)
router.include_router(appointments_router)
router.include_router(triage_router)
router.include_router(calls_router)
router.include_router(panel_router)


@router.get("/status", tags=["status"])
async def api_status() -> dict[str, str]:
    """Return a minimal versioned API status payload."""

    return {"status": "ok", "api": "v1"}
