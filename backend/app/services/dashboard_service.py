from __future__ import annotations

from datetime import date
from typing import List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.weekly_report import WeeklyReport
from app.models.weekly_metrics import WeeklyMetrics
from app.schemas.dashboard import DashboardSummary, DashboardWeekRow
def _f(v) -> float:
    try:
        return float(v or 0)
    except Exception:
        return 0.0


def get_dashboard_summary(
    db: Session,
    tenant_id: UUID,
    company_id: UUID,
    weeks: int = 4,
    from_week_ending: date | None = None,
) -> DashboardSummary:
    # últimos N weekly_reports (mais recentes primeiro)
    reports_stmt = (
        select(WeeklyReport)
        .where(WeeklyReport.tenant_id == tenant_id)
        .where(WeeklyReport.company_id == company_id)
    )

    # filtro opcional (<= dd-mm-yyyy convertido para date no route)
    if from_week_ending:
        reports_stmt = reports_stmt.where(WeeklyReport.week_ending <= from_week_ending)

    reports_stmt = (
        reports_stmt.order_by(WeeklyReport.week_ending.desc())
        .limit(weeks)
    )

    reports = list(db.execute(reports_stmt).scalars().all())

    if not reports:
        return DashboardSummary(
            tenant_id=tenant_id,
            company_id=company_id,
            weeks=weeks,
            total_sales_ex_vat=0,
            total_sales_inc_vat=0,
            total_wages=0,
            total_food_cost=0,
            total_fixed_costs=0,
            total_variable_costs=0,
            total_loans_hp=0,
            total_vat_due=0,
            total_gross_profit=0,
            total_net_profit=0,
            avg_gross_margin_pct=0,
            avg_net_margin_pct=0,
            last_weeks=[],
        )

    report_ids = [r.id for r in reports]

    # metrics para esses reports
    metrics_stmt = (
        select(WeeklyMetrics)
        .where(WeeklyMetrics.tenant_id == tenant_id)
        .where(WeeklyMetrics.company_id == company_id)
        .where(WeeklyMetrics.weekly_report_id.in_(report_ids))
    )
    metrics = list(db.execute(metrics_stmt).scalars().all())
    metrics_by_report = {m.weekly_report_id: m for m in metrics}

    rows: List[DashboardWeekRow] = []
    for r in reports:
        m = metrics_by_report.get(r.id)

        gross_profit = _f(getattr(m, "gross_profit", 0) if m else 0)
        gross_margin_pct = _f(getattr(m, "gross_margin_pct", 0) if m else 0)

        # ✅ NO BANCO: projected_net_profit (não existe net_profit)
        net_profit = _f(getattr(m, "projected_net_profit", 0) if m else 0)
        net_margin_pct = _f(getattr(m, "net_margin_pct", 0) if m else 0)

        rows.append(
            DashboardWeekRow(
                week_ending=r.week_ending,
                sales_inc_vat=_f(r.sales_inc_vat),
                sales_ex_vat=_f(r.sales_ex_vat),
                gross_profit=gross_profit,
                gross_margin_pct=gross_margin_pct,
                net_profit=net_profit,
                net_margin_pct=net_margin_pct,
            )
        )

    # Totais do input (WeeklyReport)
    total_sales_ex_vat = sum(_f(r.sales_ex_vat) for r in reports)
    total_sales_inc_vat = sum(_f(r.sales_inc_vat) for r in reports)
    total_wages = sum(_f(r.wages) for r in reports)
    total_food_cost = sum(_f(r.food_cost) for r in reports)
    total_fixed_costs = sum(_f(r.fixed_costs) for r in reports)
    total_variable_costs = sum(_f(r.variable_costs) for r in reports)
    total_loans_hp = sum(_f(r.loans_hp) for r in reports)
    total_vat_due = sum(_f(r.vat_due) for r in reports)

    # Totais calculados (WeeklyMetrics)
    total_gross_profit = sum(_f(getattr(metrics_by_report.get(r.id), "gross_profit", 0)) for r in reports)
    total_net_profit = sum(_f(getattr(metrics_by_report.get(r.id), "projected_net_profit", 0)) for r in reports)

    # Médias (%)
    n = len(rows)
    avg_gross_margin_pct = (sum(row.gross_margin_pct for row in rows) / n) if n else 0.0
    avg_net_margin_pct = (sum(row.net_margin_pct for row in rows) / n) if n else 0.0

    return DashboardSummary(
        tenant_id=tenant_id,
        company_id=company_id,
        weeks=weeks,
        total_sales_ex_vat=total_sales_ex_vat,
        total_sales_inc_vat=total_sales_inc_vat,
        total_wages=total_wages,
        total_food_cost=total_food_cost,
        total_fixed_costs=total_fixed_costs,
        total_variable_costs=total_variable_costs,
        total_loans_hp=total_loans_hp,
        total_vat_due=total_vat_due,
        total_gross_profit=total_gross_profit,
        total_net_profit=total_net_profit,
        avg_gross_margin_pct=avg_gross_margin_pct,
        avg_net_margin_pct=avg_net_margin_pct,
        # mais antigo -> mais novo
        last_weeks=list(reversed(rows)),
    )

