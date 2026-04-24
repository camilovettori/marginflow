from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.schemas.recipe import (
    RecipeCreate,
    RecipeDetailResponse,
    RecipeDuplicateRequest,
    RecipeListResponse,
    RecipePhotoUploadResponse,
    RecipeUpdate,
)
from app.services.recipes_service import (
    create_recipe,
    delete_recipe,
    duplicate_recipe,
    get_recipe,
    list_recipes,
    upload_recipe_photo,
    update_recipe,
)

router = APIRouter(prefix="/api/costing", tags=["Costing Recipes"])


@router.get("/{company_id}/recipes", response_model=RecipeListResponse)
def list_company_recipes(
    company_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return list_recipes(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
    )


@router.post("/{company_id}/recipes", response_model=RecipeDetailResponse)
def create_company_recipe(
    company_id: UUID,
    payload: RecipeCreate,
    request: Request,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return create_recipe(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        payload=payload,
        base_url=str(request.base_url),
    )


@router.post("/{company_id}/recipes/photo", response_model=RecipePhotoUploadResponse)
async def upload_company_recipe_photo(
    company_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    tenant_id: UUID = Depends(get_tenant_id),
):
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    if "image" not in content_type and not filename.endswith((".jpg", ".jpeg", ".png", ".webp")):
        raise HTTPException(status_code=400, detail="Use JPG, PNG, or WebP for recipe photos")

    photo_bytes = await file.read()
    return upload_recipe_photo(
        tenant_id=tenant_id,
        company_id=company_id,
        recipe_id=uuid4(),
        filename=file.filename,
        content_type=file.content_type,
        photo_bytes=photo_bytes,
        base_url=str(request.base_url),
    )


@router.get("/recipes/{recipe_id}", response_model=RecipeDetailResponse)
def get_company_recipe(
    recipe_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return get_recipe(
        db,
        tenant_id=tenant_id,
        recipe_id=recipe_id,
    )


@router.put("/recipes/{recipe_id}", response_model=RecipeDetailResponse)
def update_company_recipe(
    recipe_id: UUID,
    payload: RecipeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return update_recipe(
        db,
        tenant_id=tenant_id,
        recipe_id=recipe_id,
        payload=payload,
        base_url=str(request.base_url),
    )


@router.post("/recipes/{recipe_id}/duplicate", response_model=RecipeDetailResponse)
def duplicate_company_recipe(
    recipe_id: UUID,
    request: Request,
    payload: RecipeDuplicateRequest | None = None,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return duplicate_recipe(
        db,
        tenant_id=tenant_id,
        recipe_id=recipe_id,
        payload=payload,
        base_url=str(request.base_url),
    )


@router.delete("/recipes/{recipe_id}")
def delete_company_recipe(
    recipe_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return delete_recipe(
        db,
        tenant_id=tenant_id,
        recipe_id=recipe_id,
    )
