"""Shared pytest fixtures for backend tests."""

from collections.abc import Generator

import pytest
from app import models as _models  # noqa: F401
from app.core.database import Base
from app.modules.appointments.models import Appointment
from app.modules.auth.models import User
from app.modules.rooms.models import Room
from app.modules.tenant.models import TenantProfile
from app.modules.triage.models import TriageRecord
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def db_session() -> Generator[Session]:
    """Create an isolated in-memory database session."""

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[
            User.__table__,
            Appointment.__table__,
            Room.__table__,
            TenantProfile.__table__,
            TriageRecord.__table__,
        ],
    )
    session_factory = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    with session_factory() as session:
        yield session
    Base.metadata.drop_all(engine)
