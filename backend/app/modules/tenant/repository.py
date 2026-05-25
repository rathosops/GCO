"""Repositorios do perfil white-label da clinica."""

from app.modules.tenant.models import TenantProfile
from app.shared.repository import Repository

TENANT_PROFILE_ID = 1


class TenantProfileRepository(Repository[TenantProfile]):
    """Repositorio do perfil singleton da instalacao."""

    model = TenantProfile

    def get_profile(self) -> TenantProfile | None:
        """Return the configured profile, when present."""

        return self.get(TENANT_PROFILE_ID)
