from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FinancialCategoryBase(BaseModel):
    name: str
    type: str
    group: str | None = None
    is_active: bool = True


class FinancialCategoryCreate(FinancialCategoryBase):
    pass


class FinancialCategoryUpdate(FinancialCategoryBase):
    pass


class FinancialCategoryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    type: str
    group: str | None = None
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True