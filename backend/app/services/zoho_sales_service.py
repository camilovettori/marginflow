from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Iterable
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.weekly_report import WeeklyReport
from app.models.zoho_connection import ZohoConnection
from app.models.zoho_sales_invoice import ZohoSalesInvoice
from app.models.zoho_sales_invoice_item import ZohoSalesInvoiceItem
from app.routes.zoho import (
    ZOHO_ACCOUNTS_BASE,
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET,
    ZOHO_INVOICE_API_BASE,
    _utcnow,
)


RANGE_LABELS = {
    "week": "Week",
    "4w": "4 Weeks",
    "3m": "3 Months",
    "6m": "6 Months",
    "12m": "12 Months",
}

RANGE_DAYS = {
    "week": 7,
    "4w": 28,
    "3m": 90,
    "6m": 180,
    "12m": 365,
}

UNDEFINED_TABLE_SQLSTATE = "42P01"


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


async def _refresh_access_token(connection: ZohoConnection) -> tuple[str, datetime | None]:
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


async def get_valid_access_token(db: Session, connection: ZohoConnection) -> str:
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


async def fetch_all_invoices(
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


def _invoice_amounts(invoice: dict) -> tuple[Decimal, Decimal, Decimal]:
    total_inc = _to_decimal(invoice.get("total"))
    sub_total = _to_decimal(invoice.get("sub_total") or invoice.get("subtotal"))
    tax_total = _to_decimal(invoice.get("tax_total") or invoice.get("tax_amount"))

    if sub_total > Decimal("0.00"):
        total_ex = sub_total
    elif total_inc > Decimal("0.00") and tax_total > Decimal("0.00"):
        total_ex = (total_inc - tax_total).quantize(Decimal("0.01"))
    else:
        total_ex = Decimal("0.00")

    return total_inc, total_ex, tax_total


def _line_item_ex_total(line_item: dict) -> Decimal:
    for key in ("item_total", "total", "line_item_total", "rate_total"):
        value = line_item.get(key)
        if value not in (None, ""):
            return _to_decimal(value)
    quantity = _to_decimal(line_item.get("quantity"))
    rate = _to_decimal(line_item.get("rate") or line_item.get("price"))
    return (quantity * rate).quantize(Decimal("0.01"))


def _extract_invoice_items(invoice: dict, invoice_total_ex: Decimal, invoice_tax: Decimal) -> list[dict]:
    line_items = invoice.get("line_items") or []
    line_totals = [_line_item_ex_total(item) for item in line_items]
    subtotal = sum(line_totals, Decimal("0.00"))
    items: list[dict] = []

    for idx, line_item in enumerate(line_items):
        line_ex = line_totals[idx]
        line_tax = Decimal("0.00")
        if subtotal > Decimal("0.00") and invoice_tax > Decimal("0.00"):
            line_tax = (invoice_tax * (line_ex / subtotal)).quantize(Decimal("0.01"))

        item_name = line_item.get("name") or line_item.get("item_name") or "Item"

        items.append(
            {
                "item_id": str(line_item.get("item_id") or line_item.get("line_item_id") or "") or None,
                "item_name": item_name,
                "quantity": _to_decimal(line_item.get("quantity")),
                "rate": _to_decimal(line_item.get("rate") or line_item.get("price")),
                "line_total_ex_vat": line_ex,
                "line_total_inc_vat": (line_ex + line_tax).quantize(Decimal("0.01")),
                "tax_amount": line_tax,
            }
        )

    if not items and invoice_total_ex > Decimal("0.00"):
        items.append(
            {
                "item_id": None,
                "item_name": invoice.get("customer_name") or "Invoice total",
                "quantity": Decimal("1.00"),
                "rate": invoice_total_ex,
                "line_total_ex_vat": invoice_total_ex,
                "line_total_inc_vat": (invoice_total_ex + invoice_tax).quantize(Decimal("0.01")),
                "tax_amount": invoice_tax,
            }
        )

    return items


async def fetch_invoice_ledger(
    *,
    db: Session,
    tenant_id: UUID,
    company_id: UUID,
) -> tuple[Company, ZohoConnection, str, list[dict]]:
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

    access_token = await get_valid_access_token(db, connection)
    invoices = await fetch_all_invoices(access_token=access_token, organization_id=organization_id)
    return company, connection, organization_id, invoices


def _invoice_date_filter(range_key: str) -> date:
    days = RANGE_DAYS.get(range_key, RANGE_DAYS["4w"])
    return date.today() - timedelta(days=days - 1)


def _handle_sales_programming_error(exc: ProgrammingError) -> None:
    if getattr(getattr(exc, "orig", None), "pgcode", None) == UNDEFINED_TABLE_SQLSTATE:
        raise HTTPException(
            status_code=503,
            detail="Sales ledger tables are missing. Run alembic upgrade heads.",
        ) from exc


def _build_customer_lookup(invoices: Iterable[ZohoSalesInvoice]) -> dict[str, dict]:
    customers: dict[str, dict] = {}

    for invoice in invoices:
        customer_key = str(invoice.customer_id or invoice.customer_name or "unknown")
        customer_label = invoice.customer_name or invoice.customer_id or "Unknown customer"
        customer = customers.setdefault(
            customer_key,
            {
                "customer_id": invoice.customer_id,
                "customer_name": customer_label,
                "total_spend_inc_vat": 0.0,
                "total_spend_ex_vat": 0.0,
                "invoice_numbers": set(),
                "last_purchase_date": invoice.invoice_date,
                "items": defaultdict(
                    lambda: {
                        "item_id": None,
                        "item_name": "",
                        "quantity": 0.0,
                        "revenue_ex_vat": 0.0,
                        "revenue_inc_vat": 0.0,
                        "invoice_numbers": set(),
                    }
                ),
            },
        )
        customer["total_spend_inc_vat"] += float(invoice.total_inc_vat or 0)
        customer["total_spend_ex_vat"] += float(invoice.total_ex_vat or 0)
        customer["invoice_numbers"].add(invoice.invoice_number or invoice.zoho_invoice_id)
        customer["last_purchase_date"] = max(customer["last_purchase_date"], invoice.invoice_date)

    return customers


def _attach_customer_items(
    customers: dict[str, dict],
    invoice_items: Iterable[tuple[ZohoSalesInvoiceItem, ZohoSalesInvoice]],
) -> None:
    for invoice_item, invoice in invoice_items:
        customer_key = str(invoice.customer_id or invoice.customer_name or "unknown")
        customer = customers.get(customer_key)
        if not customer:
            continue

        item_name = invoice_item.item_name or "Item"
        item_key = item_name.lower()
        item_bucket = customer["items"][item_key]
        item_bucket["item_id"] = item_bucket["item_id"] or invoice_item.item_id
        item_bucket["item_name"] = item_name
        item_bucket["quantity"] += float(invoice_item.quantity or 0)
        item_bucket["revenue_ex_vat"] += float(invoice_item.line_total_ex_vat or 0)
        item_bucket["revenue_inc_vat"] += float(invoice_item.line_total_inc_vat or 0)
        item_bucket["invoice_numbers"].add(invoice.invoice_number or invoice.zoho_invoice_id)


def persist_sales_ledger(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    invoices: list[dict],
    start_date: date | None = None,
    end_date: date | None = None,
    sync_source: str = "zoho",
) -> dict[str, int]:
    existing_invoices = (
        db.execute(
            select(ZohoSalesInvoice).where(
                ZohoSalesInvoice.tenant_id == tenant_id,
                ZohoSalesInvoice.company_id == company_id,
            )
        )
        .scalars()
        .all()
    )
    existing_by_invoice_id = {invoice.zoho_invoice_id: invoice for invoice in existing_invoices}
    existing_by_unify_order_id = {
        invoice.unify_order_id: invoice
        for invoice in existing_invoices
        if invoice.unify_order_id
    }

    existing_items = (
        db.execute(
            select(ZohoSalesInvoiceItem).where(
                ZohoSalesInvoiceItem.tenant_id == tenant_id,
                ZohoSalesInvoiceItem.company_id == company_id,
            )
        )
        .scalars()
        .all()
    )
    existing_items_by_invoice: dict[UUID, list[ZohoSalesInvoiceItem]] = defaultdict(list)
    for item in existing_items:
        existing_items_by_invoice[item.zoho_sales_invoice_id].append(item)

    synced_invoices = 0
    synced_items = 0

    filtered_invoices = []
    for invoice in invoices:
        invoice_date = _parse_invoice_date(invoice.get("date") or invoice.get("invoice_date"))
        if not invoice_date:
            continue
        if start_date and invoice_date < start_date:
            continue
        if end_date and invoice_date > end_date:
            continue
        filtered_invoices.append((invoice_date, invoice))

    for invoice_date, invoice in filtered_invoices:
        total_inc, total_ex, tax_amount = _invoice_amounts(invoice)
        items = _extract_invoice_items(invoice, total_ex, tax_amount)

        zoho_invoice_id = str(invoice.get("invoice_id") or invoice.get("invoice_number") or invoice.get("number") or "")
        if not zoho_invoice_id:
            continue

        unify_order_id = str(invoice.get("unify_order_id") or "").strip() or None
        invoice_number = invoice.get("invoice_number") or invoice.get("number") or invoice.get("reference_number")
        customer = invoice.get("customer_name") or {}
        customer_id = invoice.get("customer_id")
        customer_name = None
        if isinstance(customer, dict):
            customer_name = customer.get("customer_name") or customer.get("name")
            customer_id = customer_id or customer.get("customer_id") or customer.get("id")
        elif isinstance(customer, str):
            customer_name = customer

        status = invoice.get("status") or invoice.get("invoice_status")
        currency = invoice.get("currency_code") or invoice.get("currency") or "EUR"

        existing = existing_by_invoice_id.get(zoho_invoice_id)
        if not existing and unify_order_id:
            existing = existing_by_unify_order_id.get(unify_order_id)
        if existing:
            existing.invoice_number = str(invoice_number) if invoice_number else existing.invoice_number
            existing.customer_id = str(customer_id) if customer_id else existing.customer_id
            existing.customer_name = customer_name or existing.customer_name
            existing.invoice_date = invoice_date
            existing.status = str(status) if status else existing.status
            existing.currency = str(currency) if currency else existing.currency
            existing.total_inc_vat = float(total_inc)
            existing.total_ex_vat = float(total_ex)
            existing.tax_amount = float(tax_amount)
            existing.sync_source = str(invoice.get("sync_source") or sync_source)
            existing.unify_order_id = unify_order_id or existing.unify_order_id
            existing.synced_at = _utcnow()
            db.add(existing)
            invoice_model = existing
            if unify_order_id:
                existing_by_unify_order_id[unify_order_id] = existing

            for old_item in existing_items_by_invoice.get(existing.id, []):
                db.delete(old_item)
        else:
            invoice_model = ZohoSalesInvoice(
                tenant_id=tenant_id,
                company_id=company_id,
                zoho_invoice_id=zoho_invoice_id,
                unify_order_id=unify_order_id,
                invoice_number=str(invoice_number) if invoice_number else None,
                customer_id=str(customer_id) if customer_id else None,
                customer_name=customer_name,
                invoice_date=invoice_date,
                status=str(status) if status else None,
                currency=str(currency) if currency else "EUR",
                total_inc_vat=float(total_inc),
                total_ex_vat=float(total_ex),
                tax_amount=float(tax_amount),
                sync_source=str(invoice.get("sync_source") or sync_source),
                synced_at=_utcnow(),
            )
            db.add(invoice_model)
            db.flush()
            existing_by_invoice_id[zoho_invoice_id] = invoice_model
            if unify_order_id:
                existing_by_unify_order_id[unify_order_id] = invoice_model

        for item in items:
            item_model = ZohoSalesInvoiceItem(
                tenant_id=tenant_id,
                company_id=company_id,
                zoho_sales_invoice_id=invoice_model.id,
                item_id=item["item_id"],
                item_name=item["item_name"],
                quantity=float(item["quantity"]),
                rate=float(item["rate"]),
                line_total_ex_vat=float(item["line_total_ex_vat"]),
                line_total_inc_vat=float(item["line_total_inc_vat"]),
                tax_amount=float(item["tax_amount"]),
            )
            db.add(item_model)
            synced_items += 1

        synced_invoices += 1

    db.flush()
    return {"invoices_synced": synced_invoices, "items_synced": synced_items}


def build_weekly_totals_from_invoices(
    invoices: Iterable[dict],
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[date, dict[str, Decimal]]:
    weekly_totals: dict[date, dict[str, Decimal]] = {}

    for invoice in invoices:
        invoice_date = _parse_invoice_date(invoice.get("date") or invoice.get("invoice_date"))
        if not invoice_date:
            continue
        if date_from and invoice_date < date_from:
            continue
        if date_to and invoice_date > date_to:
            continue

        week_ending = _week_ending_sunday(invoice_date)
        total_inc, total_ex, _tax_amount = _invoice_amounts(invoice)

        if week_ending not in weekly_totals:
            weekly_totals[week_ending] = {
                "sales_inc_vat": Decimal("0.00"),
                "sales_ex_vat": Decimal("0.00"),
            }

        weekly_totals[week_ending]["sales_inc_vat"] += total_inc
        weekly_totals[week_ending]["sales_ex_vat"] += total_ex

    return weekly_totals


def get_sales_analytics_data(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    range_key: str,
    customer_id: str | None = None,
) -> dict:
    try:
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

        start_date = _invoice_date_filter(range_key)
        end_date = date.today()

        invoices = (
            db.execute(
                select(ZohoSalesInvoice).where(
                    ZohoSalesInvoice.tenant_id == tenant_id,
                    ZohoSalesInvoice.company_id == company_id,
                    ZohoSalesInvoice.invoice_date >= start_date,
                    ZohoSalesInvoice.invoice_date <= end_date,
                ).order_by(ZohoSalesInvoice.invoice_date.desc())
            )
            .scalars()
            .all()
        )

        invoice_items = (
            db.execute(
                select(ZohoSalesInvoiceItem, ZohoSalesInvoice)
                .join(ZohoSalesInvoice, ZohoSalesInvoice.id == ZohoSalesInvoiceItem.zoho_sales_invoice_id)
                .where(
                    ZohoSalesInvoiceItem.tenant_id == tenant_id,
                    ZohoSalesInvoiceItem.company_id == company_id,
                    ZohoSalesInvoice.invoice_date >= start_date,
                    ZohoSalesInvoice.invoice_date <= end_date,
                )
            )
            .all()
        )
    except ProgrammingError as exc:
        _handle_sales_programming_error(exc)
        raise

    total_sales_inc_vat = sum(float(invoice.total_inc_vat or 0) for invoice in invoices)
    total_sales_ex_vat = sum(float(invoice.total_ex_vat or 0) for invoice in invoices)
    invoice_count = len(invoices)
    active_customers = len({(invoice.customer_id or invoice.customer_name or "") for invoice in invoices if (invoice.customer_id or invoice.customer_name)})
    average_order_value = (total_sales_ex_vat / invoice_count) if invoice_count else 0.0

    grouped_by_day: dict[date, dict[str, float | int]] = {}
    daily_mode = range_key == "week"
    for invoice in invoices:
        bucket = invoice.invoice_date if daily_mode else _week_ending_sunday(invoice.invoice_date)
        grouped = grouped_by_day.setdefault(
            bucket,
            {"sales_inc_vat": 0.0, "sales_ex_vat": 0.0, "invoice_count": 0},
        )
        grouped["sales_inc_vat"] += float(invoice.total_inc_vat or 0)
        grouped["sales_ex_vat"] += float(invoice.total_ex_vat or 0)
        grouped["invoice_count"] += 1

    trend = [
        {
            "period": period,
            "sales_inc_vat": values["sales_inc_vat"],
            "sales_ex_vat": values["sales_ex_vat"],
            "invoice_count": int(values["invoice_count"]),
        }
        for period, values in sorted(grouped_by_day.items())
    ]

    customers = _build_customer_lookup(invoices)
    _attach_customer_items(customers, invoice_items)
    item_lookup: dict[str, dict] = {}
    for invoice_item, invoice in invoice_items:
        item_name = invoice_item.item_name or "Item"
        item_key = item_name.lower()

        overall_item = item_lookup.setdefault(
            item_key,
            {
                "item_id": invoice_item.item_id,
                "item_name": item_name,
                "quantity_sold": 0.0,
                "revenue_ex_vat": 0.0,
                "revenue_inc_vat": 0.0,
                "invoice_numbers": set(),
            },
        )
        overall_item["quantity_sold"] += float(invoice_item.quantity or 0)
        overall_item["revenue_ex_vat"] += float(invoice_item.line_total_ex_vat or 0)
        overall_item["revenue_inc_vat"] += float(invoice_item.line_total_inc_vat or 0)
        overall_item["invoice_numbers"].add(invoice.invoice_number or invoice.zoho_invoice_id)

    top_customers_sorted = sorted(
        customers.values(),
        key=lambda row: row["total_spend_ex_vat"],
        reverse=True,
    )

    customer_rows = []
    for idx, customer in enumerate(top_customers_sorted[:10], start=1):
        item_rows = sorted(
            customer["items"].values(),
            key=lambda row: row["revenue_ex_vat"],
            reverse=True,
        )[:4]
        customer_rows.append(
            {
                "rank": idx,
                "customer_id": customer["customer_id"],
                "customer_name": customer["customer_name"],
                "total_spend_inc_vat": round(customer["total_spend_inc_vat"], 2),
                "total_spend_ex_vat": round(customer["total_spend_ex_vat"], 2),
                "invoice_count": len(customer["invoice_numbers"]),
                "average_order_value": round(customer["total_spend_ex_vat"] / len(customer["invoice_numbers"]) if customer["invoice_numbers"] else 0.0, 2),
                "last_purchase_date": customer["last_purchase_date"],
                "items": [
                    {
                        "item_id": item_row.get("item_id"),
                        "item_name": item_row.get("item_name") or "Item",
                        "quantity": round(item_row.get("quantity", 0.0), 2),
                        "revenue_ex_vat": round(item_row.get("revenue_ex_vat", 0.0), 2),
                        "revenue_inc_vat": round(item_row.get("revenue_inc_vat", 0.0), 2),
                        "invoice_count": len(item_row.get("invoice_numbers", set())),
                    }
                    for item_row in item_rows
                ],
            }
        )

    top_items_sorted = sorted(
        item_lookup.values(),
        key=lambda row: row["revenue_ex_vat"],
        reverse=True,
    )

    top_item_rows = [
        {
            "rank": idx,
            "item_id": item["item_id"],
            "item_name": item["item_name"],
            "quantity_sold": round(item["quantity_sold"], 2),
            "revenue_ex_vat": round(item["revenue_ex_vat"], 2),
            "revenue_inc_vat": round(item["revenue_inc_vat"], 2),
            "invoice_count": len(item["invoice_numbers"]),
        }
        for idx, item in enumerate(top_items_sorted[:10], start=1)
    ]

    selected_customer_row = None
    if customer_rows:
        target = None
        if customer_id:
            target = next(
                (row for row in customer_rows if str(row["customer_id"]) == str(customer_id)),
                None,
            )
        target = target or customer_rows[0]
        selected_customer_row = target

    recent_invoices = [
        {
            "invoice_date": invoice.invoice_date,
            "invoice_number": invoice.invoice_number,
            "customer_name": invoice.customer_name,
            "total_ex_vat": round(float(invoice.total_ex_vat or 0), 2),
            "total_inc_vat": round(float(invoice.total_inc_vat or 0), 2),
            "status": invoice.status,
        }
        for invoice in invoices[:20]
    ]

    vat_collected = round(total_sales_inc_vat - total_sales_ex_vat, 2)

    return {
        "company_id": company_id,
        "company_name": company.name,
        "range_key": range_key,
        "range_label": RANGE_LABELS.get(range_key, RANGE_LABELS["4w"]),
        "start_date": start_date,
        "end_date": end_date,
        "connection": {
            "connected": connection is not None,
            "zoho_org_id": connection.zoho_org_id if connection else None,
            "connected_email": connection.connected_email if connection else None,
            "last_sync_at": connection.last_sync_at if connection else None,
            "sales_source": company.sales_source,
        },
        "total_sales_inc_vat": round(total_sales_inc_vat, 2),
        "total_sales_ex_vat": round(total_sales_ex_vat, 2),
        "vat_collected": vat_collected,
        "invoice_count": invoice_count,
        "active_customers": active_customers,
        "average_order_value": round(average_order_value, 2),
        "top_customers": customer_rows,
        "customer_breakdown": selected_customer_row,
        "top_items": top_item_rows,
        "invoice_trend": trend,
        "recent_invoices": recent_invoices,
    }


def get_items_analytics_data(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    range_key: str,
    sort: str = "revenue",
    limit: int = 25,
) -> dict:
    try:
        company = (
            db.query(Company)
            .filter(Company.id == company_id, Company.tenant_id == tenant_id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        start_date = _invoice_date_filter(range_key)
        end_date = date.today()

        invoice_items = (
            db.execute(
                select(ZohoSalesInvoiceItem, ZohoSalesInvoice)
                .join(ZohoSalesInvoice, ZohoSalesInvoice.id == ZohoSalesInvoiceItem.zoho_sales_invoice_id)
                .where(
                    ZohoSalesInvoiceItem.tenant_id == tenant_id,
                    ZohoSalesInvoiceItem.company_id == company_id,
                    ZohoSalesInvoice.invoice_date >= start_date,
                    ZohoSalesInvoice.invoice_date <= end_date,
                )
            )
            .all()
        )
    except ProgrammingError as exc:
        _handle_sales_programming_error(exc)
        raise

    item_lookup: dict[str, dict] = {}
    for invoice_item, invoice in invoice_items:
        item_name = invoice_item.item_name or "Item"
        item_key = item_name.lower()
        bucket = item_lookup.setdefault(
            item_key,
            {
                "item_id": invoice_item.item_id,
                "item_name": item_name,
                "quantity_sold": 0.0,
                "revenue_ex_vat": 0.0,
                "revenue_inc_vat": 0.0,
                "invoice_numbers": set(),
            },
        )
        bucket["quantity_sold"] += float(invoice_item.quantity or 0)
        bucket["revenue_ex_vat"] += float(invoice_item.line_total_ex_vat or 0)
        bucket["revenue_inc_vat"] += float(invoice_item.line_total_inc_vat or 0)
        bucket["invoice_numbers"].add(invoice.invoice_number or invoice.zoho_invoice_id)

    sort_key = "quantity_sold" if sort == "qty" else "revenue_ex_vat"
    sorted_items = sorted(item_lookup.values(), key=lambda x: x[sort_key], reverse=True)
    total_revenue = sum(item["revenue_ex_vat"] for item in item_lookup.values())

    items = [
        {
            "rank": idx,
            "item_id": item["item_id"],
            "item_name": item["item_name"],
            "quantity_sold": round(item["quantity_sold"], 2),
            "revenue_ex_vat": round(item["revenue_ex_vat"], 2),
            "revenue_inc_vat": round(item["revenue_inc_vat"], 2),
            "revenue_share": round(item["revenue_ex_vat"] / total_revenue, 4) if total_revenue > 0 else 0.0,
            "invoice_count": len(item["invoice_numbers"]),
        }
        for idx, item in enumerate(sorted_items[:limit], start=1)
    ]

    return {
        "company_id": company_id,
        "range_key": range_key,
        "range_label": RANGE_LABELS.get(range_key, RANGE_LABELS["4w"]),
        "start_date": start_date,
        "end_date": end_date,
        "total_items": len(sorted_items),
        "total_revenue_ex_vat": round(total_revenue, 2),
        "items": items,
    }


def get_customers_analytics_data(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    range_key: str,
    sort: str = "spend",
    limit: int = 25,
) -> dict:
    try:
        company = (
            db.query(Company)
            .filter(Company.id == company_id, Company.tenant_id == tenant_id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        start_date = _invoice_date_filter(range_key)
        end_date = date.today()

        invoice_items = (
            db.execute(
                select(ZohoSalesInvoiceItem, ZohoSalesInvoice)
                .join(ZohoSalesInvoice, ZohoSalesInvoice.id == ZohoSalesInvoiceItem.zoho_sales_invoice_id)
                .where(
                    ZohoSalesInvoiceItem.tenant_id == tenant_id,
                    ZohoSalesInvoiceItem.company_id == company_id,
                    ZohoSalesInvoice.invoice_date >= start_date,
                    ZohoSalesInvoice.invoice_date <= end_date,
                )
            )
            .all()
        )
    except ProgrammingError as exc:
        _handle_sales_programming_error(exc)
        raise

    invoice_map: dict[str, ZohoSalesInvoice] = {}
    for _invoice_item, invoice in invoice_items:
        invoice_key = str(invoice.id)
        if invoice_key not in invoice_map:
            invoice_map[invoice_key] = invoice

    customers = _build_customer_lookup(invoice_map.values())
    _attach_customer_items(customers, invoice_items)

    sort_key = "invoice_count" if sort == "invoices" else "total_spend_ex_vat"
    sorted_customers = sorted(customers.values(), key=lambda x: x[sort_key] if sort != "invoices" else len(x["invoice_numbers"]), reverse=True)

    customer_rows = []
    for idx, customer in enumerate(sorted_customers[:limit], start=1):
        item_rows = sorted(customer["items"].values(), key=lambda r: r["revenue_ex_vat"], reverse=True)[:4]
        customer_rows.append(
            {
                "rank": idx,
                "customer_id": customer["customer_id"],
                "customer_name": customer["customer_name"],
                "total_spend_inc_vat": round(customer["total_spend_inc_vat"], 2),
                "total_spend_ex_vat": round(customer["total_spend_ex_vat"], 2),
                "invoice_count": len(customer["invoice_numbers"]),
                "average_order_value": round(customer["total_spend_ex_vat"] / len(customer["invoice_numbers"]) if customer["invoice_numbers"] else 0.0, 2),
                "last_purchase_date": customer["last_purchase_date"],
                "items": [
                    {
                        "item_id": r.get("item_id"),
                        "item_name": r.get("item_name") or "Item",
                        "quantity": round(r.get("quantity", 0.0), 2),
                        "revenue_ex_vat": round(r.get("revenue_ex_vat", 0.0), 2),
                        "revenue_inc_vat": round(r.get("revenue_inc_vat", 0.0), 2),
                        "invoice_count": len(r.get("invoice_numbers", set())),
                    }
                    for r in item_rows
                ],
            }
        )

    return {
        "company_id": company_id,
        "range_key": range_key,
        "range_label": RANGE_LABELS.get(range_key, RANGE_LABELS["4w"]),
        "start_date": start_date,
        "end_date": end_date,
        "total_customers": len(sorted_customers),
        "customers": customer_rows,
    }
