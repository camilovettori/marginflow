from __future__ import annotations

from datetime import date
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class WeeklyReportResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    week_ending: datetime

    sales_inc_vat: float
    sales_ex_vat: float
    wages: float
    holiday_pay: float
    food_cost: float
    fixed_costs: float
    variable_costs: float
    loans_hp: float
    vat_due: float
    notes: str | None = None

    created_at: datetime | None = None

    class Config:
        from_attributes = True


class WeeklyReportCreate(BaseModel):
    company_id: UUID
    week_ending: date

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