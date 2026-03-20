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


def _week_start_monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _resolve_sync_range(
    *,
    preset: str | None,
    week_ending: date | None,
    date_from: date | None,
    date_to: date | None,
) -> tuple[date | None, date | None, str, date | None]:
    today = date.today()
    current_week_start = _week_start_monday(today)
    current_week_end = _week_ending_sunday(today)

    if preset == "this_week":
        return current_week_start, current_week_end, "this_week", current_week_end

    if preset == "last_week":
        last_week_end = current_week_start - timedelta(days=1)
        last_week_start = _week_start_monday(last_week_end)
        return last_week_start, last_week_end, "last_week", last_week_end

    if preset == "last_4_weeks":
        start = current_week_start - timedelta(weeks=3)
        return start, current_week_end, "last_4_weeks", None

    if preset == "last_12_weeks":
        start = current_week_start - timedelta(weeks=11)
        return start, current_week_end, "last_12_weeks", None

    if preset == "specific_week":
        if not week_ending:
            raise HTTPException(
                status_code=400,
                detail="week_ending is required when preset=specific_week",
            )
        start = _week_start_monday(week_ending)
        end = _week_ending_sunday(week_ending)
        return start, end, "specific_week", week_ending

    if date_from and date_to:
        if date_from > date_to:
            raise HTTPException(
                status_code=400,
                detail="date_from cannot be after date_to",
            )
        return date_from, date_to, "custom_range", None

    start = current_week_start - timedelta(weeks=3)
    return start, current_week_end, "last_4_weeks", None


def _is_safe_to_autoupdate(existing: WeeklyReport) -> bool:
    notes = (existing.notes or "").lower()

    was_imported_from_zoho = "zoho" in notes

    has_manual_costs = any(
        float(value or 0) > 0
        for value in [
            existing.wages,
            existing.holiday_pay,
            existing.food_cost,
            existing.fixed_costs,
            existing.variable_costs,
            existing.loans_hp,
            existing.vat_due,
        ]
    )

    if was_imported_from_zoho and not has_manual_costs:
        return True

    if (
        float(existing.sales_inc_vat or 0) == 0
        and float(existing.sales_ex_vat or 0) == 0
        and not has_manual_costs
    ):
        return True

    return False


async def _refresh_access_token(
    connection: ZohoConnection,
) -> tuple[str, object | None]:
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
        raise HTTPException(
            status_code=400,
            detail="Zoho refresh did not return access token",
        )

    expires_at = None
    if expires_in:
        expires_at = _utcnow() + timedelta(seconds=int(expires_in))

    return access_token, expires_at


async def _get_valid_access_token(db: Session, connection: ZohoConnection) -> str:
    now = _utcnow()

    if (
        connection.access_token
        and connection.token_expires_at
        and connection.token_expires_at > now
    ):
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


