from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import jwt
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.company import Company
from app.models.zoho_connection import ZohoConnection

router = APIRouter(prefix="/api/integrations/zoho", tags=["Zoho"])


ZOHO_CLIENT_ID = os.getenv("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.getenv("ZOHO_CLIENT_SECRET", "")
ZOHO_REDIRECT_URI = os.getenv(
    "ZOHO_REDIRECT_URI",
    "http://127.0.0.1:8000/api/integrations/zoho/callback",
)
ZOHO_ACCOUNTS_BASE = os.getenv("ZOHO_ACCOUNTS_BASE", "https://accounts.zoho.eu")
ZOHO_INVOICE_API_BASE = os.getenv(
    "ZOHO_INVOICE_API_BASE",
    "https://www.zohoapis.eu/invoice/v3",
)
ZOHO_OAUTH_SCOPES = os.getenv(
    "ZOHO_OAUTH_SCOPES",
    "ZohoInvoice.invoices.READ,ZohoInvoice.invoices.CREATE,ZohoInvoice.contacts.READ,ZohoInvoice.contacts.CREATE,ZohoInvoice.settings.READ,ZohoInvoice.settings.CREATE",
)
ZOHO_STATE_SECRET = os.getenv(
    "ZOHO_STATE_SECRET",
    os.getenv("JWT_SECRET", "dev-secret-change-me"),
)
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _company_settings_url(company_id: UUID, **params: str) -> str:
    base = f"{FRONTEND_BASE_URL}/companies/{company_id}/settings"
    if not params:
      return base
    return f"{base}?{urlencode(params)}"


def _build_state(*, tenant_id: UUID, company_id: UUID) -> str:
    now = _utcnow()
    payload = {
        "tenant_id": str(tenant_id),
        "company_id": str(company_id),
        "nonce": secrets.token_urlsafe(12),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=15)).timestamp()),
    }
    return jwt.encode(payload, ZOHO_STATE_SECRET, algorithm="HS256")


def _decode_state(state: str) -> dict:
    return jwt.decode(state, ZOHO_STATE_SECRET, algorithms=["HS256"])


@router.get("/connect/{company_id}")
def connect_zoho(
    company_id: UUID,
    tenant_id: UUID = Query(...),
    db: Session = Depends(get_db),
):
    if not ZOHO_CLIENT_ID or not ZOHO_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Zoho OAuth is not configured on the server.")

    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    state = _build_state(tenant_id=tenant_id, company_id=company_id)

    params = {
        "scope": ZOHO_OAUTH_SCOPES,
        "client_id": ZOHO_CLIENT_ID,
        "response_type": "code",
        "access_type": "offline",
        "redirect_uri": ZOHO_REDIRECT_URI,
        "state": state,
        "prompt": "consent",
    }

    auth_url = f"{ZOHO_ACCOUNTS_BASE}/oauth/v2/auth?{urlencode(params)}"
    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/callback")
async def zoho_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if not state:
        raise HTTPException(status_code=400, detail="Missing OAuth state.")

    try:
        decoded_state = _decode_state(state)
        tenant_id = UUID(decoded_state["tenant_id"])
        company_id = UUID(decoded_state["company_id"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    if error:
        return RedirectResponse(
            url=_company_settings_url(company_id, zoho_error=error),
            status_code=302,
        )

    if not code:
        return RedirectResponse(
            url=_company_settings_url(company_id, zoho_error="missing_code"),
            status_code=302,
        )

    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    token_url = f"{ZOHO_ACCOUNTS_BASE}/oauth/v2/token"

    async with httpx.AsyncClient(timeout=30.0) as client:
        token_response = await client.post(
            token_url,
            params={
                "grant_type": "authorization_code",
                "client_id": ZOHO_CLIENT_ID,
                "client_secret": ZOHO_CLIENT_SECRET,
                "redirect_uri": ZOHO_REDIRECT_URI,
                "code": code,
            },
        )

    if token_response.status_code >= 400:
        company.integration_notes = "Zoho connection failed during token exchange"
        db.commit()
        return RedirectResponse(
            url=_company_settings_url(company_id, zoho_error="token_exchange_failed"),
            status_code=302,
        )

    token_data = token_response.json()

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")

    if not access_token or not refresh_token:
        company.integration_notes = "Zoho connection failed: missing OAuth tokens"
        db.commit()
        return RedirectResponse(
            url=_company_settings_url(company_id, zoho_error="missing_tokens"),
            status_code=302,
        )

    org_id = None
    connected_email = None
    org_lookup_status = None
    org_lookup_body = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        org_response = await client.get(
            f"{ZOHO_INVOICE_API_BASE}/organizations",
            headers={
                "Authorization": f"Zoho-oauthtoken {access_token}",
            },
        )

    org_lookup_status = org_response.status_code
    org_lookup_body = org_response.text

    print("ZOHO ORG STATUS:", org_lookup_status)
    print("ZOHO ORG BODY:", org_lookup_body)

    if org_response.status_code < 400:
        try:
            org_data = org_response.json()
        except Exception:
            org_data = {}

        organizations = org_data.get("organizations") or org_data.get("data") or []
        if isinstance(organizations, list) and organizations:
            first_org = organizations[0]

            raw_org_id = (
                first_org.get("organization_id")
                or first_org.get("organizationId")
                or first_org.get("org_id")
            )
            if raw_org_id:
                org_id = str(raw_org_id)

            connected_email = (
                first_org.get("email")
                or first_org.get("primary_email")
                or first_org.get("contact_email")
            )

    existing = (
        db.query(ZohoConnection)
        .filter(
            ZohoConnection.company_id == company_id,
            ZohoConnection.tenant_id == tenant_id,
        )
        .first()
    )

    expires_at = None
    if expires_in:
        expires_at = _utcnow() + timedelta(seconds=int(expires_in))

    if existing:
        if org_id:
            existing.zoho_org_id = org_id
        existing.refresh_token = refresh_token
        existing.access_token = access_token
        existing.token_expires_at = expires_at
        existing.connected_email = connected_email
        existing.connected_at = _utcnow()
    else:
        connection = ZohoConnection(
            tenant_id=tenant_id,
            company_id=company_id,
            zoho_org_id=org_id or "unknown",
            refresh_token=refresh_token,
            access_token=access_token,
            token_expires_at=expires_at,
            connected_email=connected_email,
            connected_at=_utcnow(),
        )
        db.add(connection)

    company.sales_source = "zoho"

    if org_id:
        company.zoho_org_id = org_id
        company.integration_notes = "Zoho Invoice connected"
        db.commit()
        return RedirectResponse(
            url=_company_settings_url(company_id, zoho_connected="1"),
            status_code=302,
        )

    company.integration_notes = "Zoho connected, but no Zoho Invoice organization was found"
    db.commit()

    return RedirectResponse(
        url=_company_settings_url(company_id, zoho_connected="1", zoho_org_pending="1"),
        status_code=302,
    )


@router.delete("/disconnect/{company_id}")
def disconnect_zoho(
    company_id: UUID,
    tenant_id: UUID = Query(...),
    db: Session = Depends(get_db),
):
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    connection = (
        db.query(ZohoConnection)
        .filter(
            ZohoConnection.company_id == company_id,
            ZohoConnection.tenant_id == tenant_id,
        )
        .first()
    )

    if connection:
        db.delete(connection)

    company.sales_source = "manual"
    company.zoho_org_id = None
    company.integration_notes = "Zoho disconnected"
    db.commit()

    return {
        "success": True,
        "company_id": str(company_id),
        "connected": False,
    }
