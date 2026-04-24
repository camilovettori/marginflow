from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.schemas.analytics import CompanyAnalyticsResponse
from app.services.analytics_service import get_company_analytics

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/{company_id}", response_model=CompanyAnalyticsResponse)
def analytics(
    company_id: UUID,
    period: str = Query(
        default="last-4-weeks",
        pattern="^(last-week|last-4-weeks|last-3-months|last-6-months|last-12-months|specific-range)$",
    ),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return get_company_analytics(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        period_key=period,
        start_date=start_date,
        end_date=end_date,
    )
