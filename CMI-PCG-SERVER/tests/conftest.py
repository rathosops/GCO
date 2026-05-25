import pytest
import os
from app import app as flask_app
from app.database import db


# Garantia de segurança
if os.getenv("FLASK_ENV") != "development" or os.getenv("FLASK_DEBUG") != "1":
    raise RuntimeError(
        "Testes só podem ser executados em ambiente de desenvolvimento com FLASK_DEBUG=1."
    )


@pytest.fixture(scope="session")
def app():
    """
    Configura o Flask app para testes, usando Postgres exclusivo.
    Só roda se FLASK_ENV=development e FLASK_DEBUG=1.
    """
    flask_app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": (
            f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
            f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/"
            f"{os.getenv('POSTGRES_TEST_DB', 'clinicacmi_test')}"
        ),
        "SQLALCHEMY_TRACK_MODIFICATIONS": False
    })

    with flask_app.app_context():
        db.drop_all()
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture(scope="session")
def client(app):
    """Cliente HTTP de teste."""
    return app.test_client()


@pytest.fixture(scope="function")
def test_client(app):
    """Sessão limpa do banco para cada teste (rollback no final)."""
    with app.app_context():
        connection = db.engine.connect()
        transaction = connection.begin()

        options = dict(bind=connection, binds={})
        session = db.create_scoped_session(options=options)
        db.session = session

        yield session

        session.remove()
        transaction.rollback()
        connection.close()
