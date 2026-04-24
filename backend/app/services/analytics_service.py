from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
import re
from typing import Iterable
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.purchase_invoice import PurchaseInvoice
from app.models.purchase_invoice_line import PurchaseInvoiceLine
from app.models.weekly_metrics import WeeklyMetrics
from app.models.weekly_report import WeeklyReport
from app.models.zoho_sales_invoice import ZohoSalesInvoice
from app.models.zoho_sales_invoice_item import ZohoSalesInvoiceItem
from app.schemas.analytics import (
    AnalyticsCategoryResponse,
    AnalyticsCoverageResponse,
    AnalyticsHighlightResponse,
    AnalyticsMetricResponse,
    AnalyticsPeriodResponse,
    AnalyticsProductResponse,
    AnalyticsInsightResponse,
    AnalyticsSummaryResponse,
    AnalyticsTrendPointResponse,
    CompanyAnalyticsResponse,
)
from app.services.recipes_service import list_recipes


PERIOD_DEFINITIONS: dict[str, tuple[str, int, str]] = {
    "last-week": ("Last week", 7, "day"),
    "last-4-weeks": ("Last 4 weeks", 28, "day"),
    "last-3-months": ("Last 3 months", 90, "week"),
    "last-6-months": ("Last 6 months", 180, "week"),
    "last-12-months": ("Last 12 months", 365, "month"),
}

LABOUR_ALERT_THRESHOLD = 0.35
FOOD_COST_ALERT_THRESHOLD = 0.30
NET_MARGIN_ALERT_THRESHOLD = 0.10
GROSS_MARGIN_ALERT_THRESHOLD = 0.60


def _normalize_text(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def _f(value: object | None) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _fmt_date(value: date) -> str:
    return value.strftime("%d %b %Y")


def _month_key(value: date) -> date:
    return date(value.year, value.month, 1)


def _week_end_sunday(value: date) -> date:
    return value + timedelta(days=(6 - value.weekday()))


def _period_granularity(days: int) -> str:
    if days <= 35:
        return "day"
    if days <= 120:
        return "week"
    return "month"


def _comparison_window(start_date: date, total_days: int) -> tuple[date, date]:
    comparison_end = start_date - timedelta(days=1)
    comparison_start = comparison_end - timedelta(days=total_days - 1)
    return comparison_start, comparison_end


def _resolve_period(
    period_key: str,
    *,
    start_date: date | None,
    end_date: date | None,
) -> AnalyticsPeriodResponse:
    if period_key == "specific-range":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start_date and end_date are required for a specific range")
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="start_date must be on or before end_date")
        total_days = (end_date - start_date).days + 1
        label = f"{_fmt_date(start_date)} - {_fmt_date(end_date)}"
        comparison_start, comparison_end = _comparison_window(start_date, total_days)
        comparison_label = "Previous equivalent period"
        granularity = _period_granularity(total_days)
        return AnalyticsPeriodResponse(
            key=period_key,
            label=label,
            granularity=granularity, 
            start_date=start_date,
            end_date=end_date,
            comparison_start_date=comparison_start,
            comparison_end_date=comparison_end,
            comparison_label=comparison_label,
            total_days=total_days,
        )

    if period_key not in PERIOD_DEFINITIONS:
        raise HTTPException(status_code=400, detail="Invalid period")

    label, total_days, granularity = PERIOD_DEFINITIONS[period_key]
    end_date = date.today()
    start_date = end_date - timedelta(days=total_days - 1)
    comparison_start, comparison_end = _comparison_window(start_date, total_days)

    return AnalyticsPeriodResponse(
        key=period_key,
        label=label,
        granularity=granularity,
        start_date=start_date,
        end_date=end_date,
        comparison_start_date=comparison_start,
        comparison_end_date=comparison_end,
        comparison_label=f"Previous {label.lower()}",
        total_days=total_days,
    )


def _load_company(db: Session, tenant_id: UUID, company_id: UUID) -> Company:
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


def _load_weekly_reports(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    start_date: date,
    end_date: date,
) -> tuple[list[WeeklyReport], dict[UUID, WeeklyMetrics]]:
    reports = (
        db.query(WeeklyReport)
        .filter(
            WeeklyReport.tenant_id == tenant_id,
            WeeklyReport.company_id == company_id,
            WeeklyReport.week_ending >= start_date,
            WeeklyReport.week_ending <= end_date,
        )
        .order_by(WeeklyReport.week_ending.asc())
        .all()
    )

    report_ids = [report.id for report in reports]
    if not report_ids:
        return reports, {}

    metrics = (
        db.query(WeeklyMetrics)
        .filter(
            WeeklyMetrics.tenant_id == tenant_id,
            WeeklyMetrics.company_id == company_id,
            WeeklyMetrics.weekly_report_id.in_(report_ids),
        )
        .all()
    )

    metrics_by_report = {metric.weekly_report_id: metric for metric in metrics}
    return reports, metrics_by_report


def _load_sales_rows(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    start_date: date,
    end_date: date,
) -> tuple[list[ZohoSalesInvoice], list[tuple[ZohoSalesInvoiceItem, ZohoSalesInvoice]]]:
    invoices = (
        db.execute(
            select(ZohoSalesInvoice)
            .where(
                ZohoSalesInvoice.tenant_id == tenant_id,
                ZohoSalesInvoice.company_id == company_id,
                ZohoSalesInvoice.invoice_date >= start_date,
                ZohoSalesInvoice.invoice_date <= end_date,
            )
            .order_by(ZohoSalesInvoice.invoice_date.asc())
        )
        .scalars()
        .all()
    )

    invoice_items = (
        db.execute(
            select(ZohoSalesInvoiceItem, ZohoSalesInvoice)
            .join(ZohoSalesInvoice, ZohoSalesInvoice.id == ZohoSalesInvoiceItem.zoho_sales_invoice_id)
            .where(
                ZohoSalesInvoiceItem.tenant_id == tenant_id,
                ZohoSalesInvoiceItem.company_id == company_id,
                ZohoSalesInvoice.invoice_date >= start_date,
                ZohoSalesInvoice.invoice_date <= end_date,
            )
        )
        .all()
    )

    return invoices, invoice_items


