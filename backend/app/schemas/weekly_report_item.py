from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WeeklyReportItemBase(BaseModel):
    category_id: UUID
    amount: float
    notes: str | None = None


class WeeklyReportItemCreate(WeeklyReportItemBase):
    pass


class WeeklyReportItemUpdate(WeeklyReportItemBase):
    pass


class WeeklyReportItemResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    weekly_report_id: UUID
    category_id: UUID
    amount: float
    notes: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True