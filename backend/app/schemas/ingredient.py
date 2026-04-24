from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer


class IngredientUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    default_unit_for_costing: str = Field(min_length=1, max_length=20)
    category: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool = True


class IngredientResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    name: str
    normalized_name: str
    default_unit_for_costing: str
    category: str | None = None
    latest_unit_cost_ex_vat: float | None = None
    latest_unit_cost_inc_vat: float | None = None
    latest_purchase_date: date | None = None
    latest_supplier_name: str | None = None
    notes: str | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    purchase_count: int = 0

    @field_serializer("latest_purchase_date")
    def serialize_date(self, value: date | None) -> str | None:
        return value.isoformat() if value else None

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, value: datetime | None) -> str | None:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True


class IngredientPurchaseHistoryItem(BaseModel):
    line_id: UUID
    invoice_id: UUID
    invoice_number: str
    invoice_date: date
    supplier_name: str
    quantity_purchased: float
    purchase_unit: str
    net_quantity_for_costing: float
    costing_unit: str
    line_total_ex_vat: float
    line_total_inc_vat: float
    normalized_unit_cost_ex_vat: float
    normalized_unit_cost_inc_vat: float
    brand: str | None = None
    supplier_product_name: str | None = None

    @field_serializer("invoice_date")
    def serialize_invoice_date(self, value: date) -> str:
        return value.isoformat()


class IngredientDetailResponse(BaseModel):
    ingredient: IngredientResponse
    recent_purchases: list[IngredientPurchaseHistoryItem]


class IngredientListResponse(BaseModel):
    company_id: UUID
    total_ingredients: int
    active_ingredients: int
    inactive_ingredients: int
    missing_price_ingredients: int
    ingredients: list[IngredientResponse]

    @field_serializer("company_id")
    def serialize_company_id(self, value: UUID) -> str:
        return str(value)
