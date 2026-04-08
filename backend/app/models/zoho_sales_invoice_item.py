from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ZohoSalesInvoiceItem(Base):
    __tablename__ = "zoho_sales_invoice_items"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    tenant_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    company_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    zoho_sales_invoice_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("zoho_sales_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    line_total_ex_vat: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    line_total_inc_vat: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant")
    company = relationship("Company")
    invoice = relationship("ZohoSalesInvoice", back_populates="items")

    __table_args__ = (
        Index("ix_zoho_sales_invoice_items_tenant_company_item", "tenant_id", "company_id", "item_name"),
    )
