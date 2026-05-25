"""Servicos do perfil white-label da clinica."""

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.audit.service import record_audit
from app.modules.auth.models import User
from app.modules.tenant.models import TenantProfile
from app.modules.tenant.repository import TENANT_PROFILE_ID, TenantProfileRepository
from app.modules.tenant.schemas import TenantProfileRead, TenantProfileUpdate


class TenantProfileService:
    """Coordena leitura e atualizacao do perfil da clinica."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.profiles = TenantProfileRepository(session)

    def get_profile(self) -> TenantProfileRead:
        """Return the stored profile or a neutral fallback."""

        profile = self.profiles.get_profile()
        if profile is not None:
            return TenantProfileRead.model_validate(profile)

        settings = get_settings()
        return TenantProfileRead(
            id=None,
            trade_name=settings.app_name,
            timezone=settings.app_timezone,
            is_active=True,
        )

    def upsert_profile(
        self,
        payload: TenantProfileUpdate,
        actor: User | None,
    ) -> TenantProfile:
        """Create or update the singleton clinic profile."""

        profile = self.profiles.get_profile()
        update_data = payload.model_dump()

        if profile is None:
            profile = TenantProfile(id=TENANT_PROFILE_ID, **update_data)
            self.profiles.add(profile)
            action = "tenant.profile.created"
        else:
            for field, value in update_data.items():
                setattr(profile, field, value)
            action = "tenant.profile.updated"

        self.session.flush()
        record_audit(
            self.session,
            actor_user_id=actor.id if actor is not None else None,
            action=action,
            entity_type="tenant_profile",
            entity_id=profile.id,
            payload={"trade_name": profile.trade_name},
        )
        self.session.commit()
        self.session.refresh(profile)
        return profile
