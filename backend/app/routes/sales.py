from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.schemas.sales import SalesAnalyticsResponse
from app.services.zoho_sales_service import get_sales_analytics_data

router = APIRouter(prefix="/api/sales", tags=["Sales Intelligence"])


@router.get("/{company_id}", response_model=SalesAnalyticsResponse)
def get_sales(
    company_id: UUID,
    range_key: str = Query(default="4w", alias="range", pattern="^(week|4w|3m|6m|12m)$"),
    customer_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return get_sales_analytics_data(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        range_key=range_key,
        customer_id=customer_id,
    )
