"""Add typed category attributes and product model numbers.

Revision ID: 0019_appliance_attributes
Revises: 0018_hero_targets
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019_appliance_attributes"
down_revision: Union[str, None] = "0018_hero_targets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("model_number", sa.String(100), nullable=True))
    op.create_table(
        "attribute_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(80), nullable=False),
        sa.Column("label", sa.String(150), nullable=False),
        sa.Column("type", sa.String(16), nullable=False),
        sa.Column("unit", sa.String(40), nullable=True),
        sa.Column("enum_choices", sa.JSON(), nullable=False),
        sa.Column("filterable", sa.Boolean(), nullable=False),
        sa.Column("comparable", sa.Boolean(), nullable=False),
        sa.Column("show_on_card", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.UniqueConstraint("category_id", "key", name="uq_attribute_definition_category_key"),
        sa.CheckConstraint("type IN ('number', 'enum', 'boolean', 'text')", name="ck_attribute_definition_type"),
    )
    op.create_index("ix_attribute_definitions_category_id", "attribute_definitions", ["category_id"])
    op.create_table(
        "product_attribute_values",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attribute_definition_id", sa.Integer(), sa.ForeignKey("attribute_definitions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("number_value", sa.Numeric(14, 3), nullable=True),
        sa.Column("enum_value", sa.String(80), nullable=True),
        sa.Column("boolean_value", sa.Boolean(), nullable=True),
        sa.Column("text_value", sa.String(250), nullable=True),
        sa.UniqueConstraint("product_id", "attribute_definition_id", name="uq_product_attribute_value"),
        sa.CheckConstraint(
            "(CASE WHEN number_value IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN enum_value IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN boolean_value IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN text_value IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_product_attribute_one_typed_value",
        ),
    )
    for kind in ("number", "enum", "boolean", "text"):
        op.create_index(
            f"ix_product_attribute_{kind}", "product_attribute_values",
            ["attribute_definition_id", f"{kind}_value", "product_id"],
        )


def downgrade() -> None:
    op.drop_table("product_attribute_values")
    op.drop_index("ix_attribute_definitions_category_id", table_name="attribute_definitions")
    op.drop_table("attribute_definitions")
    op.drop_column("products", "model_number")
