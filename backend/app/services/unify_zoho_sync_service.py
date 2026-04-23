from __future__ import annotations

import logging
import os
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from dotenv import dotenv_values

from app.core.config import ENV_PATH
from app.models.company import Company
from app.models.zoho_connection import ZohoConnection
from app.models.zoho_sales_invoice import ZohoSalesInvoice
from app.routes.zoho import ZOHO_INVOICE_API_BASE, _utcnow
from app.services.zoho_sales_service import get_valid_access_token, persist_sales_ledger

logger = logging.getLogger(__name__)


def _read_unify_setting(name: str, default: str = "") -> str:
    process_value = os.getenv(name)
    if process_value not in (None, ""):
        return process_value

    env_file_value = dotenv_values(ENV_PATH).get(name)
    if env_file_value in (None, ""):
        return default

    return str(env_file_value)


def _unify_config() -> dict[str, str]:
    return {
        "api_base": _read_unify_setting("UNIFY_API_BASE", "").rstrip("/"),
        "api_key": _read_unify_setting("UNIFY_API_KEY", ""),
        "auth_header": _read_unify_setting("UNIFY_API_AUTH_HEADER", "Authorization"),
        "auth_prefix": _read_unify_setting("UNIFY_API_AUTH_PREFIX", "Bearer"),
        "products_path": _read_unify_setting("UNIFY_PRODUCTS_PATH", "/v1/products"),
        "orders_path": _read_unify_setting("UNIFY_ORDERS_PATH", "/v1/orders"),
    }


def _ensure_unify_config() -> dict[str, str]:
    config = _unify_config()
    if config["api_base"] and config["api_key"]:
        return config

    raise HTTPException(
        status_code=503,
        detail=f"Unify sync is not configured on this server yet. Add UNIFY_API_BASE and UNIFY_API_KEY to {ENV_PATH}.",
    )


