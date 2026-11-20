"""stores: address and map point

The estimate page groups lines by shop and shows each shop on a map, so a shop
gets a street address and a point (lat/lng). All nullable: every existing shop
has none until its owner or an admin enters it — the page then shows the
district only and leaves the shop off the map.

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
    op.add_column("stores", sa.Column("address", sa.String(length=300), nullable=True,
                                      comment="Street address shown on the estimate's shop card"))
    op.add_column("stores", sa.Column("lat", sa.Numeric(9, 6), nullable=True, comment="Map point latitude"))
    op.add_column("stores", sa.Column("lng", sa.Numeric(9, 6), nullable=True, comment="Map point longitude"))


def downgrade() -> None:
    op.drop_column("stores", "lng")
    op.drop_column("stores", "lat")
    op.drop_column("stores", "address")
