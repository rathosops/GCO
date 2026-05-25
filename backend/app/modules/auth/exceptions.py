"""Domain exceptions for authentication."""


class AuthError(Exception):
    """Base exception for authentication failures."""


class InvalidCredentialsError(AuthError):
    """Credentials do not match an active user."""


class InactiveUserError(AuthError):
    """User exists but cannot authenticate because it is inactive."""


class UserAlreadyExistsError(AuthError):
    """A user with the same username already exists."""

