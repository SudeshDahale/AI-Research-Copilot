from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.config import settings

# --- Passwords ---
# bcrypt has a hard 72-byte input limit; truncate defensively instead of
# raising on long (but otherwise valid) passwords.
_BCRYPT_MAX_BYTES = 72


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password for storage. Never store `plain_password` itself."""
    password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    try:
        return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
    except ValueError:
        # Malformed hash in the DB (shouldn't happen outside of bad seed data).
        return False


# --- JWTs ---
# Kept intentionally minimal: one claim (`sub`) plus standard `exp`/`iat`.
# `sub` is the user's id as a string, per the JWT spec (`sub` must be a string).


def create_access_token(user_id: uuid.UUID, expires_delta: timedelta | None = None) -> str:
    """Issue a signed JWT for `user_id`. Expiry defaults to settings.jwt_expire_minutes."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


class InvalidTokenError(Exception):
    """Raised when a token is missing, malformed, expired, or has a bad signature."""


def decode_token(token: str) -> uuid.UUID:
    """Verify a JWT and return the user id encoded in it, or raise InvalidTokenError."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    subject = payload.get("sub")
    if subject is None:
        raise InvalidTokenError("Token has no subject claim")

    try:
        return uuid.UUID(subject)
    except (ValueError, AttributeError) as exc:
        raise InvalidTokenError("Token subject is not a valid user id") from exc