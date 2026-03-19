from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.models.company import Company
from app.models.weekly_report import WeeklyReport
from app.schemas.weekly_report import (
    WeeklyReportCreate,
    WeeklyReportUpdate,
    WeeklyReportResponse,
    WeeklyReportsSummaryResponse,
    WeeklyReportPdfResponse,
    WeeklyReportEmailResponse,
    WeeklyReportBulkDeleteRequest,

)
from app.services.metrics_service import persist_metrics

router = APIRouter(prefix="/api/weekly-reports", tags=["Weekly Reports"])


def get_week_start_monday(week_ending: date) -> date:
    weekday = week_ending.weekday()  # Monday=0 ... Sunday=6
    return week_ending - timedelta(days=weekday)


def get_week_end_sunday(week_ending: date) -> date:
    start = get_week_start_monday(week_ending)
    return start + timedelta(days=6)


def serialize_weekly_report(
    wr: WeeklyReport,
    company_name: str | None = None,
) -> WeeklyReportResponse:
    sales_ex_vat = float(wr.sales_ex_vat or 0)
    wages = float(wr.wages or 0)
    holiday_pay = float(wr.holiday_pay or 0)
    food_cost = float(wr.food_cost or 0)
    fixed_costs = float(wr.fixed_costs or 0)
    variable_costs = float(wr.variable_costs or 0)
    loans_hp = float(wr.loans_hp or 0)
    vat_due = float(wr.vat_due or 0)

    total_labour = wages + holiday_pay
    gross_profit = sales_ex_vat - food_cost
    net_profit = (
        sales_ex_vat
        - total_labour
        - food_cost
        - fixed_costs
        - variable_costs
        - loans_hp
        - vat_due
    )

    gross_margin_pct = (gross_profit / sales_ex_vat) if sales_ex_vat > 0 else 0
    net_margin_pct = (net_profit / sales_ex_vat) if sales_ex_vat > 0 else 0
    labour_pct = (total_labour / sales_ex_vat) if sales_ex_vat > 0 else 0

    iso_year, iso_week, _ = wr.week_ending.isocalendar()
    week_start = get_week_start_monday(wr.week_ending)
    week_end = get_week_end_sunday(wr.week_ending)

    insights: list[str] = []

    if labour_pct > 0.35:
        insights.append(
            "Labour cost is above target. Review staffing levels on lower-traffic days."
        )

    if gross_margin_pct < 0.60:
        insights.append(
            "Gross margin is below healthy range. Review food cost, wastage, and supplier pricing."
        )

    if net_margin_pct < 0.10:
        insights.append(
            "Net margin is below target. Focus on labour control, pricing, and cost discipline."
        )

    if not insights:
        insights.append("This week is performing within healthy margin thresholds.")

    return WeeklyReportResponse(
        id=wr.id,
        tenant_id=wr.tenant_id,
        company_id=wr.company_id,
        company_name=company_name,
        week_ending=wr.week_ending,
        week_start=week_start,
        week_end=week_end,
        iso_week=iso_week,
        iso_year=iso_year,
        sales_inc_vat=float(wr.sales_inc_vat or 0),
        sales_ex_vat=sales_ex_vat,
        wages=wages,
        holiday_pay=holiday_pay,
        food_cost=food_cost,
        fixed_costs=fixed_costs,
        variable_costs=variable_costs,
        loans_hp=loans_hp,
        vat_due=vat_due,
        gross_profit=round(gross_profit, 2),
        gross_margin_pct=round(gross_margin_pct, 4),
        net_profit=round(net_profit, 2),
        net_margin_pct=round(net_margin_pct, 4),
        labour_pct=round(labour_pct, 4),
        source="manual",
        notes=wr.notes,
        insights=insights,
        recommendations=insights,
        created_at=getattr(wr, "created_at", None),
        updated_at=getattr(wr, "updated_at", None),
    )


