"""SQLAlchemy model for a durable Paper row.

A paper is persisted to this table only when a user explicitly adds it to a
workspace (Sprint 4+).  Search results remain ephemeral — they live in Redis
for a short TTL and are never written to the database on their own.

This separation is deliberate:
  - Ephemeral (Redis): cheap, fast, auto-expiring search results
  - Durable (Postgres): papers the user cares about and wants to keep
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

from pgvector.sqlalchemy import Vector

EMBEDDING_DIM = 512  # must match Settings.embedding_dim and the Alembic migration below

class Paper(Base):
    """A research paper that has been saved to at least one workspace."""

    __tablename__ = "papers"

    # Primary key — matches the arXiv / Semantic Scholar ID strings we already
    # use throughout the app (e.g. "arx-2411-01823", "s2-abc123")
    id: Mapped[str] = mapped_column(String(120), primary_key=True)

    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    abstract: Mapped[str] = mapped_column(Text, nullable=False, default="")
    authors: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]",
        comment="JSON-encoded list of author name strings"
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False, default=2024)
    journal: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    citations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    doi: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    pdf_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]",
        comment="JSON-encoded list of tag strings"
    )

    # Sprint 6 — semantic embedding of the abstract. NULL until the paper
    # has gone through vector_service.embed_paper(). Powers "similar papers"
    # and the semantic term in ranking_service's blend.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    # Timestamps
    first_saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"Paper(id={self.id!r}, title={self.title[:40]!r})"
