from __future__ import annotations

import base64
import binascii
import re
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import UPLOADS_DIR
from app.db.models import Company, Ingredient, Recipe, RecipeIngredient
from app.schemas.recipe import (
    RecipeCreate,
    RecipeDetailResponse,
    RecipeDuplicateRequest,
    RecipeIngredientCreate,
    RecipeIngredientResponse,
    RecipeListResponse,
    RecipeSummaryResponse,
    RecipeUpdate,
)

MONEY_QUANT = Decimal("0.01")
UNIT_COST_QUANT = Decimal("0.000001")

WEIGHT_FACTORS = {
    "mg": Decimal("0.001"),
    "g": Decimal("1"),
    "kg": Decimal("1000"),
}

VOLUME_FACTORS = {
    "ml": Decimal("1"),
    "l": Decimal("1000"),
}

UNIT_FACTORS = {
    "unit": Decimal("1"),
}

PHOTO_MAX_BYTES = 5 * 1024 * 1024
PHOTO_MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
DATA_URL_RE = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,(.+)$", re.IGNORECASE | re.DOTALL)


def _to_decimal(value: object | None) -> Decimal:
    if value in (None, ""):
        return Decimal("0")
    return Decimal(str(value))


def _round_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _round_unit_cost(value: Decimal) -> Decimal:
    return value.quantize(UNIT_COST_QUANT, rounding=ROUND_HALF_UP)


def _normalize_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _normalize_unit(value: str) -> str:
    return value.strip().lower()


def _store_recipe_photo_bytes(
    image_bytes: bytes,
    *,
    base_url: str | None,
    tenant_id: UUID,
    company_id: UUID,
    recipe_id: UUID,
    extension: str,
) -> str:
    relative_dir = Path("recipe-photos") / str(tenant_id) / str(company_id)
    target_dir = UPLOADS_DIR / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    file_name = f"{recipe_id}-{uuid4().hex}.{extension}"
    target_path = target_dir / file_name
    target_path.write_bytes(image_bytes)

    relative_url = f"/uploads/{relative_dir.as_posix()}/{file_name}"
    if base_url:
        return f"{base_url.rstrip('/')}{relative_url}"
    return relative_url


def _normalize_photo_reference(
    value: str | None,
    *,
    base_url: str | None,
    tenant_id: UUID,
    company_id: UUID,
    recipe_id: UUID,
) -> str | None:
    if value in (None, ""):
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    if cleaned.lower().startswith("data:image/"):
        match = DATA_URL_RE.match(cleaned)
        if not match:
            raise HTTPException(status_code=400, detail="Unsupported recipe photo data URL")
        mime_type = match.group(1).lower()
        encoded = match.group(2).strip()
        if len(encoded) > PHOTO_MAX_BYTES * 2:
            raise HTTPException(status_code=400, detail="Recipe photo is too large. Maximum size is 5 MB.")
        try:
            image_bytes = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Could not decode recipe photo") from exc
        if len(image_bytes) > PHOTO_MAX_BYTES:
            raise HTTPException(status_code=400, detail="Recipe photo is too large. Maximum size is 5 MB.")
        extension = PHOTO_MIME_EXTENSIONS.get(mime_type)
        if not extension:
            raise HTTPException(status_code=400, detail="Unsupported recipe photo type")
        return _store_recipe_photo_bytes(
            image_bytes,
            base_url=base_url,
            tenant_id=tenant_id,
            company_id=company_id,
            recipe_id=recipe_id,
            extension=extension,
        )

    if cleaned.startswith("/"):
        return f"{base_url.rstrip('/')}{cleaned}" if base_url else cleaned

    return cleaned


def upload_recipe_photo(
    *,
    tenant_id: UUID,
    company_id: UUID,
    recipe_id: UUID,
    filename: str | None,
    content_type: str | None,
    photo_bytes: bytes,
    base_url: str | None = None,
) -> dict:
    if len(photo_bytes) > PHOTO_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Recipe photo is too large. Maximum size is 5 MB.")

    normalized_filename = (filename or "").lower()
    normalized_content_type = (content_type or "").lower()
    extension = PHOTO_MIME_EXTENSIONS.get(normalized_content_type)
    if not extension:
        if normalized_filename.endswith((".jpg", ".jpeg")):
            extension = "jpg"
        elif normalized_filename.endswith(".png"):
            extension = "png"
        elif normalized_filename.endswith(".webp"):
            extension = "webp"

    if not extension:
        raise HTTPException(status_code=400, detail="Use JPG, PNG, or WebP for recipe photos")

    return {
        "photo_url": _store_recipe_photo_bytes(
            photo_bytes,
            base_url=base_url,
            tenant_id=tenant_id,
            company_id=company_id,
            recipe_id=recipe_id,
            extension=extension,
        )
    }


