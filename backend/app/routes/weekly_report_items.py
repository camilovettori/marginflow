from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.models.financial_category import FinancialCategory
from app.models.weekly_report import WeeklyReport
from app.models.weekly_report_item import WeeklyReportItem
from app.schemas.weekly_report_item import (
    WeeklyReportItemCreate,
    WeeklyReportItemResponse,
    WeeklyReportItemUpdate,
)
from app.services.metrics_service import persist_metrics

router = APIRouter(prefix="/api/weekly-report-items", tags=["Weekly Report Items"])


CORE_CATEGORY_MAP = {
    "wages": "wages",
    "holiday pay": "holiday_pay",
    "food purchases": "food_cost",
}


def _to_decimal(value: object | None) -> Decimal:
    try:
        if value is None or value == "":
            return Decimal("0.00")
        return Decimal(str(value))
    except Exception:
        return Decimal("0.00")


def _normalize_name(value: str | None) -> str:
    return (value or "").strip().lower()


def _sync_core_fields_from_items(
    db: Session,
    report: WeeklyReport,
    tenant_id: UUID,
) -> WeeklyReport:
    items = (
        db.query(WeeklyReportItem, FinancialCategory)
        .join(FinancialCategory, FinancialCategory.id == WeeklyReportItem.category_id)
        .filter(
            WeeklyReportItem.weekly_report_id == report.id,
            WeeklyReportItem.tenant_id == tenant_id,
            FinancialCategory.tenant_id == tenant_id,
        )
        .all()
    )

    totals = {
        "wages": Decimal("0.00"),
        "holiday_pay": Decimal("0.00"),
        "food_cost": Decimal("0.00"),
    }

    for item, category in items:
        normalized_name = _normalize_name(category.name)
        mapped_field = CORE_CATEGORY_MAP.get(normalized_name)

        if mapped_field:
            totals[mapped_field] += _to_decimal(item.amount)

    report.wages = totals["wages"]
    report.holiday_pay = totals["holiday_pay"]
    report.food_cost = totals["food_cost"]

    persist_metrics(db, report)
    db.add(report)
    return report


@router.get("/report/{weekly_report_id}", response_model=list[WeeklyReportItemResponse])
def list_weekly_report_items(
    weekly_report_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    report = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.id == weekly_report_id,
            WeeklyReport.tenant_id == tenant_id,
        )
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Weekly report not found")

    return (
        db.query(WeeklyReportItem)
        .filter(
            WeeklyReportItem.weekly_report_id == weekly_report_id,
            WeeklyReportItem.tenant_id == tenant_id,
        )
        .order_by(WeeklyReportItem.created_at.asc())
        .all()
    )


@router.post("/report/{weekly_report_id}", response_model=WeeklyReportItemResponse)
def create_weekly_report_item(
    weekly_report_id: UUID,
    payload: WeeklyReportItemCreate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    report = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.id == weekly_report_id,
            WeeklyReport.tenant_id == tenant_id,
        )
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Weekly report not found")

    category = (
        db.query(FinancialCategory)
        .filter(
            FinancialCategory.id == payload.category_id,
            FinancialCategory.tenant_id == tenant_id,
        )
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="Financial category not found")

    item = WeeklyReportItem(
        tenant_id=tenant_id,
        company_id=report.company_id,
        weekly_report_id=weekly_report_id,
        category_id=payload.category_id,
        amount=payload.amount,
        notes=payload.notes,
    )
    db.add(item)
    db.flush()

    _sync_core_fields_from_items(db, report, tenant_id)

    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=WeeklyReportItemResponse)
def update_weekly_report_item(
    item_id: UUID,
    payload: WeeklyReportItemUpdate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    item = (
        db.query(WeeklyReportItem)
        .filter(
            WeeklyReportItem.id == item_id,
            WeeklyReportItem.tenant_id == tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Weekly report item not found")

    category = (
        db.query(FinancialCategory)
        .filter(
            FinancialCategory.id == payload.category_id,
            FinancialCategory.tenant_id == tenant_id,
        )
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="Financial category not found")

    report = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.id == item.weekly_report_id,
            WeeklyReport.tenant_id == tenant_id,
        )
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Weekly report not found")

    item.category_id = payload.category_id
    item.amount = payload.amount
    item.notes = payload.notes

    db.flush()

    _sync_core_fields_from_items(db, report, tenant_id)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_weekly_report_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    item = (
        db.query(WeeklyReportItem)
        .filter(
            WeeklyReportItem.id == item_id,
            WeeklyReportItem.tenant_id == tenant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Weekly report item not found")

    report = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.id == item.weekly_report_id,
            WeeklyReport.tenant_id == tenant_id,
        )
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Weekly report not found")

    db.delete(item)
    db.flush()

    _sync_core_fields_from_items(db, report, tenant_id)

    db.commit()
    return {"success": True}