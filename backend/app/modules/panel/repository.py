"""Repositories for panel models."""

from app.modules.panel.models import PanelSetting
from app.shared.repository import Repository


class PanelSettingRepository(Repository[PanelSetting]):
    """Repository for panel setting persistence."""

    model = PanelSetting