def _unit_family(unit: str) -> str | None:
    normalized = _normalize_unit(unit)
    if normalized in WEIGHT_FACTORS:
        return "weight"
    if normalized in VOLUME_FACTORS:
        return "volume"
    if normalized in UNIT_FACTORS:
        return "unit"
    return None


def _unit_factor(unit: str) -> Decimal:
    normalized = _normalize_unit(unit)
    if normalized in WEIGHT_FACTORS:
        return WEIGHT_FACTORS[normalized]
    if normalized in VOLUME_FACTORS:
        return VOLUME_FACTORS[normalized]
    if normalized in UNIT_FACTORS:
        return UNIT_FACTORS[normalized]
    raise ValueError(f"Unsupported unit '{unit}'")


def _convert_quantity(quantity: Decimal, from_unit: str, to_unit: str) -> Decimal:
    from_normalized = _normalize_unit(from_unit)
    to_normalized = _normalize_unit(to_unit)
    if _unit_family(from_normalized) != _unit_family(to_normalized):
        raise ValueError(f"Cannot convert {from_unit} to {to_unit}")
    base_quantity = quantity * _unit_factor(from_normalized)
    return base_quantity / _unit_factor(to_normalized)


def _round_float(value: object | None, digits: int = 6) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _get_company_or_404(db: Session, tenant_id: UUID, company_id: UUID) -> Company:
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def _get_recipe_or_404(db: Session, tenant_id: UUID, recipe_id: UUID) -> Recipe:
    recipe = (
        db.query(Recipe)
        .options(
            selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient)
        )
        .filter(Recipe.id == recipe_id, Recipe.tenant_id == tenant_id)
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


def _load_ingredient_lookup(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    ingredient_ids: list[UUID],
) -> dict[UUID, Ingredient]:
    if not ingredient_ids:
        return {}

    rows = (
        db.query(Ingredient)
        .filter(
            Ingredient.tenant_id == tenant_id,
            Ingredient.company_id == company_id,
            Ingredient.id.in_(ingredient_ids),
        )
        .all()
    )
    return {row.id: row for row in rows}


def _unique_recipe_name(db: Session, *, tenant_id: UUID, company_id: UUID, base_name: str) -> str:
    candidate = base_name.strip()
    suffix = 2

    while (
        db.query(Recipe)
        .filter(
            Recipe.tenant_id == tenant_id,
            Recipe.company_id == company_id,
            Recipe.normalized_name == _normalize_text(candidate),
        )
        .first()
    ):
        candidate = f"{base_name} Copy" if suffix == 2 else f"{base_name} Copy {suffix}"
        suffix += 1

    return candidate


def _serialize_recipe_ingredient(
    line: RecipeIngredient,
    *,
    ingredient: Ingredient | None,
    normalized_quantity: Decimal | None,
    latest_unit_cost_ex_vat: Decimal | None,
    latest_unit_cost_inc_vat: Decimal | None,
    line_cost_ex_vat: Decimal | None,
    line_cost_inc_vat: Decimal | None,
    missing_price: bool,
    unit_mismatch: bool,
) -> dict:
    ingredient_name = line.ingredient_name
    default_unit = ingredient.default_unit_for_costing if ingredient else line.unit_used
    return {
        "id": line.id,
        "ingredient_id": line.ingredient_id,
        "ingredient_name": ingredient_name,
        "ingredient_default_unit_for_costing": default_unit,
        "line_order": line.line_order,
        "quantity_required": round(float(line.quantity_required or 0), 3),
        "unit_used": line.unit_used,
        "normalized_quantity": _round_float(normalized_quantity, 3) if normalized_quantity is not None else None,
        "latest_unit_cost_ex_vat": _round_float(latest_unit_cost_ex_vat),
        "latest_unit_cost_inc_vat": _round_float(latest_unit_cost_inc_vat),
        "normalized_unit_cost_ex_vat": _round_float(latest_unit_cost_ex_vat),
        "normalized_unit_cost_inc_vat": _round_float(latest_unit_cost_inc_vat),
        "line_cost_ex_vat": _round_float(line_cost_ex_vat, 2) if line_cost_ex_vat is not None else None,
        "line_cost_inc_vat": _round_float(line_cost_inc_vat, 2) if line_cost_inc_vat is not None else None,
        "missing_price": missing_price,
        "unit_mismatch": unit_mismatch,
        "source_purchase_date": ingredient.latest_purchase_date if ingredient else line.source_purchase_date,
        "source_supplier_name": ingredient.latest_supplier_name if ingredient else line.source_supplier_name,
    }


