from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.company import Company
from app.models.ingredient import Ingredient
from app.models.purchase_invoice import PurchaseInvoice
from app.models.purchase_invoice_line import PurchaseInvoiceLine
from app.schemas.purchase_invoice import PurchaseInvoiceCreate, PurchaseInvoiceUpdate


MONEY_QUANT = Decimal("0.01")
UNIT_COST_QUANT = Decimal("0.000001")


def _to_decimal(value: object | None) -> Decimal:
    if value in (None, ""):
        return Decimal("0")
    return Decimal(str(value))


def _round_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _round_unit_cost(value: Decimal) -> Decimal:
    return value.quantize(UNIT_COST_QUANT, rounding=ROUND_HALF_UP)


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _serialize_invoice(invoice: PurchaseInvoice) -> dict:
    return {
        "id": invoice.id,
        "tenant_id": invoice.tenant_id,
        "company_id": invoice.company_id,
        "supplier_name": invoice.supplier_name,
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,
        "currency": invoice.currency,
        "notes": invoice.notes,
        "attachment_name": invoice.attachment_name,
        "vat_included": invoice.vat_included,
        "subtotal_ex_vat": round(float(invoice.subtotal_ex_vat or 0), 2),
        "vat_total": round(float(invoice.vat_total or 0), 2),
        "total_inc_vat": round(float(invoice.total_inc_vat or 0), 2),
        "status": invoice.status,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
        "lines": [
            {
                "id": line.id,
                "ingredient_id": line.ingredient_id,
                "line_order": line.line_order,
                "ingredient_name": line.ingredient_name,
                "ingredient_sku": line.ingredient_sku,
                "category": line.category,
                "quantity_purchased": round(float(line.quantity_purchased or 0), 3),
                "purchase_unit": line.purchase_unit,
                "pack_size_value": round(float(line.pack_size_value or 0), 3) if line.pack_size_value is not None else None,
                "pack_size_unit": line.pack_size_unit,
                "net_quantity_for_costing": round(float(line.net_quantity_for_costing or 0), 3),
                "costing_unit": line.costing_unit,
                "line_total_ex_vat": round(float(line.line_total_ex_vat or 0), 2),
                "vat_rate": round(float(line.vat_rate or 0), 2),
                "vat_amount": round(float(line.vat_amount or 0), 2),
                "line_total_inc_vat": round(float(line.line_total_inc_vat or 0), 2),
                "normalized_unit_cost_ex_vat": round(float(line.normalized_unit_cost_ex_vat or 0), 6),
                "normalized_unit_cost_inc_vat": round(float(line.normalized_unit_cost_inc_vat or 0), 6),
                "brand": line.brand,
                "supplier_product_name": line.supplier_product_name,
            }
            for line in sorted(invoice.lines, key=lambda row: row.line_order)
        ],
    }


def _build_invoice_lines(
    *,
    tenant_id: UUID,
    company_id: UUID,
    payload: PurchaseInvoiceCreate | PurchaseInvoiceUpdate,
) -> tuple[list[PurchaseInvoiceLine], Decimal, Decimal, Decimal]:
    line_models: list[PurchaseInvoiceLine] = []
    subtotal_ex_vat = Decimal("0")
    vat_total = Decimal("0")
    total_inc_vat = Decimal("0")

    for index, item in enumerate(payload.lines, start=1):
        line_total_ex_vat = _round_money(_to_decimal(item.line_total_ex_vat))
        vat_rate = _to_decimal(item.vat_rate)
        computed_vat_amount = _round_money(line_total_ex_vat * (vat_rate / Decimal("100")))
        line_total_inc = _round_money(
            _to_decimal(item.line_total_inc_vat) if item.line_total_inc_vat is not None else line_total_ex_vat + computed_vat_amount
        )
        if line_total_inc < line_total_ex_vat:
            raise HTTPException(status_code=400, detail=f"Line {index} has inc VAT lower than ex VAT")

        vat_amount = _round_money(line_total_inc - line_total_ex_vat)
        net_quantity = _to_decimal(item.net_quantity_for_costing)
        normalized_ex = _round_unit_cost(line_total_ex_vat / net_quantity)
        normalized_inc = _round_unit_cost(line_total_inc / net_quantity)

        line_models.append(
            PurchaseInvoiceLine(
                tenant_id=tenant_id,
                company_id=company_id,
                line_order=index,
                ingredient_name=item.ingredient_name.strip(),
                ingredient_sku=item.ingredient_sku.strip() if item.ingredient_sku else None,
                category=item.category.strip() if item.category else None,
                quantity_purchased=float(_to_decimal(item.quantity_purchased)),
                purchase_unit=item.purchase_unit.strip().lower(),
                pack_size_value=float(_to_decimal(item.pack_size_value)) if item.pack_size_value is not None else None,
                pack_size_unit=item.pack_size_unit.strip().lower() if item.pack_size_unit else None,
                net_quantity_for_costing=float(net_quantity),
                costing_unit=item.costing_unit.strip().lower(),
                line_total_ex_vat=float(line_total_ex_vat),
                vat_rate=float(vat_rate),
                vat_amount=float(vat_amount),
                line_total_inc_vat=float(line_total_inc),
                normalized_unit_cost_ex_vat=float(normalized_ex),
                normalized_unit_cost_inc_vat=float(normalized_inc),
                brand=item.brand.strip() if item.brand else None,
                supplier_product_name=item.supplier_product_name.strip() if item.supplier_product_name else None,
            )
        )

        subtotal_ex_vat += line_total_ex_vat
        vat_total += vat_amount
        total_inc_vat += line_total_inc

    return line_models, subtotal_ex_vat, vat_total, total_inc_vat


