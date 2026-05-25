"""Shared domain exceptions."""


class DomainError(Exception):
    """Base exception for business-domain failures."""


class NotFoundError(DomainError):
    """Requested entity does not exist."""


class BusinessRuleError(DomainError):
    """Operation violates a domain rule."""
