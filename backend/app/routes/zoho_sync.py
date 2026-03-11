from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.models.company import Company
from app.models.weekly_report import WeeklyReport
from app.models.zoho_connection import ZohoConnection
from app.routes.zoho import (
    ZOHO_ACCOUNTS_BASE,
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET,
    ZOHO_INVOICE_API_BASE,
    _utcnow,
)
from app.services.metrics_service import persist_metrics

router = APIRouter(prefix="/api/integrations/zoho", tags=["Zoho Sync"])


def _to_decimal(value: object | None) -> Decimal:
    try:
        if value is None or value == "":
            return Decimal("0.00")
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _parse_invoice_date(raw: str | None) -> date | None:
    if not raw:
        return None

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue

    return None


def _week_ending_sunday(d: date) -> date:
    days_until_sunday = 6 - d.weekday()
    return d + timedelta(days=days_until_sunday)


async def _refresh_access_token(connection: ZohoConnection) -> tuple[str, object | None]:
    token_url = f"{ZOHO_ACCOUNTS_BASE}/oauth/v2/token"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            token_url,
            params={
                "refresh_token": connection.refresh_token,
                "client_id": ZOHO_CLIENT_ID,
                "client_secret": ZOHO_CLIENT_SECRET,
                "grant_type": "refresh_token",
            },
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=f"Zoho refresh token failed: {response.text}",
        )

    data = response.json()
    access_token = data.get("access_token")
    expires_in = data.get("expires_in")

    if not access_token:
        raise HTTPException(status_code=400, detail="Zoho refresh did not return access token")

    expires_at = None
    if expires_in:
        expires_at = _utcnow() + timedelta(seconds=int(expires_in))

    return access_token, expires_at


async def _get_valid_access_token(db: Session, connection: ZohoConnection) -> str:
    now = _utcnow()

    if connection.access_token and connection.token_expires_at and connection.token_expires_at > now:
        return connection.access_token

    access_token, expires_at = await _refresh_access_token(connection)
    connection.access_token = access_token
    connection.token_expires_at = expires_at
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return access_token


async def _fetch_all_invoices(
    *,
    access_token: str,
    organization_id: str,
) -> list[dict]:
    invoices: list[dict] = []
    page = 1
    per_page = 200

    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            response = await client.get(
                f"{ZOHO_INVOICE_API_BASE}/invoices",
                headers={
                    "Authorization": f"Zoho-oauthtoken {access_token}",
                },
                params={
                    "organization_id": organization_id,
                    "page": page,
                    "per_page": per_page,
                },
            )

            if response.status_code >= 400:
                raise HTTPException(
                    status_code=400,
                    detail=f"Zoho invoices fetch failed: {response.text}",
                )

            data = response.json()
            batch = data.get("invoices", []) or []
            invoices.extend(batch)

            if len(batch) < per_page:
                break

            page += 1

    return invoices


@router.post("/sync/{company_id}")
async def sync_zoho_invoices_to_weekly_reports(
    company_id: UUID,
    days_back: int = Query(default=180, ge=7, le=730),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
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
    if not connection:
        raise HTTPException(status_code=400, detail="Zoho is not connected for this company")

    organization_id = company.zoho_org_id or connection.zoho_org_id
    if not organization_id or organization_id == "unknown":
        raise HTTPException(
            status_code=400,
            detail="Zoho is connected but no valid organization ID is saved yet",
        )

    access_token = await _get_valid_access_token(db, connection)
    invoices = await _fetch_all_invoices(
        access_token=access_token,
        organization_id=organization_id,
    )

    cutoff_date = date.today() - timedelta(days=days_back)
    weekly_totals: dict[date, dict[str, Decimal]] = {}

    for invoice in invoices:
        invoice_date = _parse_invoice_date(
            invoice.get("date") or invoice.get("invoice_date")
        )
        if not invoice_date or invoice_date < cutoff_date:
            continue

        week_ending = _week_ending_sunday(invoice_date)

        sales_inc_vat = _to_decimal(invoice.get("total"))
        sales_ex_vat = _to_decimal(
            invoice.get("sub_total") or invoice.get("subtotal")
        )

        if week_ending not in weekly_totals:
            weekly_totals[week_ending] = {
                "sales_inc_vat": Decimal("0.00"),
                "sales_ex_vat": Decimal("0.00"),
            }

        weekly_totals[week_ending]["sales_inc_vat"] += sales_inc_vat
        weekly_totals[week_ending]["sales_ex_vat"] += sales_ex_vat

    created_count = 0
    skipped_count = 0

    for week_ending, totals in sorted(weekly_totals.items()):
        existing = (
            db.query(WeeklyReport)
            .filter(
                WeeklyReport.tenant_id == tenant_id,
                WeeklyReport.company_id == company_id,
                WeeklyReport.week_ending == week_ending,
            )
            .first()
        )
        if existing:
            skipped_count += 1
            continue

        report = WeeklyReport(
            tenant_id=tenant_id,
            company_id=company_id,
            week_ending=week_ending,
            sales_inc_vat=float(totals["sales_inc_vat"]),
            sales_ex_vat=float(totals["sales_ex_vat"]),
            wages=0,
            holiday_pay=0,
            food_cost=0,
            fixed_costs=0,
            variable_costs=0,
            loans_hp=0,
            vat_due=0,
            notes="Imported from Zoho Invoice sync",
        )

        db.add(report)
        db.flush()
        persist_metrics(db, report)
        created_count += 1

    connection.last_sync_at = _utcnow()
    db.add(connection)
    db.commit()

    return {
        "success": True,
        "company_id": str(company_id),
        "days_back": days_back,
        "weeks_detected": len(weekly_totals),
        "created_reports": created_count,
        "skipped_existing_reports": skipped_count,
    }