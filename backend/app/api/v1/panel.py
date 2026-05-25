"""Panel state routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.modules.calls.schemas import CallRead
from app.modules.panel.schemas import PanelState
from app.modules.panel.service import PanelService

router = APIRouter(prefix="/panel", tags=["panel"])


@router.get("/state", response_model=PanelState)
async def panel_state(session: Session = Depends(get_db)) -> PanelState:
    """Return panel state used for initial load and reconnects."""

    service = PanelService(session)
    return PanelState(
        active_calls=[CallRead.model_validate(call) for call in service.active_calls()],
        recent_calls=[CallRead.model_validate(call) for call in service.recent_calls()],
    )
