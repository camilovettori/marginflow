from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == UUID(sub)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


def get_current_tenant_id(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UUID:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant selected")

    try:
        return UUID(tenant_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tenant in token")