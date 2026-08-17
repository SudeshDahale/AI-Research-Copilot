from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DocKind = Literal["Report", "Literature review", "Summary", "Outline", "Brief"]


class DocumentCreate(BaseModel):
    workspace_id: uuid.UUID
    title: str = Field(..., max_length=200)
    kind: DocKind
    prompt: str


class DocumentOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    kind: str
    prompt: str
    content: str
    status: str
    words: int
    error: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True