def _calculate_recipe_snapshot(recipe: Recipe) -> tuple[dict, list[dict], list[str]]:
    warnings: list[str] = []
    serialized_lines: list[dict] = []

    subtotal_ex = Decimal("0")
    subtotal_inc = Decimal("0")
    missing_count = 0

    for line in sorted(recipe.ingredients, key=lambda row: row.line_order):
        ingredient = line.ingredient
        normalized_quantity: Decimal | None = None
        latest_ex: Decimal | None = None
        latest_inc: Decimal | None = None
        line_cost_ex: Decimal | None = None
        line_cost_inc: Decimal | None = None
        missing_price = False
        unit_mismatch = False

        if not ingredient:
            missing_price = True
            missing_count += 1
            warnings.append(f"{line.ingredient_name} is no longer linked to an ingredient record.")
        else:
            latest_ex = None if ingredient.latest_unit_cost_ex_vat is None else _to_decimal(ingredient.latest_unit_cost_ex_vat)
            latest_inc = None if ingredient.latest_unit_cost_inc_vat is None else _to_decimal(ingredient.latest_unit_cost_inc_vat)
            if latest_ex is None or latest_inc is None:
                missing_price = True
                missing_count += 1
                warnings.append(
                    f"{ingredient.name} is missing a latest paid price. Post a supplier invoice to refresh costing."
                )
            else:
                try:
                    normalized_quantity = _convert_quantity(
                        _to_decimal(line.quantity_required),
                        line.unit_used,
                        ingredient.default_unit_for_costing,
                    )
                    line_cost_ex = _round_money(normalized_quantity * latest_ex)
                    line_cost_inc = _round_money(normalized_quantity * latest_inc)
                    subtotal_ex += line_cost_ex
                    subtotal_inc += line_cost_inc
                except ValueError:
                    unit_mismatch = True
                    missing_price = True
                    missing_count += 1
                    warnings.append(
                        f"{ingredient.name} uses {ingredient.default_unit_for_costing}, but the recipe line uses {line.unit_used}."
                    )

        serialized_lines.append(
            _serialize_recipe_ingredient(
                line,
                ingredient=ingredient,
                normalized_quantity=normalized_quantity,
                latest_unit_cost_ex_vat=latest_ex,
                latest_unit_cost_inc_vat=latest_inc,
                line_cost_ex_vat=line_cost_ex,
                line_cost_inc_vat=line_cost_inc,
                missing_price=missing_price,
                unit_mismatch=unit_mismatch,
            )
        )

    wastage_multiplier = Decimal("1") + (_to_decimal(recipe.wastage_percent) / Decimal("100"))
    subtotal_ex = _round_money(subtotal_ex * wastage_multiplier)
    subtotal_inc = _round_money(subtotal_inc * wastage_multiplier)

    labour = _round_money(_to_decimal(recipe.labour_cost_override)) if recipe.labour_cost_override is not None else Decimal("0")
    packaging = _round_money(_to_decimal(recipe.packaging_cost_override)) if recipe.packaging_cost_override is not None else Decimal("0")

    total_ex = _round_money(subtotal_ex + labour + packaging)
    total_inc = _round_money(subtotal_inc + labour + packaging)

    yield_quantity = _to_decimal(recipe.yield_quantity)
    cost_per_yield_ex = _round_money(total_ex / yield_quantity) if yield_quantity > 0 else None
    cost_per_yield_inc = _round_money(total_inc / yield_quantity) if yield_quantity > 0 else None

    cost_per_portion_ex = None
    cost_per_portion_inc = None
    portion_denominator = _to_decimal(recipe.portion_size) if recipe.portion_size is not None else Decimal("0")
    if portion_denominator <= 0 and recipe.yield_unit.strip().lower() in {"portion", "portions", "unit", "units"}:
        portion_denominator = yield_quantity
    if portion_denominator > 0:
        cost_per_portion_ex = _round_money(total_ex / portion_denominator)
        cost_per_portion_inc = _round_money(total_inc / portion_denominator)

    selling_price_ex = None if recipe.selling_price_ex_vat is None else _to_decimal(recipe.selling_price_ex_vat)
    gross_margin_value_ex = None
    gross_margin_percent_ex = None
    markup_percent = None
    food_cost_percent = None
    if selling_price_ex is not None and selling_price_ex > 0:
        gross_margin_value_ex = _round_money(selling_price_ex - total_ex)
        gross_margin_percent_ex = _round_money((gross_margin_value_ex / selling_price_ex) * Decimal("100"))
        food_cost_percent = _round_money((total_ex / selling_price_ex) * Decimal("100"))
        if total_ex > 0:
            markup_percent = _round_money((gross_margin_value_ex / total_ex) * Decimal("100"))

    summary = {
        "id": recipe.id,
        "tenant_id": recipe.tenant_id,
        "company_id": recipe.company_id,
        "recipe_name": recipe.recipe_name,
        "normalized_name": recipe.normalized_name,
        "photo_url": recipe.photo_url,
        "category": recipe.category,
        "description": recipe.description,
        "notes": recipe.notes,
        "yield_quantity": round(float(recipe.yield_quantity or 0), 3),
        "yield_unit": recipe.yield_unit,
        "portion_size": round(float(recipe.portion_size), 3) if recipe.portion_size is not None else None,
        "wastage_percent": round(float(recipe.wastage_percent or 0), 2),
        "labour_cost_override": _round_float(recipe.labour_cost_override, 2),
        "packaging_cost_override": _round_float(recipe.packaging_cost_override, 2),
        "target_food_cost_percent": _round_float(recipe.target_food_cost_percent, 2),
        "selling_price_ex_vat": _round_float(recipe.selling_price_ex_vat, 2),
        "selling_price_inc_vat": _round_float(recipe.selling_price_inc_vat, 2),
        "is_active": recipe.is_active,
        "created_at": recipe.created_at,
        "updated_at": recipe.updated_at,
        "ingredient_count": len(serialized_lines),
        "missing_ingredient_count": missing_count,
        "total_recipe_cost_ex_vat": _round_float(total_ex, 2),
        "total_recipe_cost_inc_vat": _round_float(total_inc, 2),
        "cost_per_yield_ex_vat": _round_float(cost_per_yield_ex, 2) if cost_per_yield_ex is not None else None,
        "cost_per_yield_inc_vat": _round_float(cost_per_yield_inc, 2) if cost_per_yield_inc is not None else None,
        "cost_per_portion_ex_vat": _round_float(cost_per_portion_ex, 2) if cost_per_portion_ex is not None else None,
        "cost_per_portion_inc_vat": _round_float(cost_per_portion_inc, 2) if cost_per_portion_inc is not None else None,
        "gross_margin_value_ex_vat": _round_float(gross_margin_value_ex, 2) if gross_margin_value_ex is not None else None,
        "gross_margin_percent_ex_vat": _round_float(gross_margin_percent_ex, 2) if gross_margin_percent_ex is not None else None,
        "markup_percent": _round_float(markup_percent, 2) if markup_percent is not None else None,
        "food_cost_percent": _round_float(food_cost_percent, 2) if food_cost_percent is not None else None,
        "has_missing_costs": missing_count > 0,
    }

    return summary, serialized_lines, warnings


