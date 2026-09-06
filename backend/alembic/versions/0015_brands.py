"""add brands and optional product brand

Revision ID: 0015_brands
Revises: 0014_remove_content
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_brands"
down_revision: Union[str, None] = "0014_remove_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "brands",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("brands", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_brands_name"), ["name"], unique=True)
    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.add_column(sa.Column("brand_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_products_brand_id_brands", "brands", ["brand_id"], ["id"], ondelete="RESTRICT"
        )
        batch_op.create_index(batch_op.f("ix_products_brand_id"), ["brand_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_products_brand_id"))
        batch_op.drop_constraint("fk_products_brand_id_brands", type_="foreignkey")
        batch_op.drop_column("brand_id")
    with op.batch_alter_table("brands", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_brands_name"))
    op.drop_table("brands")
