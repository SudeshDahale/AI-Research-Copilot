"""sprint5_add_paper_analysis_columns

Revision ID: 7f3a9c21d4e8
Revises: 4836e1df5130
Create Date: 2026-08-14 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7f3a9c21d4e8'
down_revision: Union[str, None] = '4836e1df5130'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('papers', sa.Column('analysis_status', sa.String(length=20), nullable=False, server_default='pending'))
    op.add_column('papers', sa.Column('summary', sa.Text(), nullable=False, server_default='{}', comment='JSON-encoded SummarySchema dict'))
    op.add_column('papers', sa.Column('gaps', sa.Text(), nullable=False, server_default='[]', comment='JSON-encoded list of gap strings'))
    op.add_column('papers', sa.Column('future', sa.Text(), nullable=False, server_default='[]', comment='JSON-encoded list of future-work strings'))


def downgrade() -> None:
    op.drop_column('papers', 'future')
    op.drop_column('papers', 'gaps')
    op.drop_column('papers', 'summary')
    op.drop_column('papers', 'analysis_status')