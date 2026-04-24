from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Recipe(Base):
    __tablename__ = "recipes"

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

    recipe_name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    yield_quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=1)
    yield_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    portion_size: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    wastage_percent: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    labour_cost_override: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    packaging_cost_override: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    target_food_cost_percent: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    selling_price_ex_vat: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    selling_price_inc_vat: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
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
    ingredients = relationship(
        "RecipeIngredient",
        back_populates="recipe",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="RecipeIngredient.line_order",
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "company_id", "normalized_name", name="uq_recipes_company_normalized_name"),
        Index("ix_recipes_tenant_company_category", "tenant_id", "company_id", "category"),
    )
