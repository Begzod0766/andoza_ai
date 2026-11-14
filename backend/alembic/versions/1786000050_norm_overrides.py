"""norm_overrides and norm_override_log: prices an admin set over the three norm files

The files (app/data/*_norms.json) stay the defaults; these rows are laid over them
(app.services.norm_overrides, spec 2026-11-15).

Revision ID: 1786000050
Revises: 1786000049
Create Date: 2026-11-15 00:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "1786000050"
down_revision: Union[str, None] = "1786000049"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "norm_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("file", sa.String(32), nullable=False),
        sa.Column("path", sa.String(120), nullable=False),
        sa.Column("value", sa.Numeric(14, 4), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("file", "path", name="uq_norm_overrides_file_path"),
    )
    op.create_table(
        "norm_override_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("file", sa.String(32), nullable=False),
        sa.Column("path", sa.String(120), nullable=False),
        sa.Column("old_value", sa.Numeric(14, 4), nullable=True),
        sa.Column("new_value", sa.Numeric(14, 4), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_norm_override_log_created_at", "norm_override_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_norm_override_log_created_at", table_name="norm_override_log")
    op.drop_table("norm_override_log")
    op.drop_table("norm_overrides")
