from __future__ import annotations

from fastapi import Cookie, Header, HTTPException, status
from fastapi.params import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.core.security import InvalidTokenError, decode_token
from app.db.session import get_db
from app.models.user import User

COOKIE_NAME = "access_token"


def _extract_token(
    access_token: str | None,
    authorization: str | None,
) -> str | None:
    """Prefer the httpOnly cookie (what the frontend uses); accept a Bearer
    header too, so the API is usable from tools like curl/Postman/tests."""
    if access_token:
        return access_token
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[len("bearer "):].strip()
    return None


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """FastAPI dependency: resolves the caller's User or raises 401.
    Every protected route from Sprint 2 onward takes this as a dependency."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = _extract_token(access_token, authorization)
    if token is None:
        raise unauthorized

    try:
        user_id = decode_token(token)
    except InvalidTokenError:
        raise unauthorized

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise unauthorized

    return user


async def get_current_user_optional(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> User | None:
    """FastAPI dependency: resolves the caller's User if token is present, else returns None."""
    token = _extract_token(access_token, authorization)
    if token is None:
        return None

    try:
        user_id = decode_token(token)
    except InvalidTokenError:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()