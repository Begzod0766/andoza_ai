"""ustalar: drop the random stock faces the seeds assigned (pravatar)

The seeds gave every demo usta a pravatar.cc photo keyed by phone, so faces did
not match names (a woman's photo on "Sardor Karimov"). The seeds no longer set
one; this clears the rows they already wrote so the apps show the initial.
Photos an usta uploaded live on our own storage and are not touched.

Revision ID: 1786000049
Revises: 1786000048
Create Date: 2026-11-12 00:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "1786000049"
down_revision: Union[str, None] = "1786000048"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE ustalar SET avatar_url = NULL "
        "WHERE avatar_url LIKE 'https://i.pravatar.cc/%'"
    )


def downgrade() -> None:
    # The stock faces were wrong; there is nothing worth restoring.
    pass
