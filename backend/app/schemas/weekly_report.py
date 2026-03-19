from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WeeklyReportBase(BaseModel):
    sales_inc_vat: float = 0
    sales_ex_vat: float = 0

    wages: float = 0
    holiday_pay: float = 0

    food_cost: float = 0
    fixed_costs: float = 0
    variable_costs: float = 0
    loans_hp: float = 0

    vat_due: float = 0
    notes: str | None = None


class WeeklyReportCreate(WeeklyReportBase):
    company_id: UUID
    week_ending: date


class WeeklyReportUpdate(WeeklyReportBase):
    company_id: UUID
    week_ending: date


class WeeklyReportResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID

    company_name: str | None = None

    week_ending: date
    week_start: date | None = None
    week_end: date | None = None
    iso_week: int | None = None
    iso_year: int | None = None

    sales_inc_vat: float
    sales_ex_vat: float

    wages: float
    holiday_pay: float
    food_cost: float
    fixed_costs: float
    variable_costs: float
    loans_hp: float
    vat_due: float

    gross_profit: float | None = None
    gross_margin_pct: float | None = None
    net_profit: float | None = None
    net_margin_pct: float | None = None
    labour_pct: float | None = None

    source: str | None = "manual"
    notes: str | None = None

    insights: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)

    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class WeeklyReportsSummaryResponse(BaseModel):
    total_reports: int
    imported_reports: int
    manual_reports: int
    total_sales_inc_vat: float
    total_sales_ex_vat: float
    total_wages: float = 0
    total_net_profit: float = 0


class WeeklyReportPdfResponse(BaseModel):
    download_url: str
    report: WeeklyReportResponse


class WeeklyReportEmailResponse(BaseModel):
    success: bool
    message: str | None = None