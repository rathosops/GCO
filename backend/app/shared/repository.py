"""Small repository base classes shared by domain modules."""

from typing import TypeVar

from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


class Repository[ModelT]:
    """Base repository with session ownership kept outside the class."""

    model: type[ModelT]

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, model_id: int) -> ModelT | None:
        """Return one model by primary key."""

        return self.session.get(self.model, model_id)

    def add(self, model: ModelT) -> ModelT:
        """Add a model to the current unit of work."""

        self.session.add(model)
        return model
