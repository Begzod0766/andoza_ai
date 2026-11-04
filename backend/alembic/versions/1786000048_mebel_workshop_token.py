"""mebel: a revocable workshop token per project (part labels open without an account)

Revision ID: 1786000048
Revises: 1786000047
Create Date: 2026-11-04 00:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "1786000048"
down_revision: Union[str, None] = "1786000047"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("furniture_projects", sa.Column("workshop_token", sa.String(64), nullable=True))
    op.create_index("ix_furniture_projects_workshop_token", "furniture_projects", ["workshop_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_furniture_projects_workshop_token", table_name="furniture_projects")
    op.drop_column("furniture_projects", "workshop_token")
