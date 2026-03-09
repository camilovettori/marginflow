from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr


class CompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=60)
    address: str | None = Field(default=None, max_length=255)
    contact_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    sales_source: str | None = Field(default="manual", max_length=20)
    square_location_id: str | None = Field(default=None, max_length=120)
    zoho_org_id: str | None = Field(default=None, max_length=120)
    integration_notes: str | None = Field(default=None, max_length=500)


class CompanyUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=60)
    address: str | None = Field(default=None, max_length=255)
    contact_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    sales_source: str | None = Field(default="manual", max_length=20)
    square_location_id: str | None = Field(default=None, max_length=120)
    zoho_org_id: str | None = Field(default=None, max_length=120)
    integration_notes: str | None = Field(default=None, max_length=500)


class CompanyResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    address: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    sales_source: str | None = None
    square_location_id: str | None = None
    zoho_org_id: str | None = None
    integration_notes: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True