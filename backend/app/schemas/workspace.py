from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class WorkspaceBase(BaseModel):
    name: str = Field(..., max_length=120, description="The name of the workspace")


class WorkspaceCreate(WorkspaceBase):
    paper_ids: list[str] = Field(default_factory=list, description="Initial list of paper IDs to add")


class WorkspaceUpdate(BaseModel):
    name: str = Field(..., max_length=120, description="The new name of the workspace")


class WorkspacePaperAdd(BaseModel):
    paper_ids: list[str] = Field(..., description="List of paper IDs to add")


class WorkspaceOut(WorkspaceBase):
    id: uuid.UUID
    user_id: uuid.UUID
    paper_ids: list[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
