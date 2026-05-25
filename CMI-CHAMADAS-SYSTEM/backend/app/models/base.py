"""
Base models e mixins
Sistema de Chamadas - CMI
"""
from sqlalchemy import Column, Integer, DateTime, func
from sqlalchemy.ext.declarative import declared_attr
from app.database import Base


class TimestampMixin:
    """
    Mixin para adicionar timestamps automáticos
    """
    @declared_attr
    def created_at(cls):
        return Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False
        )
    
    @declared_attr
    def updated_at(cls):
        return Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False
        )


class BaseModel(Base, TimestampMixin):
    """
    Modelo base para todas as tabelas
    """
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)