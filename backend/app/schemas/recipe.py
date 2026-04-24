from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer, model_validator


class RecipeIngredientCreate(BaseModel):
    ingredient_id: UUID
    quantity_required: float = Field(gt=0)
    unit_used: str = Field(min_length=1, max_length=20)


class RecipeIngredientResponse(BaseModel):
    id: UUID
    ingredient_id: UUID | None = None
    ingredient_name: str
    ingredient_default_unit_for_costing: str
    line_order: int
    quantity_required: float
    unit_used: str
    normalized_quantity: float | None = None
    latest_unit_cost_ex_vat: float | None = None
    latest_unit_cost_inc_vat: float | None = None
    normalized_unit_cost_ex_vat: float | None = None
    normalized_unit_cost_inc_vat: float | None = None
    line_cost_ex_vat: float | None = None
    line_cost_inc_vat: float | None = None
    missing_price: bool = False
    unit_mismatch: bool = False
    source_purchase_date: date | None = None
    source_supplier_name: str | None = None

    @field_serializer("source_purchase_date")
    def serialize_date(self, value: date | None) -> str | None:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True


class RecipeBaseInput(BaseModel):
    recipe_name: str = Field(min_length=1, max_length=255)
    photo_url: str | None = None
    category: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    notes: str | None = Field(default=None, max_length=4000)
    yield_quantity: float = Field(gt=0, default=1)
    yield_unit: str = Field(min_length=1, max_length=20)
    portion_size: float | None = Field(default=None, gt=0)
    wastage_percent: float = Field(default=0, ge=0, le=100)
    labour_cost_override: float | None = Field(default=None, ge=0)
    packaging_cost_override: float | None = Field(default=None, ge=0)
    target_food_cost_percent: float | None = Field(default=None, ge=0, le=100)
    selling_price_ex_vat: float | None = Field(default=None, ge=0)
    selling_price_inc_vat: float | None = Field(default=None, ge=0)
    is_active: bool = True
    ingredients: list[RecipeIngredientCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_ingredients(self) -> "RecipeBaseInput":
        return self


class RecipeCreate(RecipeBaseInput):
    pass


class RecipeUpdate(RecipeBaseInput):
    pass


class RecipeDuplicateRequest(BaseModel):
    recipe_name: str | None = Field(default=None, max_length=255)


class RecipePhotoUploadResponse(BaseModel):
    photo_url: str


class RecipeSummaryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_id: UUID
    recipe_name: str
    normalized_name: str
    photo_url: str | None = None
    category: str | None = None
    description: str | None = None
    notes: str | None = None
    yield_quantity: float
    yield_unit: str
    portion_size: float | None = None
    wastage_percent: float
    labour_cost_override: float | None = None
    packaging_cost_override: float | None = None
    target_food_cost_percent: float | None = None
    selling_price_ex_vat: float | None = None
    selling_price_inc_vat: float | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    ingredient_count: int = 0
    missing_ingredient_count: int = 0
    total_recipe_cost_ex_vat: float | None = None
    total_recipe_cost_inc_vat: float | None = None
    cost_per_yield_ex_vat: float | None = None
    cost_per_yield_inc_vat: float | None = None
    cost_per_portion_ex_vat: float | None = None
    cost_per_portion_inc_vat: float | None = None
    gross_margin_value_ex_vat: float | None = None
    gross_margin_percent_ex_vat: float | None = None
    markup_percent: float | None = None
    food_cost_percent: float | None = None
    has_missing_costs: bool = False

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, value: datetime | None) -> str | None:
        return value.isoformat() if value else None

    class Config:
        from_attributes = True


class RecipeDetailResponse(BaseModel):
    recipe: RecipeSummaryResponse
    ingredients: list[RecipeIngredientResponse]
    warnings: list[str] = Field(default_factory=list)


class RecipeListResponse(BaseModel):
    company_id: UUID
    total_recipes: int
    active_recipes: int
    inactive_recipes: int
    missing_cost_recipes: int
    highest_cost_recipe_id: UUID | None = None
    highest_cost_recipe_name: str | None = None
    highest_cost_recipe_cost_ex_vat: float | None = None
    recipes: list[RecipeSummaryResponse]

    @field_serializer("company_id", "highest_cost_recipe_id")
    def serialize_uuid(self, value: UUID | None) -> str | None:
        return str(value) if value else None
