from uuid import UUID
from pydantic import BaseModel, EmailStr


class TenantMemberOut(BaseModel):
    user_id: UUID
    email: EmailStr
    full_name: str | None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class TenantMemberCreate(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: str = "viewer"


class TenantMemberCreateResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    temporary_password: str | None