def _load_purchase_rows(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    start_date: date,
    end_date: date,
) -> list[tuple[PurchaseInvoice, PurchaseInvoiceLine]]:
    return (
        db.execute(
            select(PurchaseInvoice, PurchaseInvoiceLine)
            .join(PurchaseInvoiceLine, PurchaseInvoiceLine.purchase_invoice_id == PurchaseInvoice.id)
            .where(
                PurchaseInvoice.tenant_id == tenant_id,
                PurchaseInvoice.company_id == company_id,
                PurchaseInvoice.invoice_date >= start_date,
                PurchaseInvoice.invoice_date <= end_date,
            )
            .order_by(PurchaseInvoice.invoice_date.asc(), PurchaseInvoiceLine.line_order.asc())
        )
        .all()
    )


def _build_recipe_lookup(db: Session, *, tenant_id: UUID, company_id: UUID) -> dict[str, dict]:
    data = list_recipes(db, tenant_id=tenant_id, company_id=company_id)
    recipes = data.get("recipes", [])
    recipe_lookup: dict[str, dict] = {}
    for recipe in recipes:
        recipe_name = str(recipe.get("recipe_name") or "").strip()
        if not recipe_name:
            continue
        recipe_lookup[_normalize_text(recipe_name)] = recipe
    return recipe_lookup


def _aggregate_sales(
    invoices: list[ZohoSalesInvoice],
    invoice_items: list[tuple[ZohoSalesInvoiceItem, ZohoSalesInvoice]],
    recipe_lookup: dict[str, dict],
) -> dict:
    revenue_inc_vat = sum(_f(invoice.total_inc_vat) for invoice in invoices)
    revenue_ex_vat = sum(_f(invoice.total_ex_vat) for invoice in invoices)
    invoice_count = len(invoices)
    active_customers = len(
        {
            (invoice.customer_id or invoice.customer_name or "")
            for invoice in invoices
            if (invoice.customer_id or invoice.customer_name)
        }
    )
    average_order_value = revenue_ex_vat / invoice_count if invoice_count else None

    daily: dict[date, dict[str, float | int]] = defaultdict(lambda: {"revenue_ex_vat": 0.0, "revenue_inc_vat": 0.0, "invoice_count": 0})
    weekly: dict[date, dict[str, float | int]] = defaultdict(lambda: {"revenue_ex_vat": 0.0, "revenue_inc_vat": 0.0, "invoice_count": 0})
    monthly: dict[date, dict[str, float | int]] = defaultdict(lambda: {"revenue_ex_vat": 0.0, "revenue_inc_vat": 0.0, "invoice_count": 0})
    item_lookup: dict[str, dict] = {}
    category_lookup: dict[str, dict] = defaultdict(lambda: {"value": 0.0, "item_count": 0})

    for invoice in invoices:
        day_bucket = invoice.invoice_date
        week_bucket = _week_end_sunday(invoice.invoice_date)
        month_bucket = _month_key(invoice.invoice_date)

        daily[day_bucket]["revenue_ex_vat"] += _f(invoice.total_ex_vat)
        daily[day_bucket]["revenue_inc_vat"] += _f(invoice.total_inc_vat)
        daily[day_bucket]["invoice_count"] += 1

        weekly[week_bucket]["revenue_ex_vat"] += _f(invoice.total_ex_vat)
        weekly[week_bucket]["revenue_inc_vat"] += _f(invoice.total_inc_vat)
        weekly[week_bucket]["invoice_count"] += 1

        monthly[month_bucket]["revenue_ex_vat"] += _f(invoice.total_ex_vat)
        monthly[month_bucket]["revenue_inc_vat"] += _f(invoice.total_inc_vat)
        monthly[month_bucket]["invoice_count"] += 1

    for invoice_item, invoice in invoice_items:
        item_name = invoice_item.item_name or "Item"
        item_key = _normalize_text(item_name)
        recipe = recipe_lookup.get(item_key)

        item_row = item_lookup.setdefault(
            item_key,
            {
                "item_id": invoice_item.item_id,
                "item_name": item_name,
                "quantity_sold": 0.0,
                "revenue_ex_vat": 0.0,
                "revenue_inc_vat": 0.0,
                "invoice_numbers": set(),
                "recipe": recipe,
            },
        )
        item_row["quantity_sold"] += _f(invoice_item.quantity)
        item_row["revenue_ex_vat"] += _f(invoice_item.line_total_ex_vat)
        item_row["revenue_inc_vat"] += _f(invoice_item.line_total_inc_vat)
        item_row["invoice_numbers"].add(invoice.invoice_number or invoice.zoho_invoice_id)
        if recipe and not item_row.get("recipe"):
            item_row["recipe"] = recipe

        category = "Uncategorised"
        if recipe:
            category = str(recipe.get("category") or "Uncategorised")
        category_row = category_lookup[category]
        category_row["value"] += _f(invoice_item.line_total_ex_vat)
        category_row["item_count"] += 1

    top_items = sorted(item_lookup.values(), key=lambda row: row["revenue_ex_vat"], reverse=True)
    total_item_revenue = sum(row["revenue_ex_vat"] for row in top_items)

    product_rows: list[dict] = []
    for idx, item in enumerate(top_items[:10], start=1):
        recipe = item.get("recipe")
        estimated_margin_pct = None
        estimated_gross_profit = None
        estimated_food_cost_pct = None
        matched_recipe_id = None
        matched_recipe_name = None
        matched_category = None

        if recipe:
            matched_recipe_id = recipe.get("id")
            matched_recipe_name = recipe.get("recipe_name")
            matched_category = recipe.get("category")
            gross_margin_pct = recipe.get("gross_margin_percent_ex_vat")
            food_cost_pct = recipe.get("food_cost_percent")
            gross_margin_value = recipe.get("gross_margin_value_ex_vat")
            if gross_margin_pct is not None:
                estimated_margin_pct = _f(gross_margin_pct) / 100.0
            if food_cost_pct is not None:
                estimated_food_cost_pct = _f(food_cost_pct) / 100.0
            if gross_margin_value is not None:
                estimated_gross_profit = _f(gross_margin_value) * _f(item["quantity_sold"])

        product_rows.append(
            {
                "rank": idx,
                "item_id": item.get("item_id"),
                "item_name": item["item_name"],
                "quantity_sold": round(_f(item["quantity_sold"]), 2),
                "revenue_ex_vat": round(_f(item["revenue_ex_vat"]), 2),
                "revenue_share": round(_f(item["revenue_ex_vat"]) / total_item_revenue, 4) if total_item_revenue > 0 else 0.0,
                "invoice_count": len(item["invoice_numbers"]),
                "matched_recipe_id": matched_recipe_id,
                "matched_recipe_name": matched_recipe_name,
                "matched_category": matched_category,
                "estimated_recipe_margin_pct": round(estimated_margin_pct, 4) if estimated_margin_pct is not None else None,
                "estimated_recipe_gross_profit": round(estimated_gross_profit, 2) if estimated_gross_profit is not None else None,
                "estimated_recipe_food_cost_pct": round(estimated_food_cost_pct, 4) if estimated_food_cost_pct is not None else None,
            }
        )

    category_rows = sorted(category_lookup.items(), key=lambda item: item[1]["value"], reverse=True)
    top_categories = [
        {
            "rank": idx,
            "label": category,
            "value": round(row["value"], 2),
            "share": round(row["value"] / revenue_ex_vat, 4) if revenue_ex_vat > 0 else 0.0,
            "item_count": row["item_count"],
            "source": "sales_ledger",
        }
        for idx, (category, row) in enumerate(category_rows[:8], start=1)
    ]

    daily_rows = [
        {
            "period": period,
            "label": period.strftime("%d %b"),
            "revenue_ex_vat": round(values["revenue_ex_vat"], 2),
            "revenue_inc_vat": round(values["revenue_inc_vat"], 2),
            "invoice_count": int(values["invoice_count"]),
        }
        for period, values in sorted(daily.items())
    ]

    weekly_rows = [
        {
            "period": period,
            "label": f"Wk ending {period.strftime('%d %b')}",
            "revenue_ex_vat": round(values["revenue_ex_vat"], 2),
            "revenue_inc_vat": round(values["revenue_inc_vat"], 2),
            "invoice_count": int(values["invoice_count"]),
        }
        for period, values in sorted(weekly.items())
    ]

    monthly_rows = [
        {
            "period": period,
            "label": period.strftime("%b %Y"),
            "revenue_ex_vat": round(values["revenue_ex_vat"], 2),
            "revenue_inc_vat": round(values["revenue_inc_vat"], 2),
            "invoice_count": int(values["invoice_count"]),
        }
        for period, values in sorted(monthly.items())
    ]

    day_highlights = sorted(daily.items(), key=lambda item: item[1]["revenue_ex_vat"], reverse=True)
    week_highlights = sorted(weekly.items(), key=lambda item: item[1]["revenue_ex_vat"], reverse=True)
    month_highlights = sorted(monthly.items(), key=lambda item: item[1]["revenue_ex_vat"], reverse=True)

    return {
        "revenue_ex_vat": round(revenue_ex_vat, 2),
        "revenue_inc_vat": round(revenue_inc_vat, 2),
        "invoice_count": invoice_count,
        "active_customers": active_customers,
        "average_order_value": round(average_order_value, 2) if average_order_value is not None else None,
        "product_rows": product_rows,
        "category_rows": top_categories,
        "daily_rows": daily_rows,
        "weekly_rows": weekly_rows,
        "monthly_rows": monthly_rows,
        "day_highlights": day_highlights,
        "week_highlights": week_highlights,
        "month_highlights": month_highlights,
        "item_count": len(item_lookup),
        "matched_product_count": sum(1 for item in item_lookup.values() if item.get("recipe")),
    }