def _build_weekly_totals(
    *,
    invoices: list[dict],
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[date, dict[str, Decimal]]:
    weekly_totals: dict[date, dict[str, Decimal]] = {}

    for invoice in invoices:
        invoice_date = _parse_invoice_date(
            invoice.get("date") or invoice.get("invoice_date")
        )
        if not invoice_date:
            continue

        if date_from and invoice_date < date_from:
            continue

        if date_to and invoice_date > date_to:
            continue

        week_ending = _week_ending_sunday(invoice_date)

        total = _to_decimal(invoice.get("total"))
        sub_total = _to_decimal(invoice.get("sub_total") or invoice.get("subtotal"))
        tax_total = _to_decimal(invoice.get("tax_total"))

        sales_inc_vat = total

        if sub_total > Decimal("0.00"):
            sales_ex_vat = sub_total
        elif total > Decimal("0.00") and tax_total > Decimal("0.00"):
            sales_ex_vat = (total - tax_total).quantize(Decimal("0.01"))
        else:
            sales_ex_vat = Decimal("0.00")

        if week_ending not in weekly_totals:
            weekly_totals[week_ending] = {
                "sales_inc_vat": Decimal("0.00"),
                "sales_ex_vat": Decimal("0.00"),
            }

        weekly_totals[week_ending]["sales_inc_vat"] += sales_inc_vat
        weekly_totals[week_ending]["sales_ex_vat"] += sales_ex_vat

    return weekly_totals


async def _get_company_and_connection(
    *,
    db: Session,
    tenant_id: UUID,
    company_id: UUID,
) -> tuple[Company, ZohoConnection, str]:
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
        raise HTTPException(
            status_code=400,
            detail="Zoho is not connected for this company",
        )

    organization_id = company.zoho_org_id or connection.zoho_org_id
    if not organization_id or organization_id == "unknown":
        raise HTTPException(
            status_code=400,
            detail="Zoho is connected but no valid organization ID is saved yet",
        )

    return company, connection, organization_id


@router.get("/prefill/{company_id}")
async def get_zoho_weekly_prefill(
    company_id: UUID,
    week_ending: date = Query(...),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    company, connection, organization_id = await _get_company_and_connection(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
    )

    access_token = await _get_valid_access_token(db, connection)
    invoices = await _fetch_all_invoices(
        access_token=access_token,
        organization_id=organization_id,
    )

    week_start = _week_start_monday(week_ending)
    week_end = _week_ending_sunday(week_ending)

    weekly_totals = _build_weekly_totals(
        invoices=invoices,
        date_from=week_start,
        date_to=week_end,
    )
    totals = weekly_totals.get(week_ending)

    if not totals:
        return {
            "success": True,
            "company_id": str(company_id),
            "company_name": company.name,
            "week_ending": str(week_ending),
            "source": "zoho",
            "found": False,
            "sales_inc_vat": 0,
            "sales_ex_vat": 0,
            "notes": "No Zoho invoice data found for this week.",
        }

    return {
        "success": True,
        "company_id": str(company_id),
        "company_name": company.name,
        "week_ending": str(week_ending),
        "source": "zoho",
        "found": True,
        "sales_inc_vat": float(totals["sales_inc_vat"]),
        "sales_ex_vat": float(totals["sales_ex_vat"]),
        "notes": "Imported from Zoho Invoice prefill",
    }


@router.post("/sync/{company_id}")
async def sync_zoho_invoices_to_weekly_reports(
    company_id: UUID,
    preset: str | None = Query(default="last_4_weeks"),
    week_ending: date | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    company, connection, organization_id = await _get_company_and_connection(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
    )

    resolved_from, resolved_to, resolved_preset, resolved_week_ending = _resolve_sync_range(
        preset=preset,
        week_ending=week_ending,
        date_from=date_from,
        date_to=date_to,
    )

    access_token = await _get_valid_access_token(db, connection)
    invoices = await _fetch_all_invoices(
        access_token=access_token,
        organization_id=organization_id,
    )

    weekly_totals = _build_weekly_totals(
        invoices=invoices,
        date_from=resolved_from,
        date_to=resolved_to,
    )

    created_count = 0
    updated_count = 0
    skipped_existing_reports = 0

    for report_week_ending, totals in sorted(weekly_totals.items()):
        existing = (
            db.query(WeeklyReport)
            .filter(
                WeeklyReport.tenant_id == tenant_id,
                WeeklyReport.company_id == company_id,
                WeeklyReport.week_ending == report_week_ending,
            )
            .first()
        )

        if existing:
            if _is_safe_to_autoupdate(existing):
                existing.sales_inc_vat = float(totals["sales_inc_vat"])
                existing.sales_ex_vat = float(totals["sales_ex_vat"])
                existing.notes = "Imported from Zoho Invoice sync"
                db.add(existing)
                persist_metrics(db, existing)
                updated_count += 1
            else:
                skipped_existing_reports += 1
            continue

        report = WeeklyReport(
            tenant_id=tenant_id,
            company_id=company_id,
            week_ending=report_week_ending,
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

    company.sales_source = "zoho"
    db.add(company)

    db.commit()

    return {
        "success": True,
        "company_id": str(company_id),
        "preset": resolved_preset,
        "week_ending": str(resolved_week_ending) if resolved_week_ending else None,
        "date_from": str(resolved_from) if resolved_from else None,
        "date_to": str(resolved_to) if resolved_to else None,
        "weeks_detected": len(weekly_totals),
        "created_reports": created_count,
        "updated_reports": updated_count,
        "skipped_existing_reports": skipped_existing_reports,
    }