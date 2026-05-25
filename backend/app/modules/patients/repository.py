"""Repositorios do cadastro de pacientes."""

from sqlalchemy import func, or_, select

from app.modules.patients.models import Patient
from app.shared.repository import Repository


class PatientRepository(Repository[Patient]):
    """Repositorio de persistencia de pacientes."""

    model = Patient

    def list_paginated(
        self,
        *,
        search: str | None,
        limit: int,
        offset: int,
    ) -> list[Patient]:
        """Liste pacientes com busca simples por nome ou CPF."""

        statement = self._base_search_statement(search)
        statement = statement.order_by(Patient.full_name).limit(limit).offset(offset)
        return list(self.session.scalars(statement))

    def count(self, *, search: str | None) -> int:
        """Conte pacientes que atendem ao filtro informado."""

        search_statement = self._base_search_statement(search).subquery()
        statement = select(func.count()).select_from(search_statement)
        return int(self.session.scalar(statement) or 0)

    def get_by_cpf(self, cpf: str) -> Patient | None:
        """Retorne um paciente pelo CPF normalizado."""

        statement = select(Patient).where(Patient.cpf == cpf)
        return self.session.scalar(statement)

    def _base_search_statement(self, search: str | None):
        """Monte a consulta base usada em lista e contagem."""

        statement = select(Patient)
        if not search:
            return statement

        normalized_search = search.strip()
        cpf_search = "".join(
            character for character in normalized_search if character.isdigit()
        )
        name_pattern = f"%{normalized_search}%"

        filters = [Patient.full_name.ilike(name_pattern)]
        if cpf_search:
            filters.append(Patient.cpf.like(f"%{cpf_search}%"))

        return statement.where(or_(*filters))
