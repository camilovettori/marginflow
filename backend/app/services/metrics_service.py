from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.weekly_report import WeeklyReport
from app.models.weekly_metrics import WeeklyMetrics


WAGE_ALERT_THRESHOLD = Decimal("0.35")  # 35%


def calculate_metrics(report: WeeklyReport) -> dict:
    """
    Recebe um WeeklyReport e retorna um dict com os campos calculados.
    Não grava no banco. Só calcula.
    """
    sales = Decimal(report.sales_ex_vat or 0)
    wages = Decimal(report.wages or 0)
    holiday = Decimal(report.holiday_pay or 0)
    food = Decimal(report.food_cost or 0)
    fixed = Decimal(report.fixed_costs or 0)
    variable = Decimal(report.variable_costs or 0)
    loans = Decimal(report.loans_hp or 0)

    total_wages = wages + holiday

    gross_profit = sales - food
    gross_margin = (gross_profit / sales) if sales > 0 else Decimal("0")

    wage_pct = (total_wages / sales) if sales > 0 else Decimal("0")
    wage_pct_ex_holiday = (wages / sales) if sales > 0 else Decimal("0")

    cash_left = gross_profit - total_wages

    projected_net = gross_profit - total_wages - fixed - variable - loans
    net_margin = (projected_net / sales) if sales > 0 else Decimal("0")

    return {
        "gross_profit": gross_profit,
        "gross_margin_pct": gross_margin,
        "wage_pct": wage_pct,
        "wage_pct_ex_holiday": wage_pct_ex_holiday,
        "cash_left_after_wages_food": cash_left,
        "projected_net_profit": projected_net,
        "net_margin_pct": net_margin,
        "flag_high_wage": wage_pct > WAGE_ALERT_THRESHOLD,
        "flag_negative_profit": projected_net < 0,
    }


def persist_metrics(db: Session, report: WeeklyReport) -> WeeklyMetrics:
    """
    Calcula e grava métricas no banco usando a mesma sessão/transaction.
    Faz UPSERT por weekly_report_id.
    """
    data = calculate_metrics(report)

    existing = (
        db.query(WeeklyMetrics)
        .filter(WeeklyMetrics.weekly_report_id == report.id)
        .first()
    )

    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        return existing

    metrics = WeeklyMetrics(
        tenant_id=report.tenant_id,
        company_id=report.company_id,
        weekly_report_id=report.id,
        **data,
    )
    db.add(metrics)
    return metrics