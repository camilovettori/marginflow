from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.models.financial_category import FinancialCategory
from app.schemas.financial_category import (
    FinancialCategoryCreate,
    FinancialCategoryResponse,
    FinancialCategoryUpdate,
)

router = APIRouter(prefix="/api/financial-categories", tags=["Financial Categories"])


@router.get("/", response_model=list[FinancialCategoryResponse])
def list_financial_categories(
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return (
        db.query(FinancialCategory)
        .filter(FinancialCategory.tenant_id == tenant_id)
        .order_by(FinancialCategory.type.asc(), FinancialCategory.name.asc())
        .all()
    )


@router.post("/", response_model=FinancialCategoryResponse)
def create_financial_category(
    payload: FinancialCategoryCreate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    existing = (
        db.query(FinancialCategory)
        .filter(
            FinancialCategory.tenant_id == tenant_id,
            FinancialCategory.name == payload.name,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Category name already exists for this tenant")

    category = FinancialCategory(
        tenant_id=tenant_id,
        name=payload.name,
        type=payload.type,
        group=payload.group,
        is_active=payload.is_active,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("/{category_id}", response_model=FinancialCategoryResponse)
def get_financial_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    category = (
        db.query(FinancialCategory)
        .filter(
            FinancialCategory.id == category_id,
            FinancialCategory.tenant_id == tenant_id,
        )
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="Financial category not found")

    return category


@router.put("/{category_id}", response_model=FinancialCategoryResponse)
def update_financial_category(
    category_id: UUID,
    payload: FinancialCategoryUpdate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    category = (
        db.query(FinancialCategory)
        .filter(
            FinancialCategory.id == category_id,
            FinancialCategory.tenant_id == tenant_id,
        )
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="Financial category not found")

    existing = (
        db.query(FinancialCategory)
        .filter(
            FinancialCategory.tenant_id == tenant_id,
            FinancialCategory.name == payload.name,
            FinancialCategory.id != category_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Category name already exists for this tenant")

    category.name = payload.name
    category.type = payload.type
    category.group = payload.group
    category.is_active = payload.is_active

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
def delete_financial_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    category = (
        db.query(FinancialCategory)
        .filter(
            FinancialCategory.id == category_id,
            FinancialCategory.tenant_id == tenant_id,
        )
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="Financial category not found")

    db.delete(category)
    db.commit()
    return {"success": True}