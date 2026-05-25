"""
Model espelho da tabela procedimentos existente no CMI-PCG-SERVER.

Este modelo NÃO cria a tabela, apenas permite que o SQLAlchemy reconheça as FKs.
"""

from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Procedimentos(Base):
    """
    Modelo espelho da tabela procedimentos do CMI-PCG-SERVER.

    IMPORTANTE: Esta tabela já existe no banco e é gerenciada pelo sistema principal.
    """

    __tablename__ = "procedimentos"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Procedimento {self.nome}>"
