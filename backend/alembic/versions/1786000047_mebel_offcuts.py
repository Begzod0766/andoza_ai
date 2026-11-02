"""mebel: offcut stock, and when a project was cut

Revision ID: 1786000047
Revises: 1786000046
Create Date: 2026-11-02 00:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "1786000047"
down_revision: Union[str, None] = "1786000046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mebel_offcuts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("material", sa.String(16), nullable=False),
        sa.Column("material_id", sa.String(64), nullable=True),
        sa.Column("thickness", sa.Integer(), nullable=False),
        sa.Column("length", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("source_project_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("furniture_projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_mebel_offcuts_user_id", "mebel_offcuts", ["user_id"])
    # ON DELETE SET NULL looks rows up by their source
    op.create_index("ix_mebel_offcuts_source_project_id", "mebel_offcuts", ["source_project_id"])
    op.add_column("furniture_projects", sa.Column("cut_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("furniture_projects", "cut_at")
    op.drop_index("ix_mebel_offcuts_source_project_id", table_name="mebel_offcuts")
    op.drop_index("ix_mebel_offcuts_user_id", table_name="mebel_offcuts")
    op.drop_table("mebel_offcuts")