def _get_company_or_404(db: Session, tenant_id: UUID, company_id: UUID) -> Company:
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def _upsert_ingredient_from_line(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    supplier_name: str,
    invoice_date,
    line: PurchaseInvoiceLine,
) -> Ingredient:
    normalized_name = _normalize_name(line.ingredient_name)
    ingredient = (
        db.query(Ingredient)
        .filter(
            Ingredient.tenant_id == tenant_id,
            Ingredient.company_id == company_id,
            Ingredient.normalized_name == normalized_name,
        )
        .first()
    )

    if not ingredient:
        ingredient = Ingredient(
            tenant_id=tenant_id,
            company_id=company_id,
            name=line.ingredient_name.strip(),
            normalized_name=normalized_name,
            default_unit_for_costing=line.costing_unit,
            category=line.category,
            latest_unit_cost_ex_vat=float(line.normalized_unit_cost_ex_vat or 0),
            latest_unit_cost_inc_vat=float(line.normalized_unit_cost_inc_vat or 0),
            latest_purchase_date=invoice_date,
            latest_supplier_name=supplier_name,
        )
        db.add(ingredient)
        db.flush()
        return ingredient

    if not ingredient.name:
        ingredient.name = line.ingredient_name.strip()
    if not ingredient.default_unit_for_costing:
        ingredient.default_unit_for_costing = line.costing_unit
    if line.category and not ingredient.category:
        ingredient.category = line.category

    if ingredient.latest_purchase_date is None or invoice_date >= ingredient.latest_purchase_date:
        ingredient.latest_unit_cost_ex_vat = float(line.normalized_unit_cost_ex_vat or 0)
        ingredient.latest_unit_cost_inc_vat = float(line.normalized_unit_cost_inc_vat or 0)
        ingredient.latest_purchase_date = invoice_date
        ingredient.latest_supplier_name = supplier_name
        ingredient.default_unit_for_costing = line.costing_unit
        ingredient.category = line.category or ingredient.category

    db.add(ingredient)
    db.flush()
    return ingredient


def _latest_line_for_ingredient(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    ingredient_id: UUID,
) -> tuple[PurchaseInvoiceLine, PurchaseInvoice] | None:
    row = (
        db.query(PurchaseInvoiceLine, PurchaseInvoice)
        .join(PurchaseInvoice, PurchaseInvoice.id == PurchaseInvoiceLine.purchase_invoice_id)
        .filter(
            PurchaseInvoiceLine.tenant_id == tenant_id,
            PurchaseInvoiceLine.company_id == company_id,
            PurchaseInvoiceLine.ingredient_id == ingredient_id,
            PurchaseInvoice.status == "posted",
        )
        .order_by(
            PurchaseInvoice.invoice_date.desc(),
            PurchaseInvoice.created_at.desc(),
            PurchaseInvoiceLine.created_at.desc(),
            PurchaseInvoiceLine.line_order.desc(),
        )
        .first()
    )
    return row


