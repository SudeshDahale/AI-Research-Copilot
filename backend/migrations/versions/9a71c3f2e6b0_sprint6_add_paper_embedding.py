"""sprint6_add_paper_embedding

Revision ID: 9a71c3f2e6b0
Revises: 4836e1df5130
Create Date: 2026-08-14 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


revision: str = '9a71c3f2e6b0'
down_revision: Union[str, None] = '7f3a9c21d4e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column('papers', sa.Column('embedding', Vector(512), nullable=True))
    # HNSW index for fast cosine-distance lookups. Fine to create even while
    # the column is all-NULL — rows just get indexed as embeddings land.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_papers_embedding_cosine "
        "ON papers USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_papers_embedding_cosine")
    op.drop_column('papers', 'embedding')