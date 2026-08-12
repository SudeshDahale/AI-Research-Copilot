from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class WorkspacePaper(Base):
    """An association mapping between a workspace and paper IDs.
    Since papers are not yet stored in a database table (ephemeral in Sprint 2-3,
    and durable in Sprint 4+), we store paper IDs as plain strings."""

    __tablename__ = "workspace_papers"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    paper_id: Mapped[str] = mapped_column(String(100), primary_key=True)


class Workspace(Base):
    """A research workspace owned by a registered User, grouping curated papers."""

    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped[User] = relationship(back_populates="workspaces")
    workspace_papers: Mapped[list[WorkspacePaper]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def paper_ids(self) -> list[str]:
        return [wp.paper_id for wp in self.workspace_papers]

    def __repr__(self) -> str:  # pragma: no cover
        return f"Workspace(id={self.id!r}, name={self.name!r}, user_id={self.user_id!r})"
