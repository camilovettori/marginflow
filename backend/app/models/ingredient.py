from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Ingredient(Base):
    __tablename__ = "ingredients"

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

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    default_unit_for_costing: Mapped[str] = mapped_column(String(20), nullable=False, default="unit")
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    latest_unit_cost_ex_vat: Mapped[float | None] = mapped_column(Numeric(14, 6), nullable=True)
    latest_unit_cost_inc_vat: Mapped[float | None] = mapped_column(Numeric(14, 6), nullable=True)
    latest_purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    latest_supplier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    tenant = relationship("Tenant")
    company = relationship("Company")

    __table_args__ = (
        UniqueConstraint("tenant_id", "company_id", "normalized_name", name="uq_ingredients_company_normalized_name"),
        Index("ix_ingredients_tenant_company_category", "tenant_id", "company_id", "category"),
    )
