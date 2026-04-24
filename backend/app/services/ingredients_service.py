from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import case, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.schemas.ingredient import IngredientUpdate


def _round_float(value: object | None, digits: int = 6) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _serialize_ingredient(ingredient: Ingredient, purchase_count: int = 0) -> dict:
    return {
        "id": ingredient.id,
        "tenant_id": ingredient.tenant_id,
        "company_id": ingredient.company_id,
        "name": ingredient.name,
        "normalized_name": ingredient.normalized_name,
        "default_unit_for_costing": ingredient.default_unit_for_costing,
        "category": ingredient.category,
        "latest_unit_cost_ex_vat": _round_float(ingredient.latest_unit_cost_ex_vat),
        "latest_unit_cost_inc_vat": _round_float(ingredient.latest_unit_cost_inc_vat),
        "latest_purchase_date": ingredient.latest_purchase_date,
        "latest_supplier_name": ingredient.latest_supplier_name,
        "notes": ingredient.notes,
        "is_active": ingredient.is_active,
        "created_at": ingredient.created_at,
        "updated_at": ingredient.updated_at,
        "purchase_count": purchase_count,
    }


def _get_company_or_404(db: Session, tenant_id: UUID, company_id: UUID) -> Company:
    from app.db.models import Company

    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def list_ingredients(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    search: str | None = None,
    view: str = "all",
) -> dict:
    from app.db.models import Ingredient, PurchaseInvoiceLine

    _get_company_or_404(db, tenant_id, company_id)

    counts = (
        db.query(
            func.count(Ingredient.id),
            func.sum(case((Ingredient.is_active.is_(True), 1), else_=0)),
            func.sum(case((Ingredient.is_active.is_(False), 1), else_=0)),
            func.sum(case((Ingredient.latest_unit_cost_ex_vat.is_(None), 1), else_=0)),
        )
        .filter(
            Ingredient.tenant_id == tenant_id,
            Ingredient.company_id == company_id,
        )
        .first()
    )
    total_ingredients = int(counts[0] or 0)
    active_ingredients = int(counts[1] or 0)
    inactive_ingredients = int(counts[2] or 0)
    missing_price_ingredients = int(counts[3] or 0)

    purchase_counts_subquery = (
        db.query(
            PurchaseInvoiceLine.ingredient_id.label("ingredient_id"),
            func.count(PurchaseInvoiceLine.id).label("purchase_count"),
        )
        .filter(
            PurchaseInvoiceLine.tenant_id == tenant_id,
            PurchaseInvoiceLine.company_id == company_id,
            PurchaseInvoiceLine.ingredient_id.isnot(None),
        )
        .group_by(PurchaseInvoiceLine.ingredient_id)
        .subquery()
    )

    query = (
        db.query(Ingredient, func.coalesce(purchase_counts_subquery.c.purchase_count, 0))
        .outerjoin(purchase_counts_subquery, purchase_counts_subquery.c.ingredient_id == Ingredient.id)
        .filter(
            Ingredient.tenant_id == tenant_id,
            Ingredient.company_id == company_id,
        )
    )

    if view == "active":
        query = query.filter(Ingredient.is_active.is_(True))
    elif view == "inactive":
        query = query.filter(Ingredient.is_active.is_(False))

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Ingredient.name.ilike(pattern),
                Ingredient.category.ilike(pattern),
                Ingredient.latest_supplier_name.ilike(pattern),
            )
        )

    rows = (
        query.order_by(
            Ingredient.is_active.desc(),
            Ingredient.latest_purchase_date.desc().nullslast(),
            Ingredient.name.asc(),
        )
        .all()
    )

    ingredients = [
        _serialize_ingredient(ingredient, int(purchase_count or 0))
        for ingredient, purchase_count in rows
    ]

    return {
        "company_id": company_id,
        "total_ingredients": total_ingredients,
        "active_ingredients": active_ingredients,
        "inactive_ingredients": inactive_ingredients,
        "missing_price_ingredients": missing_price_ingredients,
        "ingredients": ingredients,
    }