def _serialize_recipe_detail(recipe: Recipe) -> dict:
    summary, ingredients, warnings = _calculate_recipe_snapshot(recipe)
    return {
        "recipe": summary,
        "ingredients": ingredients,
        "warnings": warnings,
    }


def list_recipes(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
) -> dict:
    _get_company_or_404(db, tenant_id, company_id)

    recipes = (
        db.query(Recipe)
        .options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient))
        .filter(Recipe.tenant_id == tenant_id, Recipe.company_id == company_id)
        .order_by(Recipe.is_active.desc(), Recipe.updated_at.desc(), Recipe.recipe_name.asc())
        .all()
    )

    summaries: list[dict] = []
    for recipe in recipes:
        summary, _, _ = _calculate_recipe_snapshot(recipe)
        summaries.append(summary)

    highest_cost_recipe = None
    highest_cost_value = None
    for summary in summaries:
        total = summary["total_recipe_cost_ex_vat"]
        if total is None:
            continue
        if highest_cost_value is None or total > highest_cost_value:
            highest_cost_value = total
            highest_cost_recipe = summary

    return {
        "company_id": company_id,
        "total_recipes": len(summaries),
        "active_recipes": sum(1 for recipe in summaries if recipe["is_active"]),
        "inactive_recipes": sum(1 for recipe in summaries if not recipe["is_active"]),
        "missing_cost_recipes": sum(1 for recipe in summaries if recipe["has_missing_costs"]),
        "highest_cost_recipe_id": highest_cost_recipe["id"] if highest_cost_recipe else None,
        "highest_cost_recipe_name": highest_cost_recipe["recipe_name"] if highest_cost_recipe else None,
        "highest_cost_recipe_cost_ex_vat": highest_cost_recipe["total_recipe_cost_ex_vat"] if highest_cost_recipe else None,
        "recipes": summaries,
    }


