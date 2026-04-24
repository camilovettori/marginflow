from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer


class AnalyticsPeriodResponse(BaseModel):
    key: str
    label: str
    granularity: Literal["day", "week", "month"]
    start_date: date
    end_date: date
    comparison_start_date: date
    comparison_end_date: date
    comparison_label: str
    total_days: int

    @field_serializer("start_date", "end_date", "comparison_start_date", "comparison_end_date")
    def _serialize_date(self, value: date) -> str:
        return value.isoformat()


class AnalyticsMetricResponse(BaseModel):
    key: str
    label: str
    value: float | None = None
    previous_value: float | None = None
    delta: float | None = None
    delta_pct: float | None = None
    unit: Literal["currency", "percent", "count", "ratio"]
    source: str | None = None
    available: bool = True


class AnalyticsSummaryResponse(BaseModel):
    weekly_report_count: int
    sales_invoice_count: int
    sales_item_count: int
    purchase_invoice_count: int
    purchase_line_count: int
    matched_product_count: int

    revenue_ex_vat: float | None = None
    revenue_inc_vat: float | None = None
    ledger_revenue_ex_vat: float | None = None
    ledger_revenue_inc_vat: float | None = None
    gross_profit: float | None = None
    net_profit: float | None = None
    gross_margin_pct: float | None = None
    net_margin_pct: float | None = None
    labour_total: float | None = None
    labour_pct: float | None = None
    food_cost: float | None = None
    food_cost_pct: float | None = None
    fixed_costs: float | None = None
    variable_costs: float | None = None
    loans_hp: float | None = None
    vat_due: float | None = None
    average_weekly_revenue: float | None = None
    average_weekly_profit: float | None = None
    average_order_value: float | None = None
    active_customers: int = 0

    annualized_revenue_ex_vat: float | None = None
    annualized_gross_profit: float | None = None
    annualized_net_profit: float | None = None
    annualized_gross_margin_pct: float | None = None
    annualized_net_margin_pct: float | None = None


class AnalyticsTrendPointResponse(BaseModel):
    period: date
    label: str
    revenue_ex_vat: float = 0
    revenue_inc_vat: float = 0
    gross_profit: float | None = None
    net_profit: float | None = None
    gross_margin_pct: float | None = None
    net_margin_pct: float | None = None
    labour_pct: float | None = None
    food_cost_pct: float | None = None
    invoice_count: int | None = None

    @field_serializer("period")
    def _serialize_period(self, value: date) -> str:
        return value.isoformat()


class AnalyticsHighlightResponse(BaseModel):
    key: str
    kind: Literal["day", "week", "month"]
    direction: Literal["best", "worst"]
    label: str
    start_date: date
    end_date: date
    revenue_ex_vat: float = 0
    gross_profit: float | None = None
    net_profit: float | None = None
    gross_margin_pct: float | None = None
    net_margin_pct: float | None = None

    @field_serializer("start_date", "end_date")
    def _serialize_period(self, value: date) -> str:
        return value.isoformat()


class AnalyticsProductResponse(BaseModel):
    rank: int
    item_id: str | None = None
    item_name: str
    quantity_sold: float
    revenue_ex_vat: float
    revenue_share: float
    invoice_count: int
    matched_recipe_id: UUID | None = None
    matched_recipe_name: str | None = None
    matched_category: str | None = None
    estimated_recipe_margin_pct: float | None = None
    estimated_recipe_gross_profit: float | None = None
    estimated_recipe_food_cost_pct: float | None = None

    @field_serializer("matched_recipe_id")
    def _serialize_recipe_id(self, value: UUID | None) -> str | None:
        return str(value) if value else None


class AnalyticsCategoryResponse(BaseModel):
    rank: int
    label: str
    value: float
    share: float
    item_count: int | None = None
    source: str


class AnalyticsInsightResponse(BaseModel):
    key: str
    severity: Literal["info", "success", "warning", "critical"]
    title: str
    summary: str
    why_it_matters: str
    recommended_action: str
    evidence: list[str] = Field(default_factory=list)


class AnalyticsCoverageResponse(BaseModel):
    weekly_reports: int
    sales_invoices: int
    sales_items: int
    purchase_invoices: int
    purchase_lines: int
    recipes: int
    matched_products: int


class CompanyAnalyticsResponse(BaseModel):
    company_id: UUID
    company_name: str
    period: AnalyticsPeriodResponse
    summary: AnalyticsSummaryResponse
    kpis: list[AnalyticsMetricResponse]
    sales_trend: list[AnalyticsTrendPointResponse]
    weekly_trend: list[AnalyticsTrendPointResponse]
    highlights: list[AnalyticsHighlightResponse]
    top_products: list[AnalyticsProductResponse]
    top_revenue_categories: list[AnalyticsCategoryResponse]
    top_cost_categories: list[AnalyticsCategoryResponse]
    top_suppliers: list[AnalyticsCategoryResponse]
    insights: list[AnalyticsInsightResponse]
    coverage: AnalyticsCoverageResponse

    @field_serializer("company_id")
    def _serialize_company_id(self, value: UUID) -> str:
        return str(value)
