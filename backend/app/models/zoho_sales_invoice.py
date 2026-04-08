from __future__ import annotations

from datetime import datetime, date
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ZohoSalesInvoice(Base):
    __tablename__ = "zoho_sales_invoices"

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

    zoho_invoice_id: Mapped[str] = mapped_column(String(120), nullable=False)
    unify_order_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    customer_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="EUR")

    total_inc_vat: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_ex_vat: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    sync_source: Mapped[str] = mapped_column(String(40), nullable=False, default="zoho")
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    tenant = relationship("Tenant")
    company = relationship("Company")
    items = relationship(
        "ZohoSalesInvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "company_id", "zoho_invoice_id", name="uq_zoho_sales_invoices_company_invoice"),
        UniqueConstraint("tenant_id", "company_id", "unify_order_id", name="uq_zoho_sales_invoices_company_unify_order"),
        Index("ix_zoho_sales_invoices_tenant_company_date", "tenant_id", "company_id", "invoice_date"),
        Index("ix_zoho_sales_invoices_tenant_company_customer", "tenant_id", "company_id", "customer_id"),
        Index("ix_zoho_sales_invoices_tenant_company_unify_order", "tenant_id", "company_id", "unify_order_id"),
    )