def get_recipe(
    db: Session,
    *,
    tenant_id: UUID,
    recipe_id: UUID,
) -> dict:
    recipe = _get_recipe_or_404(db, tenant_id, recipe_id)
    return _serialize_recipe_detail(recipe)


def _validate_recipe_lines(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    lines: list[RecipeIngredientCreate],
) -> tuple[list[dict], list[str]]:
    ingredient_ids = [line.ingredient_id for line in lines]
    ingredient_lookup = _load_ingredient_lookup(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        ingredient_ids=ingredient_ids,
    )

    if len(ingredient_lookup) != len(set(ingredient_ids)):
        missing_ids = [str(ingredient_id) for ingredient_id in ingredient_ids if ingredient_id not in ingredient_lookup]
        raise HTTPException(
            status_code=404,
            detail=f"Ingredient not found for this company: {', '.join(missing_ids)}",
        )

    line_models: list[dict] = []
    warnings: list[str] = []

    for index, item in enumerate(lines, start=1):
        ingredient = ingredient_lookup[item.ingredient_id]
        unit_used = _normalize_unit(item.unit_used)
        ingredient_unit = _normalize_unit(ingredient.default_unit_for_costing)

        if _unit_family(unit_used) != _unit_family(ingredient_unit):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Line {index} uses {unit_used}, but {ingredient.name} is costed in {ingredient.default_unit_for_costing}."
                ),
            )

        latest_ex = None if ingredient.latest_unit_cost_ex_vat is None else _to_decimal(ingredient.latest_unit_cost_ex_vat)
        latest_inc = None if ingredient.latest_unit_cost_inc_vat is None else _to_decimal(ingredient.latest_unit_cost_inc_vat)
        missing_price = latest_ex is None or latest_inc is None

        normalized_quantity = _convert_quantity(_to_decimal(item.quantity_required), unit_used, ingredient_unit)
        normalized_unit_cost_ex = latest_ex
        normalized_unit_cost_inc = latest_inc
        line_cost_ex = None
        line_cost_inc = None

        if not missing_price:
            line_cost_ex = _round_money(normalized_quantity * latest_ex)
            line_cost_inc = _round_money(normalized_quantity * latest_inc)
        else:
            warnings.append(f"{ingredient.name} is missing a latest paid price.")

        line_models.append(
            {
                "ingredient": ingredient,
                "line_order": index,
                "ingredient_name": ingredient.name,
                "ingredient_id": ingredient.id,
                "quantity_required": float(_to_decimal(item.quantity_required)),
                "unit_used": unit_used,
                "normalized_unit_cost_ex_vat": float(normalized_unit_cost_ex) if normalized_unit_cost_ex is not None else None,
                "normalized_unit_cost_inc_vat": float(normalized_unit_cost_inc) if normalized_unit_cost_inc is not None else None,
                "line_cost_ex_vat": float(line_cost_ex) if line_cost_ex is not None else None,
                "line_cost_inc_vat": float(line_cost_inc) if line_cost_inc is not None else None,
                "missing_price": missing_price,
                "source_purchase_date": ingredient.latest_purchase_date,
                "source_supplier_name": ingredient.latest_supplier_name,
            }
        )

    return line_models, warnings