def _aggregate_weekly_reports(
    reports: list[WeeklyReport],
    metrics_by_report: dict[UUID, WeeklyMetrics],
) -> dict:
    weekly_rows: list[dict] = []
    for report in reports:
        metrics = metrics_by_report.get(report.id)
        sales_ex_vat = _f(report.sales_ex_vat)
        sales_inc_vat = _f(report.sales_inc_vat)
        wages = _f(report.wages)
        holiday_pay = _f(report.holiday_pay)
        labour_total = wages + holiday_pay
        food_cost = _f(report.food_cost)
        fixed_costs = _f(report.fixed_costs)
        variable_costs = _f(report.variable_costs)
        loans_hp = _f(report.loans_hp)
        vat_due = _f(report.vat_due)

        gross_profit = _f(getattr(metrics, "gross_profit", None) if metrics else None)
        if gross_profit == 0 and sales_ex_vat > 0:
            gross_profit = sales_ex_vat - food_cost

        net_profit = _f(getattr(metrics, "projected_net_profit", None) if metrics else None)
        if net_profit == 0 and sales_ex_vat > 0:
            net_profit = sales_ex_vat - labour_total - food_cost - fixed_costs - variable_costs - loans_hp - vat_due

        gross_margin_pct = _f(getattr(metrics, "gross_margin_pct", None) if metrics else None)
        if gross_margin_pct == 0 and sales_ex_vat > 0:
            gross_margin_pct = gross_profit / sales_ex_vat

        net_margin_pct = _f(getattr(metrics, "net_margin_pct", None) if metrics else None)
        if net_margin_pct == 0 and sales_ex_vat > 0:
            net_margin_pct = net_profit / sales_ex_vat

        labour_pct = _f(getattr(metrics, "wage_pct", None) if metrics else None)
        if labour_pct == 0 and sales_ex_vat > 0:
            labour_pct = labour_total / sales_ex_vat

        food_cost_pct = food_cost / sales_ex_vat if sales_ex_vat > 0 else None

        weekly_rows.append(
            {
                "period": report.week_ending,
                "label": report.week_ending.strftime("%d %b"),
                "revenue_ex_vat": round(sales_ex_vat, 2),
                "revenue_inc_vat": round(sales_inc_vat, 2),
                "gross_profit": round(gross_profit, 2),
                "net_profit": round(net_profit, 2),
                "gross_margin_pct": round(gross_margin_pct, 4),
                "net_margin_pct": round(net_margin_pct, 4),
                "labour_pct": round(labour_pct, 4),
                "food_cost_pct": round(food_cost_pct, 4) if food_cost_pct is not None else None,
                "labour_total": round(labour_total, 2),
                "food_cost": round(food_cost, 2),
                "invoice_count": None,
            }
        )

    if not weekly_rows:
        return {
            "rows": [],
            "best_week": None,
            "worst_week": None,
            "compression_weeks": [],
            "weekly_revenue": 0.0,
            "weekly_profit": 0.0,
            "average_weekly_revenue": None,
            "average_weekly_profit": None,
            "gross_profit": None,
            "net_profit": None,
            "gross_margin_pct": None,
            "net_margin_pct": None,
            "labour_total": None,
            "labour_pct": None,
            "food_cost": None,
            "food_cost_pct": None,
            "fixed_costs": None,
            "variable_costs": None,
            "loans_hp": None,
            "vat_due": None,
            "trend_points": [],
        }

    total_revenue = sum(row["revenue_ex_vat"] for row in weekly_rows)
    total_gross_profit = sum(row["gross_profit"] for row in weekly_rows)
    total_net_profit = sum(row["net_profit"] for row in weekly_rows)
    total_labour = sum(row["labour_total"] for row in weekly_rows)
    total_food_cost = sum(row["food_cost"] for row in weekly_rows)
    total_fixed_costs = sum(_f(report.fixed_costs) for report in reports)
    total_variable_costs = sum(_f(report.variable_costs) for report in reports)
    total_loans_hp = sum(_f(report.loans_hp) for report in reports)
    total_vat_due = sum(_f(report.vat_due) for report in reports)
    n = len(weekly_rows)

    best_week = max(weekly_rows, key=lambda row: row["net_profit"])
    worst_week = min(weekly_rows, key=lambda row: row["net_profit"])

    compression_weeks: list[dict] = []
    sorted_rows = sorted(weekly_rows, key=lambda row: row["period"])
    for prev, current in zip(sorted_rows, sorted_rows[1:]):
        if prev["gross_margin_pct"] is None or current["gross_margin_pct"] is None:
            continue
        delta_margin = current["gross_margin_pct"] - prev["gross_margin_pct"]
        if delta_margin <= -0.03 or current["net_margin_pct"] <= prev["net_margin_pct"] - 0.03:
            compression_weeks.append(
                {
                    "period": current["period"],
                    "label": current["label"],
                    "gross_margin_pct": current["gross_margin_pct"],
                    "net_margin_pct": current["net_margin_pct"],
                    "previous_gross_margin_pct": prev["gross_margin_pct"],
                    "previous_net_margin_pct": prev["net_margin_pct"],
                }
            )

    week_highlights = sorted(
        ((row["period"], row) for row in weekly_rows),
        key=lambda item: item[1]["revenue_ex_vat"],
        reverse=True,
    )

    trend_points = [
        {
            "period": row["period"],
            "label": row["label"],
            "revenue_ex_vat": row["revenue_ex_vat"],
            "revenue_inc_vat": row["revenue_inc_vat"],
            "gross_profit": row["gross_profit"],
            "net_profit": row["net_profit"],
            "gross_margin_pct": row["gross_margin_pct"],
            "net_margin_pct": row["net_margin_pct"],
            "labour_pct": row["labour_pct"],
            "food_cost_pct": row["food_cost_pct"],
            "invoice_count": row["invoice_count"],
        }
        for row in sorted_rows
    ]

    return {
        "rows": weekly_rows,
        "best_week": best_week,
        "worst_week": worst_week,
        "compression_weeks": compression_weeks,
        "weekly_revenue": round(total_revenue, 2),
        "weekly_profit": round(total_net_profit, 2),
        "average_weekly_revenue": round(total_revenue / n, 2) if n else None,
        "average_weekly_profit": round(total_net_profit / n, 2) if n else None,
        "gross_profit": round(total_gross_profit, 2),
        "net_profit": round(total_net_profit, 2),
        "gross_margin_pct": round(total_gross_profit / total_revenue, 4) if total_revenue > 0 else None,
        "net_margin_pct": round(total_net_profit / total_revenue, 4) if total_revenue > 0 else None,
        "labour_total": round(total_labour, 2),
        "labour_pct": round(total_labour / total_revenue, 4) if total_revenue > 0 else None,
        "food_cost": round(total_food_cost, 2),
        "food_cost_pct": round(total_food_cost / total_revenue, 4) if total_revenue > 0 else None,
        "fixed_costs": round(total_fixed_costs, 2),
        "variable_costs": round(total_variable_costs, 2),
        "loans_hp": round(total_loans_hp, 2),
        "vat_due": round(total_vat_due, 2),
        "week_highlights": week_highlights,
        "trend_points": trend_points,
    }


