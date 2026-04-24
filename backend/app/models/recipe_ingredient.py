from __future__ import annotations

from datetime import datetime, date
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

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

    recipe_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recipes.id", ondelete="CASCADE"),
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
    quantity_required: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    unit_used: Mapped[str] = mapped_column(String(20), nullable=False)
    normalized_unit_cost_ex_vat: Mapped[float | None] = mapped_column(Numeric(14, 6), nullable=True)
    normalized_unit_cost_inc_vat: Mapped[float | None] = mapped_column(Numeric(14, 6), nullable=True)
    line_cost_ex_vat: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    line_cost_inc_vat: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    missing_price: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source_purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_supplier_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant")
    company = relationship("Company")
    recipe = relationship("Recipe", back_populates="ingredients")
    ingredient = relationship("Ingredient")

    __table_args__ = (
        UniqueConstraint("recipe_id", "line_order", name="uq_recipe_ingredients_recipe_order"),
        Index("ix_recipe_ingredients_tenant_company_recipe", "tenant_id", "company_id", "recipe_id"),
    )