def _rebuild_ingredient_latest_memory(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    ingredient_ids: set[UUID],
) -> None:
    if not ingredient_ids:
        return

    for ingredient_id in ingredient_ids:
        ingredient = (
            db.query(Ingredient)
            .filter(
                Ingredient.id == ingredient_id,
                Ingredient.tenant_id == tenant_id,
                Ingredient.company_id == company_id,
            )
            .first()
        )
        if not ingredient:
            continue

        latest_row = _latest_line_for_ingredient(
            db,
            tenant_id=tenant_id,
            company_id=company_id,
            ingredient_id=ingredient_id,
        )

        if not latest_row:
            ingredient.latest_unit_cost_ex_vat = None
            ingredient.latest_unit_cost_inc_vat = None
            ingredient.latest_purchase_date = None
            ingredient.latest_supplier_name = None
            db.add(ingredient)
            continue

        line, invoice = latest_row
        ingredient.latest_unit_cost_ex_vat = float(line.normalized_unit_cost_ex_vat or 0)
        ingredient.latest_unit_cost_inc_vat = float(line.normalized_unit_cost_inc_vat or 0)
        ingredient.latest_purchase_date = invoice.invoice_date
        ingredient.latest_supplier_name = invoice.supplier_name
        ingredient.default_unit_for_costing = line.costing_unit
        if line.category:
            ingredient.category = line.category
        db.add(ingredient)


def list_purchase_invoices(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
) -> dict:
    _get_company_or_404(db, tenant_id, company_id)

    invoices = (
        db.query(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.lines))
        .filter(
            PurchaseInvoice.tenant_id == tenant_id,
            PurchaseInvoice.company_id == company_id,
        )
        .order_by(PurchaseInvoice.invoice_date.desc(), PurchaseInvoice.created_at.desc())
        .all()
    )

    return {
        "company_id": company_id,
        "total_invoices": len(invoices),
        "posted_invoices": sum(1 for invoice in invoices if invoice.status == "posted"),
        "draft_invoices": sum(1 for invoice in invoices if invoice.status == "draft"),
        "total_spend_ex_vat": round(sum(float(invoice.subtotal_ex_vat or 0) for invoice in invoices), 2),
        "total_spend_inc_vat": round(sum(float(invoice.total_inc_vat or 0) for invoice in invoices), 2),
        "invoices": [_serialize_invoice(invoice) for invoice in invoices],
    }


def get_purchase_invoice(
    db: Session,
    *,
    tenant_id: UUID,
    invoice_id: UUID,
) -> dict:
    invoice = (
        db.query(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.lines))
        .filter(
            PurchaseInvoice.id == invoice_id,
            PurchaseInvoice.tenant_id == tenant_id,
        )
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    return _serialize_invoice(invoice)


def create_purchase_invoice(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    payload: PurchaseInvoiceCreate,
) -> dict:
    _get_company_or_404(db, tenant_id, company_id)
    line_models, subtotal_ex_vat, vat_total, total_inc_vat = _build_invoice_lines(
        tenant_id=tenant_id,
        company_id=company_id,
        payload=payload,
    )

    header_subtotal = _round_money(_to_decimal(payload.subtotal_ex_vat)) if payload.subtotal_ex_vat is not None else _round_money(subtotal_ex_vat)
    header_vat_total = _round_money(_to_decimal(payload.vat_total)) if payload.vat_total is not None else _round_money(vat_total)
    header_total_inc = _round_money(_to_decimal(payload.total_inc_vat)) if payload.total_inc_vat is not None else _round_money(total_inc_vat)

    if abs(header_subtotal - _round_money(subtotal_ex_vat)) > Decimal("0.01"):
        raise HTTPException(status_code=400, detail="Invoice subtotal does not match line totals")
    if abs(header_vat_total - _round_money(vat_total)) > Decimal("0.01"):
        raise HTTPException(status_code=400, detail="Invoice VAT total does not match line totals")
    if abs(header_total_inc - _round_money(total_inc_vat)) > Decimal("0.01"):
        raise HTTPException(status_code=400, detail="Invoice total inc VAT does not match line totals")

    invoice = PurchaseInvoice(
        tenant_id=tenant_id,
        company_id=company_id,
        supplier_name=payload.supplier_name.strip(),
        invoice_number=payload.invoice_number.strip(),
        invoice_date=payload.invoice_date,
        due_date=payload.due_date,
        currency=payload.currency.strip().upper(),
        notes=payload.notes.strip() if payload.notes else None,
        attachment_name=payload.attachment_name.strip() if payload.attachment_name else None,
        vat_included=payload.vat_included,
        subtotal_ex_vat=float(header_subtotal),
        vat_total=float(header_vat_total),
        total_inc_vat=float(header_total_inc),
        status=payload.status,
    )

    for line in line_models:
        invoice.lines.append(line)

    db.add(invoice)

    try:
        db.flush()

        if invoice.status == "posted":
            for line in invoice.lines:
                ingredient = _upsert_ingredient_from_line(
                    db,
                    tenant_id=tenant_id,
                    company_id=company_id,
                    supplier_name=invoice.supplier_name,
                    invoice_date=invoice.invoice_date,
                    line=line,
                )
                line.ingredient_id = ingredient.id
                db.add(line)

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Invoice number already exists for this supplier in this company") from exc

    db.refresh(invoice)
    invoice = (
        db.query(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.lines))
        .filter(PurchaseInvoice.id == invoice.id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=500, detail="Purchase invoice could not be reloaded after creation")

    return _serialize_invoice(invoice)


