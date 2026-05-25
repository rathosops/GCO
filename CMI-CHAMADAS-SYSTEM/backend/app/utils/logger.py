"""
Configuração de logging
Sistema de Chamadas - CMI
"""
from loguru import logger
import sys
from app.config import settings


def setup_logger():
    """
    Configura o logger da aplicação
    """
    # Remover handler padrão
    logger.remove()
    
    # Formato do log
    if settings.LOG_FORMAT == "json":
        log_format = (
            "{"
            '"time": "{time:YYYY-MM-DD HH:mm:ss.SSS}", '
            '"level": "{level}", '
            '"message": "{message}", '
            '"file": "{file}", '
            '"function": "{function}", '
            '"line": {line}'
            "}"
        )
    else:
        log_format = (
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        )
    
    # Handler para console
    logger.add(
        sys.stdout,
        format=log_format,
        level=settings.LOG_LEVEL,
        colorize=settings.LOG_FORMAT != "json",
        backtrace=True,
        diagnose=True,
    )
    
    # Handler para arquivo (se configurado)
    if settings.LOG_FILE:
        logger.add(
            settings.LOG_FILE,
            format=log_format,
            level=settings.LOG_LEVEL,
            rotation=settings.LOG_ROTATION,
            retention=settings.LOG_RETENTION,
            compression="zip",
            backtrace=True,
            diagnose=True,
        )
    
    return logger