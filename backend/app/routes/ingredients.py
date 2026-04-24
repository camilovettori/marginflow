from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.schemas.ingredient import (
    IngredientDetailResponse,
    IngredientListResponse,
    IngredientResponse,
    IngredientUpdate,
)
from app.services.ingredients_service import (
    archive_ingredient,
    get_ingredient,
    list_ingredients,
    update_ingredient,
)

router = APIRouter(prefix="/api/costing", tags=["Costing Ingredients"])


@router.get("/{company_id}/ingredients", response_model=IngredientListResponse)
def list_company_ingredients(
    company_id: UUID,
    search: str | None = Query(default=None),
    view: Literal["all", "active", "inactive"] = Query(default="all"),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return list_ingredients(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        search=search,
        view=view,
    )


@router.get("/ingredients/{ingredient_id}", response_model=IngredientDetailResponse)
def get_company_ingredient(
    ingredient_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return get_ingredient(
        db,
        tenant_id=tenant_id,
        ingredient_id=ingredient_id,
    )


@router.patch("/ingredients/{ingredient_id}", response_model=IngredientResponse)
def update_company_ingredient(
    ingredient_id: UUID,
    payload: IngredientUpdate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return update_ingredient(
        db,
        tenant_id=tenant_id,
        ingredient_id=ingredient_id,
        payload=payload,
    )


@router.delete("/ingredients/{ingredient_id}", response_model=IngredientResponse)
def archive_company_ingredient(
    ingredient_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return archive_ingredient(
        db,
        tenant_id=tenant_id,
        ingredient_id=ingredient_id,
    )
