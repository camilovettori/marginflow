from __future__ import annotations

import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from jose import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = os.getenv("JWT_ALG", "HS256")

ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "20"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "14"))

REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "mf_refresh")
COOKIE_SECURE = os.getenv("RENDER") == "true"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def hash_password(password: str) -> str:
    # alias para manter compatibilidade com código antigo
    return get_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, user_id: UUID, tenant_id: UUID | None) -> str:
    now = _utcnow()
    payload: dict[str, Any] = {
        "type": "access",
        "sub": str(user_id),
        "tenant_id": str(tenant_id) if tenant_id else None,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(*, user_id: UUID) -> tuple[str, str, datetime]:
    """
    Returns:
        (refresh_token_plain, jti, expires_at)
    """
    now = _utcnow()
    jti = uuid4().hex
    expires_at = now + timedelta(days=REFRESH_TOKEN_DAYS)

    payload: dict[str, Any] = {
        "type": "refresh",
        "sub": str(user_id),
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
    return token, jti, expires_at


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()