def _apply_recipe_payload(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    recipe: Recipe,
    payload: RecipeCreate | RecipeUpdate,
    base_url: str | None = None,
) -> tuple[Recipe, list[str]]:
    recipe.recipe_name = payload.recipe_name.strip()
    recipe.normalized_name = _normalize_text(payload.recipe_name)
    recipe.photo_url = _normalize_photo_reference(
        payload.photo_url,
        base_url=base_url,
        tenant_id=tenant_id,
        company_id=company_id,
        recipe_id=recipe.id,
    )
    recipe.category = payload.category.strip() if payload.category else None
    recipe.description = payload.description.strip() if payload.description else None
    recipe.notes = payload.notes.strip() if payload.notes else None
    recipe.yield_quantity = float(_to_decimal(payload.yield_quantity))
    recipe.yield_unit = _normalize_unit(payload.yield_unit)
    recipe.portion_size = float(_to_decimal(payload.portion_size)) if payload.portion_size is not None else None
    recipe.wastage_percent = float(_to_decimal(payload.wastage_percent))
    recipe.labour_cost_override = float(_to_decimal(payload.labour_cost_override)) if payload.labour_cost_override is not None else None
    recipe.packaging_cost_override = float(_to_decimal(payload.packaging_cost_override)) if payload.packaging_cost_override is not None else None
    recipe.target_food_cost_percent = (
        float(_to_decimal(payload.target_food_cost_percent)) if payload.target_food_cost_percent is not None else None
    )
    recipe.selling_price_ex_vat = (
        float(_to_decimal(payload.selling_price_ex_vat)) if payload.selling_price_ex_vat is not None else None
    )
    recipe.selling_price_inc_vat = (
        float(_to_decimal(payload.selling_price_inc_vat)) if payload.selling_price_inc_vat is not None else None
    )
    recipe.is_active = payload.is_active

    db.add(recipe)
    db.flush()

    ingredient_lines, warnings = _validate_recipe_lines(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        lines=payload.ingredients,
    )

    recipe.ingredients.clear()
    db.flush()

    for item in ingredient_lines:
        recipe.ingredients.append(
            RecipeIngredient(
                tenant_id=tenant_id,
                company_id=company_id,
                recipe_id=recipe.id,
                ingredient_id=item["ingredient"].id,
                line_order=item["line_order"],
                ingredient_name=item["ingredient_name"],
                quantity_required=item["quantity_required"],
                unit_used=item["unit_used"],
                normalized_unit_cost_ex_vat=item["normalized_unit_cost_ex_vat"],
                normalized_unit_cost_inc_vat=item["normalized_unit_cost_inc_vat"],
                line_cost_ex_vat=item["line_cost_ex_vat"],
                line_cost_inc_vat=item["line_cost_inc_vat"],
                missing_price=item["missing_price"],
                source_purchase_date=item["source_purchase_date"],
                source_supplier_name=item["source_supplier_name"],
            )
        )

    return recipe, warnings


def create_recipe(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    payload: RecipeCreate,
    base_url: str | None = None,
) -> dict:
    _get_company_or_404(db, tenant_id, company_id)

    duplicate = (
        db.query(Recipe)
        .filter(
            Recipe.tenant_id == tenant_id,
            Recipe.company_id == company_id,
            Recipe.normalized_name == _normalize_text(payload.recipe_name),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Recipe name already exists for this company")

    recipe = Recipe(
        tenant_id=tenant_id,
        company_id=company_id,
        recipe_name=payload.recipe_name.strip(),
        normalized_name=_normalize_text(payload.recipe_name),
        photo_url=None,
        category=payload.category.strip() if payload.category else None,
        description=payload.description.strip() if payload.description else None,
        notes=payload.notes.strip() if payload.notes else None,
        yield_quantity=float(_to_decimal(payload.yield_quantity)),
        yield_unit=_normalize_unit(payload.yield_unit),
        portion_size=float(_to_decimal(payload.portion_size)) if payload.portion_size is not None else None,
        wastage_percent=float(_to_decimal(payload.wastage_percent)),
        labour_cost_override=float(_to_decimal(payload.labour_cost_override)) if payload.labour_cost_override is not None else None,
        packaging_cost_override=float(_to_decimal(payload.packaging_cost_override)) if payload.packaging_cost_override is not None else None,
        target_food_cost_percent=(
            float(_to_decimal(payload.target_food_cost_percent)) if payload.target_food_cost_percent is not None else None
        ),
        selling_price_ex_vat=float(_to_decimal(payload.selling_price_ex_vat)) if payload.selling_price_ex_vat is not None else None,
        selling_price_inc_vat=float(_to_decimal(payload.selling_price_inc_vat)) if payload.selling_price_inc_vat is not None else None,
        is_active=payload.is_active,
    )

    try:
        recipe, warnings = _apply_recipe_payload(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        recipe=recipe,
        payload=payload,
        base_url=base_url,
    )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Recipe name already exists for this company") from exc

    db.refresh(recipe)
    return _serialize_recipe_detail(
        db.query(Recipe)
        .options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient))
        .filter(Recipe.id == recipe.id, Recipe.tenant_id == tenant_id)
        .first()
        or recipe
    )


