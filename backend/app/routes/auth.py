from __future__ import annotations

import re
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps_auth import get_current_user
from app.models.refresh_token import RefreshToken
from app.models.tenant import Tenant
from app.models.tenant_user import TenantUser
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MeResponse,
    RegisterRequest,
    SelectTenantRequest,
    SelectTenantResponse,
    TenantBrief,
)
from app.security import (
    COOKIE_SECURE,
    REFRESH_COOKIE_NAME,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    hash_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "workspace"


def _unique_tenant_slug(db: Session, base_slug: str) -> str:
    slug = base_slug
    counter = 1

    while db.query(Tenant).filter(Tenant.slug == slug).first():
        counter += 1
        slug = f"{base_slug}-{counter}"

    return slug


@router.post("/register", response_model=LoginResponse)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    workspace_name = f"{payload.full_name.strip()}'s Workspace"
    base_slug = _slugify(payload.full_name)
    tenant_slug = _unique_tenant_slug(db, base_slug)

    user = User(
        id=uuid4(),
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=get_password_hash(payload.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    tenant = Tenant(
        id=uuid4(),
        name=workspace_name,
        slug=tenant_slug,
    )
    db.add(tenant)
    db.flush()

    membership = TenantUser(
        id=uuid4(),
        user_id=user.id,
        tenant_id=tenant.id,
        role="owner",
        is_active=True,
    )
    db.add(membership)

    refresh_plain, jti, expires_at = create_refresh_token(user_id=user.id)
    rt = RefreshToken(
        user_id=user.id,
        jti=jti,
        token_hash=hash_refresh_token(refresh_plain),
        expires_at=expires_at,
        revoked=False,
    )
    db.add(rt)
    db.commit()

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_plain,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    access = create_access_token(user_id=user.id, tenant_id=None)

    tenants = [
        TenantBrief(
            tenant_id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            role="owner",
        )
    ]

    return LoginResponse(access_token=access, tenants=tenants)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    memberships = (
        db.query(TenantUser, Tenant)
        .join(Tenant, Tenant.id == TenantUser.tenant_id)
        .filter(TenantUser.user_id == user.id, TenantUser.is_active == True)  # noqa: E712
        .all()
    )

    tenants = [
        TenantBrief(
            tenant_id=t.id,
            name=t.name,
            slug=t.slug,
            role=tu.role,
        )
        for (tu, t) in memberships
    ]

    access = create_access_token(user_id=user.id, tenant_id=None)

    refresh_plain, jti, expires_at = create_refresh_token(user_id=user.id)
    rt = RefreshToken(
        user_id=user.id,
        jti=jti,
        token_hash=hash_refresh_token(refresh_plain),
        expires_at=expires_at,
        revoked=False,
    )
    db.add(rt)
    db.commit()

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_plain,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    return LoginResponse(access_token=access, tenants=tenants)


@router.post("/select-tenant", response_model=SelectTenantResponse)
def select_tenant(
    payload: SelectTenantRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = (
        db.query(TenantUser)
        .filter(
            TenantUser.user_id == user.id,
            TenantUser.tenant_id == payload.tenant_id,
            TenantUser.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="No access to this tenant")

    access = create_access_token(user_id=user.id, tenant_id=payload.tenant_id)
    return SelectTenantResponse(access_token=access)


@router.post("/refresh", response_model=SelectTenantResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh cookie")

    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh type")

    jti = payload.get("jti")
    sub = payload.get("sub")
    if not jti or not sub:
        raise HTTPException(status_code=401, detail="Invalid refresh payload")

    row = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    if not row or row.revoked:
        raise HTTPException(status_code=401, detail="Refresh revoked")

    if row.token_hash != hash_refresh_token(token):
        raise HTTPException(status_code=401, detail="Refresh mismatch")

    user = db.query(User).filter(User.id == row.user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    row.revoked = True

    refresh_plain, new_jti, expires_at = create_refresh_token(user_id=user.id)
    new_row = RefreshToken(
        user_id=user.id,
        jti=new_jti,
        token_hash=hash_refresh_token(refresh_plain),
        expires_at=expires_at,
        revoked=False,
    )
    db.add(new_row)
    db.commit()

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_plain,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    access = create_access_token(user_id=user.id, tenant_id=None)
    return SelectTenantResponse(access_token=access)


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), request: Request = None):  # type: ignore
    tenant_id = None

    try:
        auth = request.headers.get("authorization") if request else None
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            payload = decode_token(token)
            tenant_id = payload.get("tenant_id")
    except Exception:
        tenant_id = None

    return MeResponse(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        tenant_id=tenant_id,
    )


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if token:
        try:
            payload = decode_token(token)
            if payload.get("type") == "refresh":
                jti = payload.get("jti")
                if jti:
                    row = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
                    if row:
                        row.revoked = True
                        db.commit()
        except Exception:
            pass

    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")
    return {"ok": True}