def _d(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0")).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _s(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    text = _s(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[: len(fmt)], fmt).date()
        except Exception:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except Exception:
        return None


def _unify_headers() -> dict[str, str]:
    config = _ensure_unify_config()

    token = config["api_key"]
    if config["auth_prefix"]:
        token = f"{config['auth_prefix']} {token}".strip()

    return {config["auth_header"]: token, "Accept": "application/json"}


def _zoho_headers(access_token: str, organization_id: str) -> dict[str, str]:
    return {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "X-com-zoho-invoice-organizationid": organization_id,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _unify_url(path: str) -> str:
    config = _ensure_unify_config()
    return f"{config['api_base']}{path}"


async def _fetch_unify_paginated(client: httpx.AsyncClient, path: str, root_keys: tuple[str, ...]) -> list[dict]:
    items: list[dict] = []
    next_page_token: str | None = None

    while True:
        params: dict[str, Any] = {}
        if next_page_token:
            params["pageToken"] = next_page_token
            params["nextPageToken"] = next_page_token

        response = await client.get(_unify_url(path), params=params, headers=_unify_headers())
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Unify request failed for {path}: {response.text}")

        payload = response.json() if response.content else {}
        batch: list[dict] = []
        for key in root_keys:
            value = payload.get(key)
            if isinstance(value, list):
                batch = value
                break

        items.extend(batch)
        next_page_token = payload.get("nextPageToken") or payload.get("next_page_token") or payload.get("nextToken")
        if not next_page_token:
            break

    return items


def _product_map(products: list[dict]) -> dict[str, dict[str, Any]]:
    mapped: dict[str, dict[str, Any]] = {}
    for product in products:
        product_id = _s(
            product.get("id")
            or product.get("productId")
            or product.get("product_id")
            or product.get("skuId")
        )
        if not product_id:
            continue
        mapped[product_id] = {
            "display_name": _s(
                product.get("displayName")
                or product.get("display_name")
                or product.get("name")
                or product.get("title")
                or product.get("productName")
                or product_id
            ),
            "rate": _d(product.get("rate") or product.get("price") or product.get("unitPrice")),
        }
    return mapped


def _buyer_info(order: dict) -> tuple[str, dict[str, str]]:
    buyer = order.get("buyer") or order.get("customer") or order.get("contact") or {}
    buyer = buyer if isinstance(buyer, dict) else {}
    buyer_id = _s(
        buyer.get("id")
        or buyer.get("buyerId")
        or buyer.get("buyer_id")
        or buyer.get("customerId")
        or buyer.get("customer_id")
        or order.get("buyerId")
        or order.get("buyer_id")
        or order.get("customerId")
        or order.get("customer_id")
    )
    buyer_email = _s(buyer.get("email") or buyer.get("buyerEmail") or order.get("email"))
    buyer_name = _s(
        buyer.get("displayName")
        or buyer.get("name")
        or buyer.get("companyName")
        or order.get("buyerName")
        or order.get("customerName")
        or order.get("name")
        or buyer_email
        or buyer_id
        or "Unknown buyer"
    )
    company_name = _s(buyer.get("companyName") or buyer.get("businessName") or order.get("companyName"))
    key = buyer_id or buyer_email or buyer_name
    return key, {
        "buyer_id": buyer_id,
        "buyer_name": buyer_name,
        "buyer_company_name": company_name,
        "buyer_email": buyer_email,
    }


def _mods(raw_item: dict) -> list[str]:
    labels: list[str] = []
    for key in ("size", "packaging", "variant", "variantName", "variant_name"):
        text = _s(raw_item.get(key))
        if text:
            labels.append(text)
    for key in ("modifications", "modifiers", "options", "attributes", "customizations"):
        value = raw_item.get(key)
        if isinstance(value, list):
            for entry in value:
                if isinstance(entry, dict):
                    text = _s(
                        entry.get("displayName")
                        or entry.get("name")
                        or entry.get("label")
                        or entry.get("title")
                        or entry.get("value")
                    )
                else:
                    text = _s(entry)
                if text:
                    labels.append(text)
        elif isinstance(value, dict):
            for entry in value.values():
                text = _s(entry)
                if text:
                    labels.append(text)
    unique: list[str] = []
    for label in labels:
        if label not in unique:
            unique.append(label)
    return unique


def _extract_items(order: dict, product_map: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    raw_items = order.get("items") or order.get("lineItems") or order.get("line_items") or []
    if not isinstance(raw_items, list):
        return []

    line_items: list[dict[str, Any]] = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        product_id = _s(raw_item.get("productId") or raw_item.get("product_id") or raw_item.get("itemId") or raw_item.get("id"))
        product = product_map.get(product_id, {})
        base_name = _s(
            product.get("display_name")
            or raw_item.get("name")
            or raw_item.get("productName")
            or raw_item.get("title")
            or product_id
            or "Item"
        )
        modifiers = _mods(raw_item)
        item_name = f"{base_name} - {' / '.join(modifiers)}" if modifiers else base_name
        quantity = _d(raw_item.get("quantity") or raw_item.get("qty") or raw_item.get("count") or 1)
        line_ex = _d(
            raw_item.get("lineTotal")
            or raw_item.get("line_total")
            or raw_item.get("subtotal")
            or raw_item.get("subTotal")
            or raw_item.get("amount")
            or raw_item.get("price")
        )
        rate = _d(raw_item.get("rate") or raw_item.get("unitPrice") or raw_item.get("unit_price"))
        if rate <= Decimal("0.00") and quantity > Decimal("0.00") and line_ex > Decimal("0.00"):
            rate = (line_ex / quantity).quantize(Decimal("0.01"))
        if line_ex <= Decimal("0.00") and quantity > Decimal("0.00") and rate > Decimal("0.00"):
            line_ex = (quantity * rate).quantize(Decimal("0.01"))
        line_items.append(
            {
                "product_id": product_id or None,
                "item_name": item_name,
                "quantity": quantity,
                "rate": rate,
                "line_total_ex_vat": line_ex,
                "line_total_inc_vat": line_ex,
                "tax_amount": Decimal("0.00"),
            }
        )

    order_tax = _d(order.get("taxAmount") or order.get("tax_amount") or order.get("tax_total"))
    if order_tax > Decimal("0.00") and line_items:
        total_ex = sum((item["line_total_ex_vat"] for item in line_items), Decimal("0.00"))
        if total_ex > Decimal("0.00"):
            allocated = Decimal("0.00")
            for index, item in enumerate(line_items):
                if index == len(line_items) - 1:
                    item_tax = (order_tax - allocated).quantize(Decimal("0.01"))
                else:
                    item_tax = (order_tax * (item["line_total_ex_vat"] / total_ex)).quantize(Decimal("0.01"))
                    allocated += item_tax
                item["tax_amount"] = item_tax
                item["line_total_inc_vat"] = (item["line_total_ex_vat"] + item_tax).quantize(Decimal("0.01"))

    return line_items


def _order_amounts(order: dict, items: list[dict[str, Any]]) -> tuple[Decimal, Decimal, Decimal]:
    total_inc = _d(order.get("total") or order.get("grandTotal") or order.get("grand_total"))
    total_ex = _d(order.get("subtotal") or order.get("sub_total"))
    tax_total = _d(order.get("taxAmount") or order.get("tax_amount") or order.get("tax_total"))
    if total_ex <= Decimal("0.00"):
        total_ex = sum((item["line_total_ex_vat"] for item in items), Decimal("0.00"))
    if total_inc <= Decimal("0.00") and total_ex > Decimal("0.00"):
        total_inc = (total_ex + tax_total).quantize(Decimal("0.01"))
    if tax_total <= Decimal("0.00") and total_inc > Decimal("0.00") and total_ex > Decimal("0.00"):
        tax_total = (total_inc - total_ex).quantize(Decimal("0.01"))
    return total_inc, total_ex, tax_total


def _order_id(order: dict) -> str:
    return _s(order.get("id") or order.get("orderId") or order.get("order_id") or order.get("number"))


def _buyer_group_key(buyer_key: str, orders: list[dict]) -> str:
    order_ids = sorted({_order_id(order) for order in orders if _order_id(order)})
    return f"{buyer_key}|{','.join(order_ids)}" if order_ids else buyer_key


async def _fetch_zoho_contacts(client: httpx.AsyncClient, access_token: str, organization_id: str) -> list[dict]:
    contacts: list[dict] = []
    page = 1
    while True:
        response = await client.get(
            f"{ZOHO_INVOICE_API_BASE}/contacts",
            headers=_zoho_headers(access_token, organization_id),
            params={"organization_id": organization_id, "page": page, "per_page": 200},
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Zoho contacts fetch failed: {response.text}")
        payload = response.json() if response.content else {}
        batch = payload.get("contacts", []) or []
        contacts.extend(batch)
        if len(batch) < 200:
            return contacts
        page += 1


async def _fetch_zoho_items(client: httpx.AsyncClient, access_token: str, organization_id: str) -> list[dict]:
    items: list[dict] = []
    page = 1
    while True:
        response = await client.get(
            f"{ZOHO_INVOICE_API_BASE}/items",
            headers=_zoho_headers(access_token, organization_id),
            params={"organization_id": organization_id, "page": page, "per_page": 200},
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Zoho items fetch failed: {response.text}")
        payload = response.json() if response.content else {}
        batch = payload.get("items", []) or []
        items.extend(batch)
        if len(batch) < 200:
            return items
        page += 1


def _contact_key(contact: dict) -> str:
    return _s(contact.get("contact_name") or contact.get("company_name") or contact.get("email") or contact.get("name")).lower()


def _item_key(name: str) -> str:
    return _s(name).lower()


async def _find_or_create_contact(
    *,
    client: httpx.AsyncClient,
    access_token: str,
    organization_id: str,
    contacts_by_key: dict[str, dict],
    buyer: dict[str, str],
) -> tuple[str, bool]:
    for candidate in (buyer.get("buyer_email"), buyer.get("buyer_name"), buyer.get("buyer_company_name")):
        key = _s(candidate).lower()
        if key and key in contacts_by_key:
            contact = contacts_by_key[key]
            return _s(contact.get("contact_id") or contact.get("contactId") or contact.get("id")), False

    contact_name = buyer.get("buyer_company_name") or buyer.get("buyer_name") or buyer.get("buyer_email") or "Unify Buyer"
    payload: dict[str, Any] = {
        "contact_name": contact_name[:100],
        "company_name": contact_name[:100],
        "contact_type": "customer",
    }
    if buyer.get("buyer_email"):
        payload["email"] = buyer["buyer_email"]

    response = await client.post(
        f"{ZOHO_INVOICE_API_BASE}/contacts",
        headers=_zoho_headers(access_token, organization_id),
        params={"organization_id": organization_id},
        json=payload,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=f"Zoho contact create failed: {response.text}")

    payload = response.json() if response.content else {}
    contact = payload.get("contact") or payload.get("contacts") or payload
    contact_id = _s(contact.get("contact_id") or contact.get("contactId") or contact.get("id"))
    if not contact_id:
        raise HTTPException(status_code=400, detail="Zoho contact create did not return a contact id")
    contacts_by_key[_contact_key(contact)] = contact
    return contact_id, True


async def _find_or_create_item(
    *,
    client: httpx.AsyncClient,
    access_token: str,
    organization_id: str,
    items_by_key: dict[str, dict],
    item_name: str,
    rate: Decimal,
    description: str,
    sku: str | None = None,
) -> tuple[str, bool]:
    key = _item_key(item_name)
    if key in items_by_key:
        item = items_by_key[key]
        return _s(item.get("item_id") or item.get("itemId") or item.get("id")), False

    payload: dict[str, Any] = {
        "name": item_name[:100],
        "rate": float(rate),
        "description": description[:2000],
        "product_type": "goods",
    }
    if sku:
        payload["sku"] = sku[:100]

    response = await client.post(
        f"{ZOHO_INVOICE_API_BASE}/items",
        headers=_zoho_headers(access_token, organization_id),
        params={"organization_id": organization_id},
        json=payload,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=f"Zoho item create failed: {response.text}")

    payload = response.json() if response.content else {}
    item = payload.get("item") or payload.get("items") or payload
    item_id = _s(item.get("item_id") or item.get("itemId") or item.get("id"))
    if not item_id:
        raise HTTPException(status_code=400, detail="Zoho item create did not return an item id")
    items_by_key[key] = item
    return item_id, True


async def _create_invoice(
    *,
    client: httpx.AsyncClient,
    access_token: str,
    organization_id: str,
    customer_id: str,
    invoice_date: date,
    line_items: list[dict[str, Any]],
    unify_order_id: str,
) -> dict:
    response = await client.post(
        f"{ZOHO_INVOICE_API_BASE}/invoices",
        headers=_zoho_headers(access_token, organization_id),
        params={"organization_id": organization_id},
        json={
            "customer_id": customer_id,
            "date": invoice_date.isoformat(),
            "reference_number": unify_order_id[:100],
            "is_inclusive_tax": False,
            "line_items": line_items,
        },
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=f"Zoho invoice create failed: {response.text}")
    payload = response.json() if response.content else {}
    return payload.get("invoice") or payload.get("invoices") or payload


async def sync_unify_orders_to_zoho_invoices(
    *,
    db: Session,
    tenant_id: UUID,
    company_id: UUID,
) -> dict[str, Any]:
    config = _ensure_unify_config()

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
        raise HTTPException(status_code=400, detail="Zoho is connected but no valid organization ID is saved yet")

    access_token = await get_valid_access_token(db, connection)
    logs: list[str] = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        products = await _fetch_unify_paginated(client, config["products_path"], ("products", "data", "items"))
        orders = await _fetch_unify_paginated(client, config["orders_path"], ("orders", "data", "items"))
        logs.append(f"products loaded: {len(products)}")
        logs.append(f"orders fetched: {len(orders)}")
        logger.info("Unify products loaded: %s", len(products))
        logger.info("Unify orders fetched: %s", len(orders))

        product_map = _product_map(products)
        groups: dict[str, dict[str, Any]] = defaultdict(lambda: {"buyer": {}, "orders": []})
        for order in orders:
            if not isinstance(order, dict):
                continue
            buyer_key, buyer = _buyer_info(order)
            groups[buyer_key]["buyer"] = buyer
            groups[buyer_key]["orders"].append(order)

        contacts = await _fetch_zoho_contacts(client, access_token, organization_id)
        items = await _fetch_zoho_items(client, access_token, organization_id)
        contacts_by_key = {_contact_key(contact): contact for contact in contacts}
        items_by_key = {_item_key(_s(item.get("name") or item.get("item_name"))): item for item in items}

        existing_unify_order_ids = {
            _s(invoice.unify_order_id)
            for invoice in db.execute(
                select(ZohoSalesInvoice).where(
                    ZohoSalesInvoice.tenant_id == tenant_id,
                    ZohoSalesInvoice.company_id == company_id,
                    ZohoSalesInvoice.unify_order_id.is_not(None),
                )
            ).scalars().all()
            if _s(invoice.unify_order_id)
        }

        created_records: list[dict[str, Any]] = []
        duplicates_skipped = 0
        contacts_created = 0
        contacts_reused = 0
        items_created = 0
        items_reused = 0
        line_items_created = 0

        for buyer_key, group in groups.items():
            buyer = group["buyer"] or {}
            buyer_orders = [order for order in group["orders"] if isinstance(order, dict)]
            if not buyer_orders:
                continue

            unify_order_id = _buyer_group_key(buyer_key, buyer_orders)
            if unify_order_id in existing_unify_order_ids:
                duplicates_skipped += 1
                logs.append(f"skipped duplicate: {unify_order_id}")
                logger.info("Skipped duplicate Unify group: %s", unify_order_id)
                continue

            per_order_items: list[dict[str, Any]] = []
            order_dates: list[date] = []
            buyer_total_inc = Decimal("0.00")
            buyer_total_ex = Decimal("0.00")
            buyer_tax_total = Decimal("0.00")
            for order in buyer_orders:
                order_date = _parse_date(order.get("date") or order.get("orderDate") or order.get("createdAt") or order.get("created_at"))
                if order_date:
                    order_dates.append(order_date)
                order_items = _extract_items(order, product_map)
                per_order_items.extend(order_items)
                order_inc, order_ex, order_tax = _order_amounts(order, order_items)
                buyer_total_inc += order_inc
                buyer_total_ex += order_ex
                buyer_tax_total += order_tax

            if not per_order_items:
                logs.append(f"skipped buyer without line items: {buyer.get('buyer_name') or buyer_key}")
                continue

            grouped_items: dict[tuple[str, str], dict[str, Any]] = {}
            for item in per_order_items:
                key = (item["item_name"].lower(), f"{item['rate']:.2f}")
                bucket = grouped_items.setdefault(
                    key,
                    {
                        "item_name": item["item_name"],
                        "quantity": Decimal("0.00"),
                        "rate": item["rate"],
                        "line_total_ex_vat": Decimal("0.00"),
                        "line_total_inc_vat": Decimal("0.00"),
                    },
                )
                bucket["quantity"] += item["quantity"]
                bucket["line_total_ex_vat"] += item["line_total_ex_vat"]
                bucket["line_total_inc_vat"] += item["line_total_inc_vat"]

            contact_id, contact_created = await _find_or_create_contact(
                client=client,
                access_token=access_token,
                organization_id=organization_id,
                contacts_by_key=contacts_by_key,
                buyer=buyer,
            )
            if contact_created:
                contacts_created += 1
            else:
                contacts_reused += 1

            invoice_items: list[dict[str, Any]] = []
            for item in grouped_items.values():
                item_name = item["item_name"]
                item_id, created = await _find_or_create_item(
                    client=client,
                    access_token=access_token,
                    organization_id=organization_id,
                    items_by_key=items_by_key,
                    item_name=item_name,
                    rate=item["rate"],
                    description=item_name,
                    sku=f"unify:{item_name[:40]}",
                )
                if created:
                    items_created += 1
                else:
                    items_reused += 1
                invoice_items.append(
                    {
                        "item_id": item_id,
                        "name": item_name[:100],
                        "quantity": float(item["quantity"]),
                        "rate": float(item["rate"]),
                        "description": item_name[:2000],
                    }
                )
                line_items_created += 1

            invoice_items.sort(key=lambda row: row["name"])
            invoice_date = max(order_dates) if order_dates else date.today()
            invoice_number = _s(
                buyer_orders[0].get("invoiceNumber")
                or buyer_orders[0].get("invoice_number")
                or buyer_orders[0].get("number")
            ) or None
            invoice = await _create_invoice(
                client=client,
                access_token=access_token,
                organization_id=organization_id,
                customer_id=contact_id,
                invoice_date=invoice_date,
                line_items=invoice_items,
                unify_order_id=unify_order_id,
            )

            zoho_invoice_id = _s(invoice.get("invoice_id") or invoice.get("invoiceId") or invoice.get("id") or unify_order_id)
            created_records.append(
                {
                    "invoice_id": zoho_invoice_id,
                    "invoice_number": _s(invoice.get("invoice_number") or invoice.get("invoiceNumber")) or None,
                    "customer_id": _s(invoice.get("customer_id") or invoice.get("customerId") or contact_id) or None,
                    "customer_name": _s(invoice.get("customer_name") or invoice.get("customerName") or buyer.get("buyer_name") or buyer.get("buyer_company_name")),
                    "date": invoice_date.isoformat(),
                    "invoice_date": invoice_date.isoformat(),
                    "status": "draft",
                    "currency": _s(invoice.get("currency_code") or invoice.get("currency") or "EUR"),
                    "total": float(buyer_total_inc),
                    "subtotal": float(buyer_total_ex),
                    "tax_total": float(buyer_tax_total),
                    "line_items": [
                        {
                            "item_id": line["item_id"],
                            "item_name": line["name"],
                            "quantity": line["quantity"],
                            "rate": line["rate"],
                            "line_total_ex_vat": line["quantity"] * line["rate"],
                            "line_total_inc_vat": line["quantity"] * line["rate"],
                            "tax_amount": 0,
                        }
                        for line in invoice_items
                    ],
                    "sync_source": "unify",
                    "unify_order_id": unify_order_id,
                }
            )
            logs.append(f"invoices created: {invoice_number or zoho_invoice_id}")
            logger.info("Created Zoho draft invoice for unify group %s", unify_order_id)
            existing_unify_order_ids.add(unify_order_id)

        ledger_counts = persist_sales_ledger(
            db,
            tenant_id=tenant_id,
            company_id=company_id,
            invoices=created_records,
            sync_source="unify",
        )
        connection.last_sync_at = _utcnow()
        db.add(connection)
        db.commit()

    logs.append(f"buyer groups: {len(groups)}")
    logs.append(f"duplicates skipped: {duplicates_skipped}")
    logs.append(f"contacts created: {contacts_created}")
    logs.append(f"items created: {items_created}")
    logs.append(f"ledger invoices synced: {ledger_counts['invoices_synced']}")

    return {
        "success": True,
        "company_id": str(company_id),
        "products_loaded": len(product_map),
        "orders_fetched": len(orders),
        "buyer_groups": len(groups),
        "invoices_created": len(created_records),
        "duplicates_skipped": duplicates_skipped,
        "contacts_created": contacts_created,
        "contacts_reused": contacts_reused,
        "items_created": items_created,
        "items_reused": items_reused,
        "line_items_created": line_items_created,
        "logs": logs,
    }
