from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.weekly_metrics import WeeklyMetrics
from app.models.weekly_report import WeeklyReport


WAGE_ALERT_THRESHOLD = Decimal("0.35")
TWOPLACES = Decimal("0.01")
FOURPLACES = Decimal("0.0001")


def _to_decimal(value: object | None) -> Decimal:
    try:
        if value is None or value == "":
            return Decimal("0.00")
        return Decimal(str(value))
    except Exception:
        return Decimal("0.00")


def _q2(value: Decimal) -> Decimal:
    return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def _q4(value: Decimal) -> Decimal:
    return value.quantize(FOURPLACES, rounding=ROUND_HALF_UP)


def calculate_metrics(report: WeeklyReport) -> dict:
    sales_ex_vat = _to_decimal(report.sales_ex_vat)
    wages = _to_decimal(report.wages)
    holiday_pay = _to_decimal(report.holiday_pay)
    food_cost = _to_decimal(report.food_cost)
    fixed_costs = _to_decimal(report.fixed_costs)
    variable_costs = _to_decimal(report.variable_costs)
    loans_hp = _to_decimal(report.loans_hp)
    vat_due = _to_decimal(report.vat_due)

    labour_total = wages + holiday_pay

    gross_profit = sales_ex_vat - food_cost
    gross_margin_pct = gross_profit / sales_ex_vat if sales_ex_vat > 0 else Decimal("0")

    labour_pct = labour_total / sales_ex_vat if sales_ex_vat > 0 else Decimal("0")
    wage_pct_ex_holiday = wages / sales_ex_vat if sales_ex_vat > 0 else Decimal("0")

    cash_left_after_wages_food = gross_profit - labour_total

    net_profit = (
        sales_ex_vat
        - labour_total
        - food_cost
        - fixed_costs
        - variable_costs
        - loans_hp
        - vat_due
    )
    net_margin_pct = net_profit / sales_ex_vat if sales_ex_vat > 0 else Decimal("0")

    return {
        "gross_profit": _q2(gross_profit),
        "gross_margin_pct": _q4(gross_margin_pct),
        "wage_pct": _q4(labour_pct),
        "wage_pct_ex_holiday": _q4(wage_pct_ex_holiday),
        "cash_left_after_wages_food": _q2(cash_left_after_wages_food),
        "projected_net_profit": _q2(net_profit),
        "net_margin_pct": _q4(net_margin_pct),
        "flag_high_wage": labour_pct > WAGE_ALERT_THRESHOLD,
        "flag_negative_profit": net_profit < 0,
        "_derived": {
            "sales_ex_vat": _q2(sales_ex_vat),
            "labour_total": _q2(labour_total),
            "gross_profit": _q2(gross_profit),
            "gross_margin_pct": _q4(gross_margin_pct),
            "labour_pct": _q4(labour_pct),
            "net_profit": _q2(net_profit),
            "net_margin_pct": _q4(net_margin_pct),
        },
    }


def persist_metrics(db: Session, report: WeeklyReport) -> WeeklyMetrics:
    data = calculate_metrics(report)
    db_payload = {k: v for k, v in data.items() if k != "_derived"}

    existing = (
        db.query(WeeklyMetrics)
        .filter(WeeklyMetrics.weekly_report_id == report.id)
        .first()
    )

    if existing:
        for key, value in db_payload.items():
            setattr(existing, key, value)
        return existing

    metrics = WeeklyMetrics(
        tenant_id=report.tenant_id,
        company_id=report.company_id,
        weekly_report_id=report.id,
        **db_payload,
    )
    db.add(metrics)
    return metrics