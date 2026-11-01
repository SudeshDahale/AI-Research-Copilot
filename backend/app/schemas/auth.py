from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str | None = Field(default=None, min_length=1, max_length=120)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    profession: str | None = Field(default="Academic Researcher", max_length=120)


class LoginRequest(BaseModel):
    email: str | None = None
    username: str | None = None
    identifier: str | None = None
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: str
    profession: str | None = None
    created_at: datetime