def get_ingredient(
    db: Session,
    *,
    tenant_id: UUID,
    ingredient_id: UUID,
) -> dict:
    from app.db.models import Ingredient, PurchaseInvoice, PurchaseInvoiceLine

    ingredient = (
        db.query(Ingredient)
        .filter(
            Ingredient.id == ingredient_id,
            Ingredient.tenant_id == tenant_id,
        )
        .first()
    )
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    recent_rows = (
        db.query(PurchaseInvoiceLine, PurchaseInvoice)
        .join(PurchaseInvoice, PurchaseInvoice.id == PurchaseInvoiceLine.purchase_invoice_id)
        .filter(
            PurchaseInvoiceLine.tenant_id == tenant_id,
            PurchaseInvoiceLine.company_id == ingredient.company_id,
            PurchaseInvoiceLine.ingredient_id == ingredient.id,
        )
        .order_by(
            PurchaseInvoice.invoice_date.desc(),
            PurchaseInvoiceLine.created_at.desc(),
            PurchaseInvoiceLine.line_order.asc(),
        )
        .limit(3)
        .all()
    )

    recent_purchases = [
        {
            "line_id": line.id,
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "invoice_date": invoice.invoice_date,
            "supplier_name": invoice.supplier_name,
            "quantity_purchased": round(float(line.quantity_purchased or 0), 3),
            "purchase_unit": line.purchase_unit,
            "net_quantity_for_costing": round(float(line.net_quantity_for_costing or 0), 3),
            "costing_unit": line.costing_unit,
            "line_total_ex_vat": round(float(line.line_total_ex_vat or 0), 2),
            "line_total_inc_vat": round(float(line.line_total_inc_vat or 0), 2),
            "normalized_unit_cost_ex_vat": round(float(line.normalized_unit_cost_ex_vat or 0), 6),
            "normalized_unit_cost_inc_vat": round(float(line.normalized_unit_cost_inc_vat or 0), 6),
            "brand": line.brand,
            "supplier_product_name": line.supplier_product_name,
        }
        for line, invoice in recent_rows
    ]

    purchase_count = (
        db.query(func.count(PurchaseInvoiceLine.id))
        .filter(
            PurchaseInvoiceLine.tenant_id == tenant_id,
            PurchaseInvoiceLine.company_id == ingredient.company_id,
            PurchaseInvoiceLine.ingredient_id == ingredient.id,
        )
        .scalar()
        or 0
    )

    return {
        "ingredient": _serialize_ingredient(ingredient, int(purchase_count)),
        "recent_purchases": recent_purchases,
    }


def update_ingredient(
    db: Session,
    *,
    tenant_id: UUID,
    ingredient_id: UUID,
    payload: IngredientUpdate,
) -> dict:
    from app.db.models import Ingredient, PurchaseInvoiceLine

    ingredient = (
        db.query(Ingredient)
        .filter(
            Ingredient.id == ingredient_id,
            Ingredient.tenant_id == tenant_id,
        )
        .first()
    )
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    normalized_name = _normalize_name(payload.name)
    conflict = (
        db.query(Ingredient)
        .filter(
            Ingredient.tenant_id == tenant_id,
            Ingredient.company_id == ingredient.company_id,
            Ingredient.normalized_name == normalized_name,
            Ingredient.id != ingredient_id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail="Ingredient name already exists for this company")

    ingredient.name = payload.name.strip()
    ingredient.normalized_name = normalized_name
    ingredient.default_unit_for_costing = payload.default_unit_for_costing.strip().lower()
    ingredient.category = payload.category.strip() if payload.category else None
    ingredient.notes = payload.notes.strip() if payload.notes else None
    ingredient.is_active = payload.is_active

    try:
        db.add(ingredient)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ingredient name already exists for this company") from exc

    db.refresh(ingredient)
    purchase_count = (
        db.query(func.count(PurchaseInvoiceLine.id))
        .filter(
            PurchaseInvoiceLine.tenant_id == tenant_id,
            PurchaseInvoiceLine.company_id == ingredient.company_id,
            PurchaseInvoiceLine.ingredient_id == ingredient.id,
        )
        .scalar()
        or 0
    )
    return _serialize_ingredient(ingredient, int(purchase_count))


def archive_ingredient(
    db: Session,
    *,
    tenant_id: UUID,
    ingredient_id: UUID,
) -> dict:
    from app.db.models import Ingredient, PurchaseInvoiceLine

    ingredient = (
        db.query(Ingredient)
        .filter(
            Ingredient.id == ingredient_id,
            Ingredient.tenant_id == tenant_id,
        )
        .first()
    )
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    ingredient.is_active = False
    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)

    purchase_count = (
        db.query(func.count(PurchaseInvoiceLine.id))
        .filter(
            PurchaseInvoiceLine.tenant_id == tenant_id,
            PurchaseInvoiceLine.company_id == ingredient.company_id,
            PurchaseInvoiceLine.ingredient_id == ingredient.id,
        )
        .scalar()
        or 0
    )
    return _serialize_ingredient(ingredient, int(purchase_count))