def _aggregate_purchases(purchase_rows: list[tuple[PurchaseInvoice, PurchaseInvoiceLine]]) -> dict:
    category_lookup: dict[str, dict] = defaultdict(lambda: {"value": 0.0, "item_count": 0})
    supplier_lookup: dict[str, dict] = defaultdict(lambda: {"value": 0.0, "item_count": 0})
    total_spend_ex_vat = 0.0
    total_spend_inc_vat = 0.0

    for invoice, line in purchase_rows:
        spend_ex = _f(line.line_total_ex_vat)
        spend_inc = _f(line.line_total_inc_vat)
        total_spend_ex_vat += spend_ex
        total_spend_inc_vat += spend_inc

        category = str(line.category or "Uncategorised")
        supplier = str(invoice.supplier_name or "Unknown supplier")

        category_row = category_lookup[category]
        category_row["value"] += spend_ex
        category_row["item_count"] += 1

        supplier_row = supplier_lookup[supplier]
        supplier_row["value"] += spend_ex
        supplier_row["item_count"] += 1

    category_rows = [
        {
            "rank": idx,
            "label": label,
            "value": round(row["value"], 2),
            "share": 0.0,
            "item_count": row["item_count"],
            "source": "purchase_invoices",
        }
        for idx, (label, row) in enumerate(sorted(category_lookup.items(), key=lambda item: item[1]["value"], reverse=True)[:8], start=1)
    ]

    supplier_rows = [
        {
            "rank": idx,
            "label": label,
            "value": round(row["value"], 2),
            "share": 0.0,
            "item_count": row["item_count"],
            "source": "purchase_invoices",
        }
        for idx, (label, row) in enumerate(sorted(supplier_lookup.items(), key=lambda item: item[1]["value"], reverse=True)[:8], start=1)
    ]

    total_category_value = total_spend_ex_vat
    total_supplier_value = total_spend_ex_vat

    for row in category_rows:
        row["share"] = round(row["value"] / total_category_value, 4) if total_category_value > 0 else 0.0
    for row in supplier_rows:
        row["share"] = round(row["value"] / total_supplier_value, 4) if total_supplier_value > 0 else 0.0

    return {
        "purchase_invoice_count": len({invoice.id for invoice, _line in purchase_rows}),
        "purchase_line_count": len(purchase_rows),
        "total_spend_ex_vat": round(total_spend_ex_vat, 2),
        "total_spend_inc_vat": round(total_spend_inc_vat, 2),
        "category_rows": category_rows,
        "supplier_rows": supplier_rows,
        "top_category": category_rows[0] if category_rows else None,
        "top_supplier": supplier_rows[0] if supplier_rows else None,
    }


