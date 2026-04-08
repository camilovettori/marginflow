from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer


class SalesTrendPoint(BaseModel):
    period: date
    sales_inc_vat: float
    sales_ex_vat: float
    invoice_count: int

    @field_serializer("period")
    def _ser_period(self, v: date) -> str:
        return v.isoformat()


class SalesCustomerItemBreakdown(BaseModel):
    item_id: Optional[str] = None
    item_name: str
    quantity: float
    revenue_ex_vat: float
    revenue_inc_vat: float
    invoice_count: int


class SalesCustomerRow(BaseModel):
    rank: int
    customer_id: Optional[str] = None
    customer_name: str
    total_spend_inc_vat: float
    total_spend_ex_vat: float
    invoice_count: int
    average_order_value: float
    last_purchase_date: Optional[date] = None
    items: List[SalesCustomerItemBreakdown] = Field(default_factory=list)

    @field_serializer("last_purchase_date")
    def _ser_last_purchase(self, v: Optional[date]) -> Optional[str]:
        return v.isoformat() if v else None


class SalesItemRow(BaseModel):
    rank: int
    item_id: Optional[str] = None
    item_name: str
    quantity_sold: float
    revenue_ex_vat: float
    revenue_inc_vat: float
    invoice_count: int


class SalesInvoiceRow(BaseModel):
    invoice_date: date
    invoice_number: Optional[str] = None
    customer_name: Optional[str] = None
    total_ex_vat: float
    total_inc_vat: float
    status: Optional[str] = None

    @field_serializer("invoice_date")
    def _ser_invoice_date(self, v: date) -> str:
        return v.isoformat()


class SalesConnectionState(BaseModel):
    connected: bool
    zoho_org_id: Optional[str] = None
    connected_email: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    sales_source: Optional[str] = None

    @field_serializer("last_sync_at")
    def _ser_last_sync_at(self, v: Optional[datetime]) -> Optional[str]:
        return v.isoformat() if v else None


class SalesAnalyticsResponse(BaseModel):
    company_id: UUID
    company_name: str
    range_key: str
    range_label: str
    start_date: date
    end_date: date
    connection: SalesConnectionState
    total_sales_inc_vat: float
    total_sales_ex_vat: float
    invoice_count: int
    active_customers: int
    average_order_value: float
    top_customers: List[SalesCustomerRow]
    customer_breakdown: Optional[SalesCustomerRow] = None
    top_items: List[SalesItemRow]
    invoice_trend: List[SalesTrendPoint]
    recent_invoices: List[SalesInvoiceRow]

    @field_serializer("start_date", "end_date")
    def _ser_dates(self, v: date) -> str:
        return v.isoformat()
