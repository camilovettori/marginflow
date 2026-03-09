from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TenantBrief(BaseModel):
    tenant_id: UUID
    name: str
    slug: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenants: list[TenantBrief]


class SelectTenantRequest(BaseModel):
    tenant_id: UUID


class SelectTenantResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    full_name: str | None = None
    tenant_id: UUID | None = None