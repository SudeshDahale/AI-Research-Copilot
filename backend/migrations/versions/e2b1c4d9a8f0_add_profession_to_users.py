"""add profession to users

Revision ID: e2b1c4d9a8f0
Revises: b4d8f21a6c93
Create Date: 2026-11-01 16:45:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e2b1c4d9a8f0'
down_revision: Union[str, None] = 'b4d8f21a6c93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('profession', sa.String(length=120), nullable=True, server_default='Academic Researcher')
    )


def downgrade() -> None:
    op.drop_column('users', 'profession')