def get_dashboard_portfolio(
    db: Session,
    tenant_id: UUID,
    weeks: int = 4,
    from_week_ending: date | None = None,
) -> dict:
    companies = list(
        db.execute(
            select(Company)
            .where(Company.tenant_id == tenant_id)
            .order_by(Company.name.asc())
        ).scalars().all()
    )

    company_rows = []

    total_sales_ex_vat = 0.0
    total_sales_inc_vat = 0.0
    total_gross_profit = 0.0
    total_net_profit = 0.0

    for company in companies:
        reports_stmt = (
            select(WeeklyReport)
            .where(WeeklyReport.tenant_id == tenant_id)
            .where(WeeklyReport.company_id == company.id)
        )

        if from_week_ending:
            reports_stmt = reports_stmt.where(WeeklyReport.week_ending <= from_week_ending)

        reports_stmt = (
            reports_stmt.order_by(WeeklyReport.week_ending.desc())
            .limit(weeks)
        )

        reports = list(db.execute(reports_stmt).scalars().all())

        if not reports:
            company_rows.append(
                {
                    "company_id": str(company.id),
                    "company_name": company.name,
                    "weeks": weeks,
                    "sales_ex_vat": 0.0,
                    "sales_inc_vat": 0.0,
                    "gross_profit": 0.0,
                    "net_profit": 0.0,
                    "gross_margin_pct": 0.0,
                    "net_margin_pct": 0.0,
                }
            )
            continue

        report_ids = [r.id for r in reports]

        metrics_stmt = (
            select(WeeklyMetrics)
            .where(WeeklyMetrics.tenant_id == tenant_id)
            .where(WeeklyMetrics.company_id == company.id)
            .where(WeeklyMetrics.weekly_report_id.in_(report_ids))
        )
        metrics = list(db.execute(metrics_stmt).scalars().all())
        metrics_by_report = {m.weekly_report_id: m for m in metrics}

        sales_ex_vat = sum(_f(r.sales_ex_vat) for r in reports)
        sales_inc_vat = sum(_f(r.sales_inc_vat) for r in reports)
        gross_profit = sum(_f(getattr(metrics_by_report.get(r.id), "gross_profit", 0)) for r in reports)
        net_profit = sum(_f(getattr(metrics_by_report.get(r.id), "projected_net_profit", 0)) for r in reports)

        n = len(reports)
        gross_margin_pct = (
            sum(_f(getattr(metrics_by_report.get(r.id), "gross_margin_pct", 0)) for r in reports) / n
            if n else 0.0
        )
        net_margin_pct = (
            sum(_f(getattr(metrics_by_report.get(r.id), "net_margin_pct", 0)) for r in reports) / n
            if n else 0.0
        )

        total_sales_ex_vat += sales_ex_vat
        total_sales_inc_vat += sales_inc_vat
        total_gross_profit += gross_profit
        total_net_profit += net_profit

        company_rows.append(
            {
                "company_id": str(company.id),
                "company_name": company.name,
                "weeks": weeks,
                "sales_ex_vat": sales_ex_vat,
                "sales_inc_vat": sales_inc_vat,
                "gross_profit": gross_profit,
                "net_profit": net_profit,
                "gross_margin_pct": gross_margin_pct,
                "net_margin_pct": net_margin_pct,
            }
        )

    company_rows.sort(key=lambda x: x["net_profit"], reverse=True)

    return {
        "tenant_id": str(tenant_id),
        "weeks": weeks,
        "total_sales_ex_vat": total_sales_ex_vat,
        "total_sales_inc_vat": total_sales_inc_vat,
        "total_gross_profit": total_gross_profit,
        "total_net_profit": total_net_profit,
        "companies": company_rows,
    }