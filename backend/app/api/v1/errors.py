"""Helpers to translate domain errors into HTTP responses."""

from fastapi import HTTPException, status

from app.shared.exceptions import BusinessRuleError, NotFoundError


def domain_error_to_http(exc: Exception) -> HTTPException:
    """Map a domain exception to an HTTP exception."""

    if isinstance(exc, NotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    if isinstance(exc, BusinessRuleError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Erro interno",
    )
