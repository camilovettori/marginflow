"""create recipes costing tables

Revision ID: c4d2e5f70819
Revises: b3c1d4e5f607
Create Date: 2026-04-24 00:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c4d2e5f70819"
down_revision: Union[str, None] = "b3c1d4e5f607"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipe_name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("yield_quantity", sa.Numeric(12, 3), nullable=False, server_default="1"),
        sa.Column("yield_unit", sa.String(length=20), nullable=False),
        sa.Column("portion_size", sa.Numeric(12, 3), nullable=True),
        sa.Column("wastage_percent", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("labour_cost_override", sa.Numeric(12, 2), nullable=True),
        sa.Column("packaging_cost_override", sa.Numeric(12, 2), nullable=True),
        sa.Column("target_food_cost_percent", sa.Numeric(6, 2), nullable=True),
        sa.Column("selling_price_ex_vat", sa.Numeric(12, 2), nullable=True),
        sa.Column("selling_price_inc_vat", sa.Numeric(12, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "company_id", "normalized_name", name="uq_recipes_company_normalized_name"),
    )
    op.create_index("ix_recipes_company_id", "recipes", ["company_id"], unique=False)
    op.create_index("ix_recipes_tenant_company_category", "recipes", ["tenant_id", "company_id", "category"], unique=False)
    op.create_index("ix_recipes_tenant_id", "recipes", ["tenant_id"], unique=False)

    op.create_table(
        "recipe_ingredients",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipe_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ingredient_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("line_order", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("ingredient_name", sa.String(length=255), nullable=False),
        sa.Column("quantity_required", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("unit_used", sa.String(length=20), nullable=False),
        sa.Column("normalized_unit_cost_ex_vat", sa.Numeric(14, 6), nullable=True),
        sa.Column("normalized_unit_cost_inc_vat", sa.Numeric(14, 6), nullable=True),
        sa.Column("line_cost_ex_vat", sa.Numeric(12, 2), nullable=True),
        sa.Column("line_cost_inc_vat", sa.Numeric(12, 2), nullable=True),
        sa.Column("missing_price", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("source_purchase_date", sa.Date(), nullable=True),
        sa.Column("source_supplier_name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("recipe_id", "line_order", name="uq_recipe_ingredients_recipe_order"),
    )
    op.create_index("ix_recipe_ingredients_company_id", "recipe_ingredients", ["company_id"], unique=False)
    op.create_index("ix_recipe_ingredients_ingredient_id", "recipe_ingredients", ["ingredient_id"], unique=False)
    op.create_index("ix_recipe_ingredients_recipe_id", "recipe_ingredients", ["recipe_id"], unique=False)
    op.create_index("ix_recipe_ingredients_tenant_company_recipe", "recipe_ingredients", ["tenant_id", "company_id", "recipe_id"], unique=False)
    op.create_index("ix_recipe_ingredients_tenant_id", "recipe_ingredients", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_recipe_ingredients_tenant_id", table_name="recipe_ingredients")
    op.drop_index("ix_recipe_ingredients_tenant_company_recipe", table_name="recipe_ingredients")
    op.drop_index("ix_recipe_ingredients_recipe_id", table_name="recipe_ingredients")
    op.drop_index("ix_recipe_ingredients_ingredient_id", table_name="recipe_ingredients")
    op.drop_index("ix_recipe_ingredients_company_id", table_name="recipe_ingredients")
    op.drop_table("recipe_ingredients")

    op.drop_index("ix_recipes_tenant_id", table_name="recipes")
    op.drop_index("ix_recipes_tenant_company_category", table_name="recipes")
    op.drop_index("ix_recipes_company_id", table_name="recipes")
    op.drop_table("recipes")