def _build_period_highlight(
    *,
    key: str,
    kind: str,
    direction: str,
    bucket_start: date,
    revenue_ex_vat: float,
    revenue_inc_vat: float = 0.0,
    gross_profit: float | None = None,
    net_profit: float | None = None,
    gross_margin_pct: float | None = None,
    net_margin_pct: float | None = None,
) -> dict:
    label = _fmt_date(bucket_start)
    if kind == "week":
        label = f"Week ending {_fmt_date(bucket_start)}"
    elif kind == "month":
        label = bucket_start.strftime("%b %Y")

    return {
        "key": key,
        "kind": kind,
        "direction": direction,
        "label": label,
        "start_date": bucket_start,
        "end_date": bucket_start,
        "revenue_ex_vat": round(revenue_ex_vat, 2),
        "gross_profit": round(gross_profit, 2) if gross_profit is not None else None,
        "net_profit": round(net_profit, 2) if net_profit is not None else None,
        "gross_margin_pct": round(gross_margin_pct, 4) if gross_margin_pct is not None else None,
        "net_margin_pct": round(net_margin_pct, 4) if net_margin_pct is not None else None,
    }


def _build_kpis(
    *,
    summary: dict,
    previous_summary: dict,
) -> list[dict]:
    items = [
        ("revenue_ex_vat", "Revenue", "currency"),
        ("gross_profit", "Gross Profit", "currency"),
        ("net_profit", "Net Profit", "currency"),
        ("gross_margin_pct", "Gross Margin", "percent"),
        ("net_margin_pct", "Net Margin", "percent"),
        ("labour_pct", "Labour", "percent"),
        ("food_cost_pct", "Food Cost", "percent"),
        ("average_weekly_revenue", "Average Weekly Revenue", "currency"),
        ("average_weekly_profit", "Average Weekly Profit", "currency"),
        ("average_order_value", "Average Order Value", "currency"),
        ("ledger_revenue_ex_vat", "Ledger Revenue", "currency"),
        ("annualized_revenue_ex_vat", "Projected Annual Revenue", "currency"),
        ("annualized_net_profit", "Projected Annual Net Profit", "currency"),
    ]

    kpis: list[dict] = []
    for key, label, unit in items:
        current = summary.get(key)
        previous = previous_summary.get(key)
        delta = None
        delta_pct = None
        if current is not None and previous is not None:
            delta = _f(current) - _f(previous)
            if abs(_f(previous)) > 1e-9:
                delta_pct = delta / abs(_f(previous))
        kpis.append(
            {
                "key": key,
                "label": label,
                "value": current,
                "previous_value": previous,
                "delta": delta,
                "delta_pct": delta_pct,
                "unit": unit,
                "source": "analytics",
                "available": current is not None,
            }
        )
    return kpis


