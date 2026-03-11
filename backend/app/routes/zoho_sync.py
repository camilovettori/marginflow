# backend/app/routes/weekly_report.py
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.models.company import Company
from app.models.weekly_report import WeeklyReport
from app.schemas.weekly_report import WeeklyReportCreate, WeeklyReportResponse
from app.services.metrics_service import persist_metrics

router = APIRouter(prefix="/api/weekly-reports", tags=["Weekly Reports"])


@router.post("/", response_model=WeeklyReportResponse)
def create_weekly_report(
    payload: WeeklyReportCreate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    # tenant safety: company precisa existir e pertencer ao tenant
    company = (
        db.query(Company)
        .filter(Company.id == payload.company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=400, detail="Company inválida para este tenant")

    # evita duplicar a mesma semana
    existing = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.tenant_id == tenant_id,
            WeeklyReport.company_id == payload.company_id,
            WeeklyReport.week_ending == payload.week_ending,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Weekly report já existe para esta semana")

    wr = WeeklyReport(
        tenant_id=tenant_id,
        company_id=payload.company_id,
        week_ending=payload.week_ending,
        sales_inc_vat=payload.sales_inc_vat,
        sales_ex_vat=payload.sales_ex_vat,
        wages=payload.wages,
        holiday_pay=payload.holiday_pay,
        food_cost=payload.food_cost,
        fixed_costs=payload.fixed_costs,
        variable_costs=payload.variable_costs,
        loans_hp=payload.loans_hp,
        vat_due=payload.vat_due,
        notes=payload.notes,
    )

    db.add(wr)
    db.flush()  # garante wr.id sem commit

    # métricas na MESMA transação/sessão
    persist_metrics(db, wr)

    db.commit()
    db.refresh(wr)
    return wr


@router.get("/", response_model=list[WeeklyReportResponse])
def list_weekly_reports(
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
    company_id: UUID | None = Query(default=None),
):
    q = db.query(WeeklyReport).filter(WeeklyReport.tenant_id == tenant_id)

    if company_id:
        # garante que a company é do tenant (pra não permitir enumerar ids)
        ok = (
            db.query(Company)
            .filter(Company.id == company_id, Company.tenant_id == tenant_id)
            .first()
        )
        if not ok:
            raise HTTPException(status_code=400, detail="Company inválida para este tenant")

        q = q.filter(WeeklyReport.company_id == company_id)

    return q.order_by(WeeklyReport.week_ending.desc()).all()


@router.get("/{weekly_report_id}", response_model=WeeklyReportResponse)
def get_weekly_report(
    weekly_report_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    wr = (
        db.query(WeeklyReport)
        .filter(WeeklyReport.id == weekly_report_id, WeeklyReport.tenant_id == tenant_id)
        .first()
    )
    if not wr:
        raise HTTPException(status_code=404, detail="Weekly report not found")
    return wr