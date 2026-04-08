"""add unify order id to zoho sales ledger

Revision ID: 7a6e3fb2d4f1
Revises: 4f8c9a2e7c31
Create Date: 2026-03-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7a6e3fb2d4f1"
down_revision: Union[str, Sequence[str], None] = "4f8c9a2e7c31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("zoho_sales_invoices", sa.Column("unify_order_id", sa.Text(), nullable=True))
    op.create_unique_constraint(
        "uq_zoho_sales_invoices_company_unify_order",
        "zoho_sales_invoices",
        ["tenant_id", "company_id", "unify_order_id"],
    )
    op.create_index(
        "ix_zoho_sales_invoices_tenant_company_unify_order",
        "zoho_sales_invoices",
        ["tenant_id", "company_id", "unify_order_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_zoho_sales_invoices_tenant_company_unify_order", table_name="zoho_sales_invoices")
    op.drop_constraint(
        "uq_zoho_sales_invoices_company_unify_order",
        "zoho_sales_invoices",
        type_="unique",
    )
    op.drop_column("zoho_sales_invoices", "unify_order_id")
