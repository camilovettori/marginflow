from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.schemas.weekly_report import WeeklyReportResponse


class WeeklyReportBreakdownItemResponse(BaseModel):
    id: UUID
    category_id: UUID
    category_name: str
    category_type: str
    category_group: str | None = None
    amount: float
    notes: str | None = None

    class Config:
        from_attributes = True


class WeeklyReportBreakdownGroupTotal(BaseModel):
    key: str
    total: float


class WeeklyReportBreakdownResponse(BaseModel):
    report: WeeklyReportResponse
    items: list[WeeklyReportBreakdownItemResponse]
    totals_by_type: list[WeeklyReportBreakdownGroupTotal]
    totals_by_group: list[WeeklyReportBreakdownGroupTotal]