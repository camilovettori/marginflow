"""create costing purchase invoices

Revision ID: b3c1d4e5f607
Revises: 2ec4f3a1b9c8
Create Date: 2026-04-23 22:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b3c1d4e5f607"
down_revision: Union[str, None] = "2ec4f3a1b9c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ingredients",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("default_unit_for_costing", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("latest_unit_cost_ex_vat", sa.Numeric(14, 6), nullable=True),
        sa.Column("latest_unit_cost_inc_vat", sa.Numeric(14, 6), nullable=True),
        sa.Column("latest_purchase_date", sa.Date(), nullable=True),
        sa.Column("latest_supplier_name", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "company_id", "normalized_name", name="uq_ingredients_company_normalized_name"),
    )
    op.create_index("ix_ingredients_company_id", "ingredients", ["company_id"], unique=False)
    op.create_index("ix_ingredients_tenant_company_category", "ingredients", ["tenant_id", "company_id", "category"], unique=False)
    op.create_index("ix_ingredients_tenant_id", "ingredients", ["tenant_id"], unique=False)

    op.create_table(
        "purchase_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_name", sa.String(length=255), nullable=False),
        sa.Column("invoice_number", sa.String(length=120), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("attachment_name", sa.String(length=255), nullable=True),
        sa.Column("vat_included", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("subtotal_ex_vat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("vat_total", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_inc_vat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "company_id", "supplier_name", "invoice_number", name="uq_purchase_invoices_supplier_number"),
    )
    op.create_index("ix_purchase_invoices_company_id", "purchase_invoices", ["company_id"], unique=False)
    op.create_index("ix_purchase_invoices_invoice_date", "purchase_invoices", ["invoice_date"], unique=False)
    op.create_index("ix_purchase_invoices_tenant_company_date", "purchase_invoices", ["tenant_id", "company_id", "invoice_date"], unique=False)
    op.create_index("ix_purchase_invoices_tenant_id", "purchase_invoices", ["tenant_id"], unique=False)

    op.create_table(
        "purchase_invoice_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purchase_invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ingredient_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("line_order", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("ingredient_name", sa.String(length=255), nullable=False),
        sa.Column("ingredient_sku", sa.String(length=120), nullable=True),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("quantity_purchased", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("purchase_unit", sa.String(length=20), nullable=False),
        sa.Column("pack_size_value", sa.Numeric(12, 3), nullable=True),
        sa.Column("pack_size_unit", sa.String(length=20), nullable=True),
        sa.Column("net_quantity_for_costing", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("costing_unit", sa.String(length=20), nullable=False),
        sa.Column("line_total_ex_vat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("vat_rate", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("vat_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("line_total_inc_vat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("normalized_unit_cost_ex_vat", sa.Numeric(14, 6), nullable=False, server_default="0"),
        sa.Column("normalized_unit_cost_inc_vat", sa.Numeric(14, 6), nullable=False, server_default="0"),
        sa.Column("brand", sa.String(length=120), nullable=True),
        sa.Column("supplier_product_name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["purchase_invoice_id"], ["purchase_invoices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_purchase_invoice_lines_company_id", "purchase_invoice_lines", ["company_id"], unique=False)
    op.create_index("ix_purchase_invoice_lines_ingredient_id", "purchase_invoice_lines", ["ingredient_id"], unique=False)
    op.create_index("ix_purchase_invoice_lines_purchase_invoice_id", "purchase_invoice_lines", ["purchase_invoice_id"], unique=False)
    op.create_index("ix_purchase_invoice_lines_tenant_company_ingredient", "purchase_invoice_lines", ["tenant_id", "company_id", "ingredient_name"], unique=False)
    op.create_index("ix_purchase_invoice_lines_tenant_id", "purchase_invoice_lines", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_purchase_invoice_lines_tenant_id", table_name="purchase_invoice_lines")
    op.drop_index("ix_purchase_invoice_lines_tenant_company_ingredient", table_name="purchase_invoice_lines")
    op.drop_index("ix_purchase_invoice_lines_purchase_invoice_id", table_name="purchase_invoice_lines")
    op.drop_index("ix_purchase_invoice_lines_ingredient_id", table_name="purchase_invoice_lines")
    op.drop_index("ix_purchase_invoice_lines_company_id", table_name="purchase_invoice_lines")
    op.drop_table("purchase_invoice_lines")

    op.drop_index("ix_purchase_invoices_tenant_id", table_name="purchase_invoices")
    op.drop_index("ix_purchase_invoices_tenant_company_date", table_name="purchase_invoices")
    op.drop_index("ix_purchase_invoices_invoice_date", table_name="purchase_invoices")
    op.drop_index("ix_purchase_invoices_company_id", table_name="purchase_invoices")
    op.drop_table("purchase_invoices")

    op.drop_index("ix_ingredients_tenant_id", table_name="ingredients")
    op.drop_index("ix_ingredients_tenant_company_category", table_name="ingredients")
    op.drop_index("ix_ingredients_company_id", table_name="ingredients")
    op.drop_table("ingredients")
