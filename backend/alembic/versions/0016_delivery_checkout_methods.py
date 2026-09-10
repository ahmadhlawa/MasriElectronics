"""configure global delivery threshold and pickup orders

Revision ID: 0016_delivery_checkout_methods
Revises: 0015_brands
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_delivery_checkout_methods"
down_revision: Union[str, None] = "0015_brands"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("store_settings", sa.Column("free_delivery_threshold", sa.Numeric(12, 2), nullable=True))
    op.add_column(
        "orders",
        sa.Column("delivery_method", sa.String(length=16), nullable=False, server_default="delivery"),
    )
    # Per-city minimums and thresholds are retired; existing cities remain intact.
    op.execute("UPDATE delivery_areas SET min_order_amount = NULL, free_delivery_threshold = NULL")


def downgrade() -> None:
    op.drop_column("orders", "delivery_method")
    op.drop_column("store_settings", "free_delivery_threshold")