def update_purchase_invoice(
    db: Session,
    *,
    tenant_id: UUID,
    invoice_id: UUID,
    payload: PurchaseInvoiceUpdate,
) -> dict:
    invoice = (
        db.query(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.lines))
        .filter(
            PurchaseInvoice.id == invoice_id,
            PurchaseInvoice.tenant_id == tenant_id,
        )
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    _get_company_or_404(db, tenant_id, invoice.company_id)

    affected_ingredient_ids = {line.ingredient_id for line in invoice.lines if line.ingredient_id}

    line_models, subtotal_ex_vat, vat_total, total_inc_vat = _build_invoice_lines(
        tenant_id=tenant_id,
        company_id=invoice.company_id,
        payload=payload,
    )

    invoice.supplier_name = payload.supplier_name.strip()
    invoice.invoice_number = payload.invoice_number.strip()
    invoice.invoice_date = payload.invoice_date
    invoice.due_date = payload.due_date
    invoice.currency = payload.currency.strip().upper()
    invoice.notes = payload.notes.strip() if payload.notes else None
    invoice.attachment_name = payload.attachment_name.strip() if payload.attachment_name else None
    invoice.vat_included = payload.vat_included
    invoice.subtotal_ex_vat = float(_round_money(subtotal_ex_vat))
    invoice.vat_total = float(_round_money(vat_total))
    invoice.total_inc_vat = float(_round_money(total_inc_vat))
    invoice.status = payload.status

    invoice.lines.clear()
    db.flush()

    for line in line_models:
        invoice.lines.append(line)

    db.flush()

    if invoice.status == "posted":
        for line in invoice.lines:
            ingredient = _upsert_ingredient_from_line(
                db,
                tenant_id=tenant_id,
                company_id=invoice.company_id,
                supplier_name=invoice.supplier_name,
                invoice_date=invoice.invoice_date,
                line=line,
            )
            line.ingredient_id = ingredient.id
            affected_ingredient_ids.add(ingredient.id)
            db.add(line)

    try:
        db.flush()
        _rebuild_ingredient_latest_memory(
            db,
            tenant_id=tenant_id,
            company_id=invoice.company_id,
            ingredient_ids={ingredient_id for ingredient_id in affected_ingredient_ids if ingredient_id},
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Invoice number already exists for this supplier in this company") from exc

    invoice = (
        db.query(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.lines))
        .filter(PurchaseInvoice.id == invoice.id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=500, detail="Purchase invoice could not be reloaded after update")

    return _serialize_invoice(invoice)


def delete_purchase_invoice(
    db: Session,
    *,
    tenant_id: UUID,
    invoice_id: UUID,
) -> dict:
    invoice = (
        db.query(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.lines))
        .filter(
            PurchaseInvoice.id == invoice_id,
            PurchaseInvoice.tenant_id == tenant_id,
        )
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    company_id = invoice.company_id
    affected_ingredient_ids = {line.ingredient_id for line in invoice.lines if line.ingredient_id}

    db.delete(invoice)
    db.flush()
    _rebuild_ingredient_latest_memory(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        ingredient_ids={ingredient_id for ingredient_id in affected_ingredient_ids if ingredient_id},
    )
    db.commit()

    return {"success": True}
