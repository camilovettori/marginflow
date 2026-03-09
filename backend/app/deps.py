from __future__ import annotations

from uuid import UUID

from fastapi import Header, HTTPException


def get_tenant_id(x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id")) -> UUID:
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Missing X-Tenant-Id header")

    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid X-Tenant-Id (must be UUID)")