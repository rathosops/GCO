"""Repositorios de consultas e prontuario."""

from sqlalchemy import Select, func, select

from app.modules.clinical_records.models import ClinicalRecord
from app.shared.repository import Repository


class ClinicalRecordRepository(Repository[ClinicalRecord]):
    """Acesso a persistencia de prontuarios."""

    model = ClinicalRecord

    def find_by_appointment_id(self, appointment_id: int) -> ClinicalRecord | None:
        """Retorne o prontuario de um agendamento, quando existir."""

        statement = select(ClinicalRecord).where(
            ClinicalRecord.appointment_id == appointment_id
        )
        return self.session.scalar(statement)

    def list_records(
        self,
        *,
        patient_id: int | None,
        appointment_id: int | None,
        limit: int,
        offset: int,
    ) -> tuple[list[ClinicalRecord], int]:
        """Liste prontuarios com filtros simples."""

        statement = select(ClinicalRecord)
        statement = self._apply_filters(
            statement,
            patient_id=patient_id,
            appointment_id=appointment_id,
        )
        total_statement = select(func.count()).select_from(statement.subquery())
        total_records = self.session.scalar(total_statement) or 0
        records = list(
            self.session.scalars(
                statement.order_by(ClinicalRecord.started_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        return records, total_records

    def _apply_filters(
        self,
        statement: Select[tuple[ClinicalRecord]],
        *,
        patient_id: int | None,
        appointment_id: int | None,
    ) -> Select[tuple[ClinicalRecord]]:
        if patient_id is not None:
            statement = statement.where(ClinicalRecord.patient_id == patient_id)
        if appointment_id is not None:
            statement = statement.where(ClinicalRecord.appointment_id == appointment_id)
        return statement
