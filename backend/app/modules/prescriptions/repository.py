"""Repositorios de receituarios."""

from sqlalchemy import select

from app.modules.prescriptions.models import Prescription, PrescriptionItem
from app.shared.repository import Repository


class PrescriptionRepository(Repository[Prescription]):
    """Acesso a persistencia de receituarios."""

    model = Prescription

    def list_recent(self, limit: int = 100) -> list[Prescription]:
        """Liste receituarios recentes."""

        statement = (
            select(Prescription).order_by(Prescription.issued_at.desc()).limit(limit)
        )
        return list(self.session.scalars(statement))


class PrescriptionItemRepository(Repository[PrescriptionItem]):
    """Acesso a persistencia de itens de receituario."""

    model = PrescriptionItem

    def list_by_prescription(self, prescription_id: int) -> list[PrescriptionItem]:
        """Liste itens de um receituario."""

        statement = select(PrescriptionItem).where(
            PrescriptionItem.prescription_id == prescription_id
        )
        return list(self.session.scalars(statement))