def _build_insights(
    *,
    period: AnalyticsPeriodResponse,
    current_summary: dict,
    previous_summary: dict,
    current_sales: dict,
    previous_sales: dict,
    current_weekly: dict,
    previous_weekly: dict,
    current_purchases: dict,
    previous_purchases: dict,
) -> list[dict]:
    insights: list[dict] = []

    labour_pct = current_summary.get("labour_pct")
    if labour_pct is not None and labour_pct > LABOUR_ALERT_THRESHOLD:
        insights.append(
            {
                "key": "labour-above-target",
                "severity": "critical",
                "title": "Labour above target",
                "summary": (
                    f"Labour is {labour_pct * 100:.1f}% of revenue, above the {LABOUR_ALERT_THRESHOLD * 100:.0f}% threshold."
                ),
                "why_it_matters": "Labour is one of the fastest ways margin gets compressed when rota coverage drifts above demand.",
                "recommended_action": "Trim rota overlap on slower days and review shift coverage against weekly revenue peaks.",
                "evidence": [
                    f"Labour total: {current_summary.get('labour_total', 0):,.2f}",
                    f"Revenue ex VAT: {current_summary.get('revenue_ex_vat', 0):,.2f}",
                ],
            }
        )

    food_cost_pct = current_summary.get("food_cost_pct")
    if food_cost_pct is not None and food_cost_pct > FOOD_COST_ALERT_THRESHOLD:
        insights.append(
            {
                "key": "food-cost-above-target",
                "severity": "critical",
                "title": "Food cost above target",
                "summary": (
                    f"Food cost is {food_cost_pct * 100:.1f}% of revenue, above the {FOOD_COST_ALERT_THRESHOLD * 100:.0f}% target."
                ),
                "why_it_matters": "When food cost rises, gross margin narrows before labour and overhead are even considered.",
                "recommended_action": "Review portion control, supplier pricing, and the highest-cost purchase categories first.",
                "evidence": [
                    f"Food cost: {current_summary.get('food_cost', 0):,.2f}",
                    f"Revenue ex VAT: {current_summary.get('revenue_ex_vat', 0):,.2f}",
                ],
            }
        )

    revenue_delta_pct = None
    if current_summary.get("revenue_ex_vat") is not None and previous_summary.get("revenue_ex_vat") not in (None, 0):
        revenue_delta_pct = (_f(current_summary["revenue_ex_vat"]) - _f(previous_summary["revenue_ex_vat"])) / abs(_f(previous_summary["revenue_ex_vat"]))

    if revenue_delta_pct is not None and revenue_delta_pct < -0.05:
        insights.append(
            {
                "key": "revenue-below-previous-period",
                "severity": "warning",
                "title": "Revenue is below the previous period",
                "summary": f"Revenue is down {abs(revenue_delta_pct) * 100:.1f}% versus the previous equivalent period.",
                "why_it_matters": "Lower top-line sales reduce the amount of fixed cost coverage available to protect profit.",
                "recommended_action": "Check whether the drop is driven by fewer invoices, smaller baskets, or fewer high-value products.",
                "evidence": [
                    f"Current revenue: {current_summary.get('revenue_ex_vat', 0):,.2f}",
                    f"Previous revenue: {previous_summary.get('revenue_ex_vat', 0):,.2f}",
                ],
            }
        )

    net_margin_pct = current_summary.get("net_margin_pct")
    previous_net_margin_pct = previous_summary.get("net_margin_pct")
    if net_margin_pct is not None and previous_net_margin_pct is not None and net_margin_pct < previous_net_margin_pct - 0.02:
        insights.append(
            {
                "key": "margin-weakening",
                "severity": "warning",
                "title": "Margin weakened versus the previous period",
                "summary": (
                    f"Net margin is down from {previous_net_margin_pct * 100:.1f}% to {net_margin_pct * 100:.1f}%."
                ),
                "why_it_matters": "Margin pressure is the clearest sign that sales growth is not converting efficiently into profit.",
                "recommended_action": "Check labour, food cost, and product mix before chasing more revenue.",
                "evidence": [
                    f"Gross margin: {current_summary.get('gross_margin_pct', 0) * 100:.1f}%",
                    f"Net margin: {net_margin_pct * 100:.1f}%",
                ],
            }
        )

    top_product = current_sales.get("product_rows", [])
    if top_product:
        leader = top_product[0]
        if leader.get("estimated_recipe_margin_pct") is not None and leader.get("revenue_share", 0) >= 0.12 and leader["estimated_recipe_margin_pct"] < 0.20:
            insights.append(
                {
                    "key": "top-product-weak-margin",
                    "severity": "warning",
                    "title": "Best-selling product has weak margin",
                    "summary": (
                        f"{leader['item_name']} drives {leader['revenue_share'] * 100:.1f}% of sales, but the matched recipe margin is only {leader['estimated_recipe_margin_pct'] * 100:.1f}%."
                    ),
                    "why_it_matters": "A high-volume item with poor unit economics can quietly drag the whole business down.",
                    "recommended_action": "Review recipe pricing, portion control, or supplier cost on this item first.",
                    "evidence": [
                        f"Estimated gross profit per unit: {leader.get('estimated_recipe_gross_profit') or 0:,.2f}",
                        f"Quantity sold: {leader.get('quantity_sold', 0):,.0f}",
                    ],
                }
            )

    weekly_rows = current_weekly.get("rows", [])
    if weekly_rows:
        worst_week = current_weekly.get("worst_week")
        if worst_week and worst_week.get("net_margin_pct") is not None and worst_week["net_margin_pct"] < NET_MARGIN_ALERT_THRESHOLD:
            insights.append(
                {
                    "key": "weakest-week-low-margin",
                    "severity": "warning",
                    "title": "A week in the period fell below healthy margin",
                    "summary": (
                        f"The weakest week closed at {worst_week['net_margin_pct'] * 100:.1f}% net margin and {worst_week['net_profit']:,.2f} net profit."
                    ),
                    "why_it_matters": "One weak week can indicate a labour spike, food waste issue, or a bad product mix.",
                    "recommended_action": "Inspect that week’s top revenue days, rota, and purchase activity for the margin leak.",
                    "evidence": [
                        f"Week ending: {worst_week['label']}",
                        f"Revenue ex VAT: {worst_week['revenue_ex_vat']:,.2f}",
                    ],
                }
            )

        compression_weeks = current_weekly.get("compression_weeks", [])
        if compression_weeks:
            item = compression_weeks[-1]
            insights.append(
                {
                    "key": "margin-compression-week",
                    "severity": "warning",
                    "title": "Margin compression is visible",
                    "summary": (
                        f"{item['label']} saw gross margin fall from {item['previous_gross_margin_pct'] * 100:.1f}% to {item['gross_margin_pct'] * 100:.1f}%."
                    ),
                    "why_it_matters": "Compression usually means more labour, food waste, or purchasing pressure than the sales line can absorb.",
                    "recommended_action": "Compare the compressed week to a healthy week and isolate the cost line that moved most.",
                    "evidence": [
                        f"Previous net margin: {item['previous_net_margin_pct'] * 100:.1f}%",
                        f"Current net margin: {item['net_margin_pct'] * 100:.1f}%",
                    ],
                }
            )

    top_category = current_purchases.get("top_category")
    previous_top_category = previous_purchases.get("top_category")
    if top_category and previous_top_category:
        previous_value = previous_top_category["value"]
        if previous_value > 0:
            delta_pct = (top_category["value"] - previous_value) / previous_value
            if delta_pct > 0.10 and top_category["share"] >= 0.30:
                insights.append(
                    {
                        "key": "cost-category-erosion",
                        "severity": "warning",
                        "title": "One cost category is eroding profit",
                        "summary": (
                            f"{top_category['label']} is {delta_pct * 100:.1f}% higher than the previous period and now represents {top_category['share'] * 100:.1f}% of purchase spend."
                        ),
                        "why_it_matters": "A concentrated cost spike can pull gross margin down even if sales are stable.",
                        "recommended_action": "Check supplier pricing, usage, and whether the category is being over-ordered or wasted.",
                        "evidence": [
                            f"Current spend: {top_category['value']:,.2f}",
                            f"Previous spend: {previous_value:,.2f}",
                        ],
                    }
                )

    if not insights:
        insights.append(
            {
                "key": "healthy-period",
                "severity": "success",
                "title": "No major margin leak detected",
                "summary": "The selected period is broadly stable across revenue and cost signals.",
                "why_it_matters": "Stable periods are useful baselines for spotting the next operational shift early.",
                "recommended_action": "Keep tracking weekly changes so a future spike in labour, food cost, or revenue weakness shows up quickly.",
                "evidence": [
                    f"Weekly reports reviewed: {current_summary.get('weekly_report_count', 0)}",
                    f"Sales invoices reviewed: {current_summary.get('sales_invoice_count', 0)}",
                ],
            }
        )

    return insights[:8]


