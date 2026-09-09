"""add structured hero targets

Revision ID: 0018_hero_targets
Revises: 0017_simple_product_choices
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018_hero_targets"
down_revision: Union[str, None] = "0017_simple_product_choices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hero_slides", sa.Column("target_type", sa.String(24), nullable=True))
    op.add_column("hero_slides", sa.Column("target_slug", sa.String(160), nullable=True))


def downgrade() -> None:
    op.drop_column("hero_slides", "target_slug")
    op.drop_column("hero_slides", "target_type")
