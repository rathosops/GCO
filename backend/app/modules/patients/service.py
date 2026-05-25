"""Servicos de negocio do cadastro de pacientes."""

from sqlalchemy.orm import Session

from app.modules.audit.service import record_audit
from app.modules.auth.models import User
from app.modules.patients.models import Patient
from app.modules.patients.repository import PatientRepository
from app.modules.patients.schemas import PatientCreate, PatientUpdate
from app.shared.exceptions import BusinessRuleError, NotFoundError


class PatientService:
    """Coordena regras e persistencia de pacientes."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.patients = PatientRepository(session)

    def list_patients(
        self,
        *,
        search: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Patient], int]:
        """Liste pacientes e total para paginacao."""

        patients = self.patients.list_paginated(
            search=search,
            limit=limit,
            offset=offset,
        )
        total_patients = self.patients.count(search=search)
        return patients, total_patients

    def get_patient(self, patient_id: int) -> Patient:
        """Retorne um paciente ou falhe quando ele nao existir."""

        patient = self.patients.get(patient_id)
        if patient is None:
            raise NotFoundError("Paciente nao encontrado")
        return patient

    def get_patient_by_cpf(self, cpf: str) -> Patient:
        """Retorne um paciente pelo CPF normalizado."""

        patient = self.patients.get_by_cpf(cpf)
        if patient is None:
            raise NotFoundError("Paciente nao encontrado")
        return patient

    def create_patient(self, payload: PatientCreate, actor: User) -> Patient:
        """Crie um paciente garantindo CPF unico quando informado."""

        if payload.cpf and self.patients.get_by_cpf(payload.cpf) is not None:
            raise BusinessRuleError("CPF ja cadastrado")

        patient = Patient(
            full_name=payload.full_name,
            cpf=payload.cpf,
            birth_date=payload.birth_date,
            sex=payload.sex.value,
            email=payload.email,
            phone=payload.phone,
            address_line=payload.address_line,
            city=payload.city,
            state=payload.state,
            postal_code=payload.postal_code,
            notes=payload.notes,
            is_active=payload.is_active,
        )
        self.patients.add(patient)
        self.session.flush()
        record_audit(
            self.session,
            actor_user_id=actor.id,
            action="patient.created",
            entity_type="patient",
            entity_id=patient.id,
            payload={"full_name": patient.full_name},
        )
        self.session.commit()
        self.session.refresh(patient)
        return patient

    def update_patient(
        self,
        patient_id: int,
        payload: PatientUpdate,
        actor: User,
    ) -> Patient:
        """Atualize dados cadastrais de um paciente."""

        patient = self.get_patient(patient_id)
        update_data = payload.model_dump(exclude_unset=True)

        cpf = update_data.get("cpf")
        if cpf:
            existing_patient = self.patients.get_by_cpf(cpf)
            if existing_patient is not None and existing_patient.id != patient.id:
                raise BusinessRuleError("CPF ja cadastrado")

        for field_name, field_value in update_data.items():
            if hasattr(field_value, "value"):
                field_value = field_value.value
            setattr(patient, field_name, field_value)

        record_audit(
            self.session,
            actor_user_id=actor.id,
            action="patient.updated",
            entity_type="patient",
            entity_id=patient.id,
            payload={"fields": sorted(update_data)},
        )
        self.session.commit()
        self.session.refresh(patient)
        return patient
