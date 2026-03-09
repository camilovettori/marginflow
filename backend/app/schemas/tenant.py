from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=60)


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True