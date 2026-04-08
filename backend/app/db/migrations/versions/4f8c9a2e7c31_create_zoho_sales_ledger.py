"""create zoho sales ledger

Revision ID: 4f8c9a2e7c31
Revises: 80091693e6b5
Create Date: 2026-03-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "4f8c9a2e7c31"
down_revision: Union[str, Sequence[str], None] = "80091693e6b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "zoho_sales_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zoho_invoice_id", sa.String(length=120), nullable=False),
        sa.Column("invoice_number", sa.String(length=80), nullable=True),
        sa.Column("customer_id", sa.String(length=120), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="EUR"),
        sa.Column("total_inc_vat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_ex_vat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("sync_source", sa.String(length=40), nullable=False, server_default="zoho"),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "company_id", "zoho_invoice_id", name="uq_zoho_sales_invoices_company_invoice"),
    )
    op.create_index("ix_zoho_sales_invoices_tenant_id", "zoho_sales_invoices", ["tenant_id"])
    op.create_index("ix_zoho_sales_invoices_company_id", "zoho_sales_invoices", ["company_id"])
    op.create_index(
        "ix_zoho_sales_invoices_tenant_company_date",
        "zoho_sales_invoices",
        ["tenant_id", "company_id", "invoice_date"],
    )
    op.create_index(
        "ix_zoho_sales_invoices_tenant_company_customer",
        "zoho_sales_invoices",
        ["tenant_id", "company_id", "customer_id"],
    )

    op.create_table(
        "zoho_sales_invoice_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zoho_sales_invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", sa.String(length=120), nullable=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("rate", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("line_total_ex_vat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("line_total_inc_vat", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["zoho_sales_invoice_id"], ["zoho_sales_invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_zoho_sales_invoice_items_tenant_id", "zoho_sales_invoice_items", ["tenant_id"])
    op.create_index("ix_zoho_sales_invoice_items_company_id", "zoho_sales_invoice_items", ["company_id"])
    op.create_index(
        "ix_zoho_sales_invoice_items_zoho_sales_invoice_id",
        "zoho_sales_invoice_items",
        ["zoho_sales_invoice_id"],
    )
    op.create_index(
        "ix_zoho_sales_invoice_items_tenant_company_item",
        "zoho_sales_invoice_items",
        ["tenant_id", "company_id", "item_name"],
    )


def downgrade() -> None:
    op.drop_index("ix_zoho_sales_invoice_items_tenant_company_item", table_name="zoho_sales_invoice_items")
    op.drop_index("ix_zoho_sales_invoice_items_zoho_sales_invoice_id", table_name="zoho_sales_invoice_items")
    op.drop_index("ix_zoho_sales_invoice_items_company_id", table_name="zoho_sales_invoice_items")
    op.drop_index("ix_zoho_sales_invoice_items_tenant_id", table_name="zoho_sales_invoice_items")
    op.drop_table("zoho_sales_invoice_items")

    op.drop_index("ix_zoho_sales_invoices_tenant_company_customer", table_name="zoho_sales_invoices")
    op.drop_index("ix_zoho_sales_invoices_tenant_company_date", table_name="zoho_sales_invoices")
    op.drop_index("ix_zoho_sales_invoices_company_id", table_name="zoho_sales_invoices")
    op.drop_index("ix_zoho_sales_invoices_tenant_id", table_name="zoho_sales_invoices")
    op.drop_table("zoho_sales_invoices")