def get_company_analytics(
    db: Session,
    *,
    tenant_id: UUID,
    company_id: UUID,
    period_key: str = "last-4-weeks",
    start_date: date | None = None,
    end_date: date | None = None,
) -> CompanyAnalyticsResponse:
    company = _load_company(db, tenant_id, company_id)
    period = _resolve_period(period_key, start_date=start_date, end_date=end_date)

    current_reports, current_metrics = _load_weekly_reports(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        start_date=period.start_date,
        end_date=period.end_date,
    )
    previous_reports, previous_metrics = _load_weekly_reports(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        start_date=period.comparison_start_date,
        end_date=period.comparison_end_date,
    )

    current_sales_invoices, current_sales_items = _load_sales_rows(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        start_date=period.start_date,
        end_date=period.end_date,
    )
    previous_sales_invoices, previous_sales_items = _load_sales_rows(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        start_date=period.comparison_start_date,
        end_date=period.comparison_end_date,
    )

    current_purchases = _load_purchase_rows(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        start_date=period.start_date,
        end_date=period.end_date,
    )
    previous_purchases = _load_purchase_rows(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        start_date=period.comparison_start_date,
        end_date=period.comparison_end_date,
    )

    recipe_lookup = _build_recipe_lookup(db, tenant_id=tenant_id, company_id=company_id)
    recipe_data = list_recipes(db, tenant_id=tenant_id, company_id=company_id)

    current_sales = _aggregate_sales(current_sales_invoices, current_sales_items, recipe_lookup)
    previous_sales = _aggregate_sales(previous_sales_invoices, previous_sales_items, recipe_lookup)
    current_weekly = _aggregate_weekly_reports(current_reports, current_metrics)
    previous_weekly = _aggregate_weekly_reports(previous_reports, previous_metrics)
    current_purchase = _aggregate_purchases(current_purchases)
    previous_purchase = _aggregate_purchases(previous_purchases)

    report_count = len(current_reports)
    revenue_ex_vat = current_weekly["weekly_revenue"] if report_count else current_sales["revenue_ex_vat"]
    revenue_inc_vat = sum(_f(report.sales_inc_vat) for report in current_reports) if report_count else current_sales["revenue_inc_vat"]
    gross_profit = current_weekly["gross_profit"] if report_count else None
    net_profit = current_weekly["net_profit"] if report_count else None
    labour_total = current_weekly["labour_total"] if report_count else None
    food_cost = current_weekly["food_cost"] if report_count else None
    fixed_costs = sum(_f(report.fixed_costs) for report in current_reports) if report_count else None
    variable_costs = sum(_f(report.variable_costs) for report in current_reports) if report_count else None
    loans_hp = sum(_f(report.loans_hp) for report in current_reports) if report_count else None
    vat_due = sum(_f(report.vat_due) for report in current_reports) if report_count else None

    gross_margin_pct = current_weekly["gross_margin_pct"] if report_count else None
    net_margin_pct = current_weekly["net_margin_pct"] if report_count else None
    labour_pct = current_weekly["labour_pct"] if report_count else None
    food_cost_pct = current_weekly["food_cost_pct"] if report_count else None

    average_weekly_revenue = current_weekly["average_weekly_revenue"] if report_count else None
    average_weekly_profit = current_weekly["average_weekly_profit"] if report_count else None

    period_days = period.total_days
    annualized_revenue = revenue_ex_vat / period_days * 365 if revenue_ex_vat and period_days else None
    annualized_gross_profit = gross_profit / period_days * 365 if gross_profit is not None and period_days else None
    annualized_net_profit = net_profit / period_days * 365 if net_profit is not None and period_days else None
    annualized_gross_margin_pct = annualized_gross_profit / annualized_revenue if annualized_gross_profit is not None and annualized_revenue else None
    annualized_net_margin_pct = annualized_net_profit / annualized_revenue if annualized_net_profit is not None and annualized_revenue else None

    summary = {
        "weekly_report_count": len(current_reports),
        "sales_invoice_count": len(current_sales_invoices),
        "sales_item_count": len(current_sales_items),
        "purchase_invoice_count": current_purchase["purchase_invoice_count"],
        "purchase_line_count": current_purchase["purchase_line_count"],
        "matched_product_count": current_sales["matched_product_count"],
        "revenue_ex_vat": round(revenue_ex_vat, 2) if revenue_ex_vat is not None else None,
        "revenue_inc_vat": round(revenue_inc_vat, 2) if revenue_inc_vat is not None else None,
        "ledger_revenue_ex_vat": round(current_sales["revenue_ex_vat"], 2),
        "ledger_revenue_inc_vat": round(current_sales["revenue_inc_vat"], 2),
        "gross_profit": round(gross_profit, 2) if gross_profit is not None else None,
        "net_profit": round(net_profit, 2) if net_profit is not None else None,
        "gross_margin_pct": round(gross_margin_pct, 4) if gross_margin_pct is not None else None,
        "net_margin_pct": round(net_margin_pct, 4) if net_margin_pct is not None else None,
        "labour_total": round(labour_total, 2) if labour_total is not None else None,
        "labour_pct": round(labour_pct, 4) if labour_pct is not None else None,
        "food_cost": round(food_cost, 2) if food_cost is not None else None,
        "food_cost_pct": round(food_cost_pct, 4) if food_cost_pct is not None else None,
        "fixed_costs": round(fixed_costs, 2) if fixed_costs is not None else None,
        "variable_costs": round(variable_costs, 2) if variable_costs is not None else None,
        "loans_hp": round(loans_hp, 2) if loans_hp is not None else None,
        "vat_due": round(vat_due, 2) if vat_due is not None else None,
        "average_weekly_revenue": average_weekly_revenue,
        "average_weekly_profit": average_weekly_profit,
        "average_order_value": current_sales["average_order_value"],
        "active_customers": current_sales["active_customers"],
        "annualized_revenue_ex_vat": round(annualized_revenue, 2) if annualized_revenue is not None else None,
        "annualized_gross_profit": round(annualized_gross_profit, 2) if annualized_gross_profit is not None else None,
        "annualized_net_profit": round(annualized_net_profit, 2) if annualized_net_profit is not None else None,
        "annualized_gross_margin_pct": round(annualized_gross_margin_pct, 4) if annualized_gross_margin_pct is not None else None,
        "annualized_net_margin_pct": round(annualized_net_margin_pct, 4) if annualized_net_margin_pct is not None else None,
    }

    kpis = _build_kpis(summary=summary, previous_summary={
        "revenue_ex_vat": previous_weekly["weekly_revenue"] if previous_reports else previous_sales["revenue_ex_vat"],
        "gross_profit": previous_weekly["gross_profit"],
        "net_profit": previous_weekly["net_profit"],
        "gross_margin_pct": previous_weekly["gross_margin_pct"],
        "net_margin_pct": previous_weekly["net_margin_pct"],
        "labour_pct": previous_weekly["labour_pct"],
        "food_cost_pct": previous_weekly["food_cost_pct"],
        "average_weekly_revenue": previous_weekly["average_weekly_revenue"],
        "average_weekly_profit": previous_weekly["average_weekly_profit"],
        "average_order_value": previous_sales["average_order_value"],
        "ledger_revenue_ex_vat": previous_sales["revenue_ex_vat"],
        "annualized_revenue_ex_vat": None,
        "annualized_net_profit": None,
    })

    highlights: list[dict] = []

    if current_sales["day_highlights"]:
        best_day = current_sales["day_highlights"][0]
        worst_day = current_sales["day_highlights"][-1]
        highlights.append(
            _build_period_highlight(
                key="best-day",
                kind="day",
                direction="best",
                bucket_start=best_day[0],
                revenue_ex_vat=best_day[1]["revenue_ex_vat"],
                revenue_inc_vat=best_day[1]["revenue_inc_vat"],
            )
        )
        highlights.append(
            _build_period_highlight(
                key="weakest-day",
                kind="day",
                direction="worst",
                bucket_start=worst_day[0],
                revenue_ex_vat=worst_day[1]["revenue_ex_vat"],
                revenue_inc_vat=worst_day[1]["revenue_inc_vat"],
            )
        )

    if current_weekly["week_highlights"]:
        best_week = current_weekly["week_highlights"][0]
        worst_week = current_weekly["week_highlights"][-1]
        highlights.append(
            _build_period_highlight(
                key="best-week",
                kind="week",
                direction="best",
                bucket_start=best_week[0],
                revenue_ex_vat=best_week[1]["revenue_ex_vat"],
                revenue_inc_vat=best_week[1]["revenue_inc_vat"],
                gross_profit=best_week[1]["gross_profit"],
                net_profit=best_week[1]["net_profit"],
                gross_margin_pct=best_week[1]["gross_margin_pct"],
                net_margin_pct=best_week[1]["net_margin_pct"],
            )
        )
        highlights.append(
            _build_period_highlight(
                key="weakest-week",
                kind="week",
                direction="worst",
                bucket_start=worst_week[0],
                revenue_ex_vat=worst_week[1]["revenue_ex_vat"],
                revenue_inc_vat=worst_week[1]["revenue_inc_vat"],
                gross_profit=worst_week[1]["gross_profit"],
                net_profit=worst_week[1]["net_profit"],
                gross_margin_pct=worst_week[1]["gross_margin_pct"],
                net_margin_pct=worst_week[1]["net_margin_pct"],
            )
        )

    if current_sales["month_highlights"]:
        best_month = current_sales["month_highlights"][0]
        worst_month = current_sales["month_highlights"][-1]
        highlights.append(
            _build_period_highlight(
                key="best-month",
                kind="month",
                direction="best",
                bucket_start=best_month[0],
                revenue_ex_vat=best_month[1]["revenue_ex_vat"],
                revenue_inc_vat=best_month[1]["revenue_inc_vat"],
            )
        )
        highlights.append(
            _build_period_highlight(
                key="weakest-month",
                kind="month",
                direction="worst",
                bucket_start=worst_month[0],
                revenue_ex_vat=worst_month[1]["revenue_ex_vat"],
                revenue_inc_vat=worst_month[1]["revenue_inc_vat"],
            )
        )

    insights = _build_insights(
        period=period,
        current_summary=summary,
        previous_summary={
            "revenue_ex_vat": previous_weekly["weekly_revenue"] if previous_reports else previous_sales["revenue_ex_vat"],
            "net_margin_pct": previous_weekly["net_margin_pct"],
            "gross_margin_pct": previous_weekly["gross_margin_pct"],
            "labour_pct": previous_weekly["labour_pct"],
            "food_cost_pct": previous_weekly["food_cost_pct"],
            "labour_total": previous_weekly["labour_total"],
            "food_cost": previous_weekly["food_cost"],
        },
        current_sales=current_sales,
        previous_sales=previous_sales,
        current_weekly=current_weekly,
        previous_weekly=previous_weekly,
        current_purchases=current_purchase,
        previous_purchases=previous_purchase,
    )

    coverage = {
        "weekly_reports": len(current_reports),
        "sales_invoices": len(current_sales_invoices),
        "sales_items": len(current_sales_items),
        "purchase_invoices": current_purchase["purchase_invoice_count"],
        "purchase_lines": current_purchase["purchase_line_count"],
        "recipes": len(recipe_data.get("recipes", [])),
        "matched_products": current_sales["matched_product_count"],
    }

    return CompanyAnalyticsResponse(
        company_id=company.id,
        company_name=company.name,
        period=period,
        summary=AnalyticsSummaryResponse(**summary),
        kpis=[AnalyticsMetricResponse(**item) for item in kpis],
        sales_trend=[AnalyticsTrendPointResponse(**row) for row in (current_sales["daily_rows"] if period.granularity == "day" else current_sales["weekly_rows"] if period.granularity == "week" else current_sales["monthly_rows"])],
        weekly_trend=[AnalyticsTrendPointResponse(**row) for row in current_weekly["trend_points"]],
        highlights=[AnalyticsHighlightResponse(**row) for row in highlights],
        top_products=[AnalyticsProductResponse(**row) for row in current_sales["product_rows"]],
        top_revenue_categories=[AnalyticsCategoryResponse(**row) for row in current_sales["category_rows"]],
        top_cost_categories=[AnalyticsCategoryResponse(**row) for row in current_purchase["category_rows"]],
        top_suppliers=[AnalyticsCategoryResponse(**row) for row in current_purchase["supplier_rows"]],
        insights=[AnalyticsInsightResponse(**row) for row in insights],
        coverage=AnalyticsCoverageResponse(**coverage),
    )
