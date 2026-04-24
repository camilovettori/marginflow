from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer, model_validator


class PurchaseInvoiceLineCreate(BaseModel):
    ingredient_name: str = Field(min_length=1, max_length=255)
    ingredient_sku: str | None = Field(default=None, max_length=120)
    category: str | None = Field(default=None, max_length=120)
    quantity_purchased: float = Field(gt=0)
    purchase_unit: str = Field(min_length=1, max_length=20)
    pack_size_value: float | None = Field(default=None, gt=0)
    pack_size_unit: str | None = Field(default=None, max_length=20)
    net_quantity_for_costing: float = Field(gt=0)
    costing_unit: str = Field(min_length=1, max_length=20)
    line_total_ex_vat: float = Field(ge=0)
    vat_rate: float = Field(ge=0, le=100)
    line_total_inc_vat: float | None = Field(default=None, ge=0)
    brand: str | None = Field(default=None, max_length=120)
    supplier_product_name: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_pack_size(self) -> "PurchaseInvoiceLineCreate":
        if (self.pack_size_value is None) != (self.pack_size_unit is None):
            raise ValueError("pack_size_value and pack_size_unit must be provided together")
        return self


class PurchaseInvoiceCreate(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=255)
    invoice_number: str = Field(min_length=1, max_length=120)
    invoice_date: date
    due_date: date | None = None
    currency: str = Field(default="EUR", min_length=3, max_length=10)
    notes: str | None = Field(default=None, max_length=2000)
    vat_included: bool = False
    subtotal_ex_vat: float | None = Field(default=None, ge=0)
    vat_total: float | None = Field(default=None, ge=0)
    total_inc_vat: float | None = Field(default=None, ge=0)
    status: str = Field(default="posted", pattern="^(draft|posted)$")
    attachment_name: str | None = Field(default=None, max_length=255)
    lines: list[PurchaseInvoiceLineCreate] = Field(min_length=1)


class PurchaseInvoiceUpdate(PurchaseInvoiceCreate):
    pass


class PurchaseInvoiceLineResponse(BaseModel):
    id: UUID
    ingredient_id: UUID | None = None
    line_order: int
    ingredient_name: str
    ingredient_sku: str | None = None
    category: str | None = None
    quantity_purchased: float
    purchase_unit: str
    pack_size_value: float | None = None
    pack_size_unit: str | None = None
    net_quantity_for_costing: float
    costing_unit: str
    line_total_ex_vat: float
    vat_rate: float
    vat_amount: float
    line_total_inc_vat: float
    normalized_unit_cost_ex_vat: float
    normalized_unit_cost_inc_vat: float
    brand: str | None = None
    supplier_product_name: str | None = None

    class Config:
        from_attributes = True


class PurchaseInvoiceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    supplier_name: str
    invoice_number: str
    invoice_date: date
    due_date: date | None = None
    currency: str
    notes: str | None = None
    attachment_name: str | None = None
    vat_included: bool
    subtotal_ex_vat: float
    vat_total: float
    total_inc_vat: float
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    lines: list[PurchaseInvoiceLineResponse] = Field(default_factory=list)

    @field_serializer("invoice_date", "due_date")
    def serialize_date(self, value: date | None) -> str | None:
        return value.isoformat() if value else None

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, value: datetime | None) -> str | None:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True


class PurchaseInvoiceListResponse(BaseModel):
    company_id: UUID
    total_invoices: int
    posted_invoices: int
    draft_invoices: int
    total_spend_ex_vat: float
    total_spend_inc_vat: float
    invoices: list[PurchaseInvoiceResponse]

    @field_serializer("company_id")
    def serialize_company_id(self, value: UUID) -> str:
        return str(value)
