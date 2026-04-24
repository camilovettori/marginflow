from __future__ import annotations

from pydantic import BaseModel, Field


class PdfExtractedLine(BaseModel):
    ingredient_name: str = ""
    supplier_product_name: str = ""
    ingredient_sku: str | None = None
    quantity_purchased: float | None = None
    purchase_unit: str = "unit"
    pack_size_value: float | None = None
    pack_size_unit: str | None = None
    net_quantity_for_costing: float | None = None
    costing_unit: str = "unit"
    unit_price_ex_vat: float | None = None
    line_total_ex_vat: float | None = None
    vat_rate: float | None = None
    line_total_inc_vat: float | None = None
    brand: str | None = None
    category: str | None = None


class PdfExtractResponse(BaseModel):
    supplier_name: str | None = None
    invoice_number: str | None = None
    invoice_date: str | None = None
    due_date: str | None = None
    currency: str | None = None
    subtotal_ex_vat: float | None = None
    vat_total: float | None = None
    total_inc_vat: float | None = None
    notes: str | None = None
    vat_included: bool = False
    lines: list[PdfExtractedLine] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    extraction_debug: str | None = None
