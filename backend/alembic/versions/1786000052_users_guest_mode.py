"""users: guest mode

Guest accounts (spec 2026-11-20 mehmon rejimi): `is_guest`, `last_seen_at`
for the stale-guest cleanup, and `registered_at` — when a row became a real
account. Every existing row is a registered account, so its `registered_at`
is its `created_at`.

Revision ID: 1786000052
Revises: 1786000051
Create Date: 2026-11-20 00:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "1786000052"
down_revision: Union[str, None] = "1786000051"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_guest", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("CREATE INDEX ix_users_is_guest ON users (id) WHERE is_guest")
    op.execute("UPDATE users SET registered_at = created_at")


def downgrade() -> None:
    # Guests go first: without is_guest they would read as registered users
    # with no identity at all. Their rooms etc. go with them (ON DELETE CASCADE).
    op.execute("DELETE FROM users WHERE is_guest")
    op.execute("DROP INDEX IF EXISTS ix_users_is_guest")
    op.drop_column("users", "registered_at")
    op.drop_column("users", "last_seen_at")
    op.drop_column("users", "is_guest")
