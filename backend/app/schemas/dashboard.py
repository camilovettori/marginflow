from __future__ import annotations

from datetime import date
from typing import List
from uuid import UUID

from pydantic import BaseModel, field_serializer


class DashboardWeekRow(BaseModel):
    week_ending: date
    sales_inc_vat: float
    sales_ex_vat: float
    gross_profit: float
    gross_margin_pct: float
    net_profit: float
    net_margin_pct: float

    # MarginFlow padrão: dd-mm-yyyy
    @field_serializer("week_ending")
    def _ser_week_ending(self, v: date) -> str:
        return v.strftime("%d-%m-%Y")


class DashboardSummary(BaseModel):
    tenant_id: UUID
    company_id: UUID
    weeks: int

    total_sales_ex_vat: float
    total_sales_inc_vat: float
    total_wages: float
    total_food_cost: float
    total_fixed_costs: float
    total_variable_costs: float
    total_loans_hp: float
    total_vat_due: float

    total_gross_profit: float
    total_net_profit: float
    avg_gross_margin_pct: float
    avg_net_margin_pct: float

    last_weeks: List[DashboardWeekRow]