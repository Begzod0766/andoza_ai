"""wallpapers: moderation status

A shop owner can now add an oboy that waits for an admin. Every existing row
(and every plain studio upload) stays approved; only the seller flow creates
`pending` rows. Same shape as furniture.status / moderation_note.

Revision ID: 1786000050
Revises: 1786000049
Create Date: 2026-11-15 00:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "1786000050"
down_revision: Union[str, None] = "1786000049"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "wallpapers",
        sa.Column("status", sa.String(length=20), server_default="approved", nullable=False,
                  comment="pending | approved | rejected"),
    )
    op.add_column(
        "wallpapers",
        sa.Column("moderation_note", sa.String(length=300), nullable=True,
                  comment="Why an admin rejected it, shown to the shop owner"),
    )
    op.create_index(op.f("ix_wallpapers_status"), "wallpapers", ["status"], unique=False)
    op.create_check_constraint(
        "ck_wallpapers_status", "wallpapers", "status IN ('pending', 'approved', 'rejected')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_wallpapers_status", "wallpapers", type_="check")
    op.drop_index(op.f("ix_wallpapers_status"), table_name="wallpapers")
    op.drop_column("wallpapers", "moderation_note")
    op.drop_column("wallpapers", "status")
