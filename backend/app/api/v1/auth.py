from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import Annotated

from app.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.dependencies import COOKIE_NAME, get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserOut

router = APIRouter()

_COOKIE_MAX_AGE = settings.jwt_expire_minutes * 60


def _set_auth_cookie(response: Response, user: User) -> None:
    token = create_access_token(user.id)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        # Dev runs the frontend and backend on http://localhost over different
        # ports; `secure=True` would silently drop the cookie there. Flip this
        # on once the app is served over HTTPS (Sprint 10 / deployment).
        secure=settings.environment == "production",
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    username = (body.username or body.name or "").strip()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username is required",
        )

    clean_email = str(body.email).lower().strip()
    existing = await db.execute(
        select(User).where(
            or_(
                func.lower(User.email) == clean_email,
                func.lower(User.name) == username.lower(),
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email or username already exists",
        )

    profession = (body.profession or "Academic Researcher").strip()
    user = User(
        id=uuid.uuid4(),
        email=clean_email,
        name=username,
        hashed_password=hash_password(body.password),
        profession=profession,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    _set_auth_cookie(response, user)
    return user


@router.post("/login", response_model=UserOut)
async def login(
    body: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username/email or password",
    )

    identifier = (body.identifier or body.username or body.email or "").strip()
    if not identifier:
        raise invalid_credentials

    result = await db.execute(
        select(User).where(
            or_(
                func.lower(User.email) == identifier.lower(),
                func.lower(User.name) == identifier.lower(),
            )
        )
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise invalid_credentials

    _set_auth_cookie(response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user