@router.post("/", response_model=WeeklyReportResponse)
def create_weekly_report(
    payload: WeeklyReportCreate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    company = (
        db.query(Company)
        .filter(Company.id == payload.company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=400, detail="Company inválida para este tenant")

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
    db.flush()

    persist_metrics(db, wr)

    db.commit()
    db.refresh(wr)

    return serialize_weekly_report(wr, company.name)


@router.get("/", response_model=list[WeeklyReportResponse])
def list_weekly_reports(
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
    company_id: UUID | None = Query(default=None),
):
    q = db.query(WeeklyReport).filter(WeeklyReport.tenant_id == tenant_id)

    company_map: dict[UUID, str] = {}

    if company_id:
        company = (
            db.query(Company)
            .filter(Company.id == company_id, Company.tenant_id == tenant_id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=400, detail="Company inválida para este tenant")

        q = q.filter(WeeklyReport.company_id == company_id)
        company_map[company.id] = company.name
    else:
        companies = db.query(Company).filter(Company.tenant_id == tenant_id).all()
        company_map = {company.id: company.name for company in companies}

    reports = q.order_by(WeeklyReport.week_ending.desc()).all()

    return [
        serialize_weekly_report(report, company_map.get(report.company_id))
        for report in reports
    ]


@router.get("/summary", response_model=WeeklyReportsSummaryResponse)
def get_weekly_reports_summary(
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
    company_id: UUID | None = Query(default=None),
):
    q = db.query(WeeklyReport).filter(WeeklyReport.tenant_id == tenant_id)

    if company_id:
        company = (
            db.query(Company)
            .filter(Company.id == company_id, Company.tenant_id == tenant_id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=400, detail="Company inválida para este tenant")

        q = q.filter(WeeklyReport.company_id == company_id)

    reports = q.order_by(WeeklyReport.week_ending.desc()).all()

    total_sales_inc_vat = sum(float(r.sales_inc_vat or 0) for r in reports)
    total_sales_ex_vat = sum(float(r.sales_ex_vat or 0) for r in reports)
    total_wages = sum(float(r.wages or 0) + float(r.holiday_pay or 0) for r in reports)

    total_net_profit = 0.0
    for r in reports:
        sales_ex_vat = float(r.sales_ex_vat or 0)
        total_labour = float(r.wages or 0) + float(r.holiday_pay or 0)
        total_net_profit += (
            sales_ex_vat
            - total_labour
            - float(r.food_cost or 0)
            - float(r.fixed_costs or 0)
            - float(r.variable_costs or 0)
            - float(r.loans_hp or 0)
            - float(r.vat_due or 0)
        )

    return WeeklyReportsSummaryResponse(
        total_reports=len(reports),
        imported_reports=0,
        manual_reports=len(reports),
        total_sales_inc_vat=round(total_sales_inc_vat, 2),
        total_sales_ex_vat=round(total_sales_ex_vat, 2),
        total_wages=round(total_wages, 2),
        total_net_profit=round(total_net_profit, 2),
    )


@router.delete("/bulk")
def delete_weekly_reports_bulk(
    payload: WeeklyReportBulkDeleteRequest,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    if not payload.report_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No report IDs provided.",
        )

    reports = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.tenant_id == tenant_id,
            WeeklyReport.id.in_(payload.report_ids),
        )
        .all()
    )

    if not reports:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching weekly reports found.",
        )

    deleted_ids: list[UUID] = []

    for report in reports:
        deleted_ids.append(report.id)
        db.delete(report)

    db.commit()

    return {
        "success": True,
        "deleted_count": len(deleted_ids),
        "deleted_report_ids": deleted_ids,
    }

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

    company = (
        db.query(Company)
        .filter(Company.id == wr.company_id, Company.tenant_id == tenant_id)
        .first()
    )

    return serialize_weekly_report(wr, company.name if company else None)


@router.put("/{weekly_report_id}", response_model=WeeklyReportResponse)
def update_weekly_report(
    weekly_report_id: UUID,
    payload: WeeklyReportUpdate,
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

    company = (
        db.query(Company)
        .filter(Company.id == payload.company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=400, detail="Company inválida para este tenant")

    existing = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.tenant_id == tenant_id,
            WeeklyReport.company_id == payload.company_id,
            WeeklyReport.week_ending == payload.week_ending,
            WeeklyReport.id != weekly_report_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Weekly report já existe para esta semana")

    wr.company_id = payload.company_id
    wr.week_ending = payload.week_ending
    wr.sales_inc_vat = payload.sales_inc_vat
    wr.sales_ex_vat = payload.sales_ex_vat
    wr.wages = payload.wages
    wr.holiday_pay = payload.holiday_pay
    wr.food_cost = payload.food_cost
    wr.fixed_costs = payload.fixed_costs
    wr.variable_costs = payload.variable_costs
    wr.loans_hp = payload.loans_hp
    wr.vat_due = payload.vat_due
    wr.notes = payload.notes

    persist_metrics(db, wr)

    db.commit()
    db.refresh(wr)

    return serialize_weekly_report(wr, company.name)


@router.post("/{weekly_report_id}/generate-pdf", response_model=WeeklyReportPdfResponse)
def generate_weekly_report_pdf(
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

    company = (
        db.query(Company)
        .filter(Company.id == wr.company_id, Company.tenant_id == tenant_id)
        .first()
    )

    serialized = serialize_weekly_report(wr, company.name if company else None)

    return WeeklyReportPdfResponse(
        download_url=f"/api/weekly-reports/{weekly_report_id}/pdf-preview",
        report=serialized,
    )


@router.post("/{weekly_report_id}/send-email", response_model=WeeklyReportEmailResponse)
def send_weekly_report_email(
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

    company = (
        db.query(Company)
        .filter(Company.id == wr.company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if not company.email:
        raise HTTPException(
            status_code=400,
            detail="This company does not have an email configured yet.",
        )

    return WeeklyReportEmailResponse(
        success=True,
        message=f"Weekly report email queued for {company.email}.",
    )

