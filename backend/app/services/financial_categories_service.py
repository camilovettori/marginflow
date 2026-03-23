from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.financial_category import FinancialCategory


DEFAULT_FINANCIAL_CATEGORIES = [
    {"name": "Sales", "type": "revenue", "group": "Revenue"},
    {"name": "Internal Sales", "type": "revenue", "group": "Revenue"},
    {"name": "Other Income", "type": "other", "group": "Revenue"},
    {"name": "Food Purchases", "type": "cogs", "group": "COGS"},
    {"name": "Snacks", "type": "cogs", "group": "COGS"},
    {"name": "Wages", "type": "expense", "group": "Labour"},
    {"name": "Holiday Pay", "type": "expense", "group": "Labour"},
    {"name": "Fixed Costs", "type": "expense", "group": "Overheads"},
    {"name": "Variable Costs", "type": "expense", "group": "Overheads"},
    {"name": "Loans / HP", "type": "expense", "group": "Overheads"},
    {"name": "VAT Due", "type": "expense", "group": "Tax"},
]


def ensure_default_financial_categories(db: Session, tenant_id: UUID) -> list[FinancialCategory]:
    existing = (
        db.query(FinancialCategory)
        .filter(FinancialCategory.tenant_id == tenant_id)
        .all()
    )

    if existing:
        return existing

    created: list[FinancialCategory] = []

    for item in DEFAULT_FINANCIAL_CATEGORIES:
        category = FinancialCategory(
            tenant_id=tenant_id,
            name=item["name"],
            type=item["type"],
            group=item["group"],
            is_active=True,
        )
        db.add(category)
        created.append(category)

    db.flush()
    return created