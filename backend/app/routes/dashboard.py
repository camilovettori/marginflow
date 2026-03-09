from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import (
    get_dashboard_summary,
    get_dashboard_portfolio,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _parse_ddmmyyyy(value: str | None) -> date | None:
    if not value:
        return None
    d, m, y = value.split("-")
    return date(int(y), int(m), int(d))


@router.get("/", response_model=DashboardSummary)
def dashboard(
    company_id: UUID = Query(...),
    weeks: int = Query(4, ge=1, le=52),
    from_week_ending: str | None = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    from_date = _parse_ddmmyyyy(from_week_ending)

    return get_dashboard_summary(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
        weeks=weeks,
        from_week_ending=from_date,
    )


@router.get("/portfolio")
def dashboard_portfolio(
    weeks: int = Query(4, ge=1, le=52),
    from_week_ending: str | None = Query(default=None),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    from_date = _parse_ddmmyyyy(from_week_ending)

    return get_dashboard_portfolio(
        db=db,
        tenant_id=tenant_id,
        weeks=weeks,
        from_week_ending=from_date,
    )