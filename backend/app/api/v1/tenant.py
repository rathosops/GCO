"""Rotas do perfil white-label da clinica."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permissions
from app.modules.auth.models import User
from app.modules.auth.permissions import Permission
from app.modules.tenant.schemas import TenantProfileRead, TenantProfileUpdate
from app.modules.tenant.service import TenantProfileService

router = APIRouter(prefix="/tenant", tags=["tenant"])


@router.get("/profile", response_model=TenantProfileRead)
async def get_tenant_profile(
    session: Session = Depends(get_db),
) -> TenantProfileRead:
    """Return the public white-label clinic profile."""

    return TenantProfileService(session).get_profile()


@router.put("/profile", response_model=TenantProfileRead)
async def update_tenant_profile(
    payload: TenantProfileUpdate,
    session: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.TENANT_MANAGE)),
) -> TenantProfileRead:
    """Update the white-label clinic profile."""

    profile = TenantProfileService(session).upsert_profile(payload, current_user)
    return TenantProfileRead.model_validate(profile)
