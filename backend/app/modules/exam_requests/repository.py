"""Repositorios de solicitacoes de exames."""

from sqlalchemy import select

from app.modules.exam_requests.models import ExamRequest, ExamRequestItem
from app.shared.repository import Repository


class ExamRequestRepository(Repository[ExamRequest]):
    """Acesso a persistencia de solicitacoes."""

    model = ExamRequest

    def list_recent(self, limit: int = 100) -> list[ExamRequest]:
        """Liste solicitacoes recentes."""

        statement = (
            select(ExamRequest).order_by(ExamRequest.requested_at.desc()).limit(limit)
        )
        return list(self.session.scalars(statement))


class ExamRequestItemRepository(Repository[ExamRequestItem]):
    """Acesso a persistencia de itens solicitados."""

    model = ExamRequestItem

    def list_by_request(self, exam_request_id: int) -> list[ExamRequestItem]:
        """Liste itens de uma solicitacao."""

        statement = select(ExamRequestItem).where(
            ExamRequestItem.exam_request_id == exam_request_id
        )
        return list(self.session.scalars(statement))
