from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PurchaseInvoiceLine(Base):
    __tablename__ = "purchase_invoice_lines"

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

    purchase_invoice_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    ingredient_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingredients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    line_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    ingredient_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ingredient_sku: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    quantity_purchased: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    purchase_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    pack_size_value: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    pack_size_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    net_quantity_for_costing: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    costing_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    line_total_ex_vat: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    vat_rate: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    vat_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    line_total_inc_vat: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    normalized_unit_cost_ex_vat: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False, default=0)
    normalized_unit_cost_inc_vat: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False, default=0)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    supplier_product_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant")
    company = relationship("Company")
    invoice = relationship("PurchaseInvoice", back_populates="lines")
    ingredient = relationship("Ingredient")

    __table_args__ = (
        Index("ix_purchase_invoice_lines_tenant_company_ingredient", "tenant_id", "company_id", "ingredient_name"),
    )