def update_recipe(
    db: Session,
    *,
    tenant_id: UUID,
    recipe_id: UUID,
    payload: RecipeUpdate,
    base_url: str | None = None,
) -> dict:
    recipe = _get_recipe_or_404(db, tenant_id, recipe_id)

    duplicate = (
        db.query(Recipe)
        .filter(
            Recipe.tenant_id == tenant_id,
            Recipe.company_id == recipe.company_id,
            Recipe.normalized_name == _normalize_text(payload.recipe_name),
            Recipe.id != recipe_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Recipe name already exists for this company")

    try:
        _apply_recipe_payload(
            db,
            tenant_id=tenant_id,
            company_id=recipe.company_id,
            recipe=recipe,
            payload=payload,
            base_url=base_url,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Recipe name already exists for this company") from exc

    db.refresh(recipe)
    recipe = _get_recipe_or_404(db, tenant_id, recipe_id)
    return _serialize_recipe_detail(recipe)


def duplicate_recipe(
    db: Session,
    *,
    tenant_id: UUID,
    recipe_id: UUID,
    payload: RecipeDuplicateRequest | None = None,
    base_url: str | None = None,
) -> dict:
    source = _get_recipe_or_404(db, tenant_id, recipe_id)
    candidate_name = payload.recipe_name.strip() if payload and payload.recipe_name else f"{source.recipe_name} Copy"
    unique_name = _unique_recipe_name(
        db,
        tenant_id=tenant_id,
        company_id=source.company_id,
        base_name=candidate_name,
    )

    duplicate_payload = RecipeCreate(
        recipe_name=unique_name,
        photo_url=source.photo_url,
        category=source.category,
        description=source.description,
        notes=source.notes,
        yield_quantity=float(source.yield_quantity),
        yield_unit=source.yield_unit,
        portion_size=float(source.portion_size) if source.portion_size is not None else None,
        wastage_percent=float(source.wastage_percent or 0),
        labour_cost_override=float(source.labour_cost_override) if source.labour_cost_override is not None else None,
        packaging_cost_override=float(source.packaging_cost_override) if source.packaging_cost_override is not None else None,
        target_food_cost_percent=float(source.target_food_cost_percent) if source.target_food_cost_percent is not None else None,
        selling_price_ex_vat=float(source.selling_price_ex_vat) if source.selling_price_ex_vat is not None else None,
        selling_price_inc_vat=float(source.selling_price_inc_vat) if source.selling_price_inc_vat is not None else None,
        is_active=source.is_active,
        ingredients=[
            RecipeIngredientCreate(
                ingredient_id=line.ingredient_id,
                quantity_required=float(line.quantity_required),
                unit_used=line.unit_used,
            )
            for line in source.ingredients
            if line.ingredient_id
        ],
    )
    return create_recipe(
        db,
        tenant_id=tenant_id,
        company_id=source.company_id,
        payload=duplicate_payload,
        base_url=base_url,
    )


def delete_recipe(
    db: Session,
    *,
    tenant_id: UUID,
    recipe_id: UUID,
) -> dict:
    recipe = _get_recipe_or_404(db, tenant_id, recipe_id)
    db.delete(recipe)
    db.commit()
    return {"success": True}
