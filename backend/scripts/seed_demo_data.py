from datetime import date, timedelta
import random
from uuid import uuid4

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.weekly_report import WeeklyReport

TENANT_ID = "ee8c5e98-427b-4ddc-9d02-9b797caf4447"

LOVIN_ID = "90438872-13f2-4f88-adb7-34188f9a7de1"
CAMERINO_ID = "a9ef1809-a5c8-42b4-82d9-de9265aab68d"

WEEKS = 12


def generate_sales(base: int) -> int:
    return base + random.randint(-200, 300)


def report_exists(db, company_id: str, week_ending: date) -> bool:
    stmt = (
        select(WeeklyReport)
        .where(WeeklyReport.tenant_id == TENANT_ID)
        .where(WeeklyReport.company_id == company_id)
        .where(WeeklyReport.week_ending == week_ending)
    )
    return db.execute(stmt).scalar_one_or_none() is not None


def seed_company(db, company_id: str, base_sales: int):
    today = date.today()
    created = 0
    skipped = 0

    for i in range(WEEKS):
        week_ending = today - timedelta(days=7 * i)

        if report_exists(db, company_id, week_ending):
            skipped += 1
            continue

        sales_inc_vat = generate_sales(base_sales)
        sales_ex_vat = sales_inc_vat / 1.135

        wages = sales_ex_vat * random.uniform(0.40, 0.55)
        food_cost = sales_ex_vat * random.uniform(0.18, 0.30)

        report = WeeklyReport(
            id=uuid4(),
            tenant_id=TENANT_ID,
            company_id=company_id,
            week_ending=week_ending,
            currency="EUR",
            sales_inc_vat=sales_inc_vat,
            sales_ex_vat=sales_ex_vat,
            wages=wages,
            holiday_pay=0,
            food_cost=food_cost,
            fixed_costs=0,
            variable_costs=0,
            loans_hp=0,
            vat_due=0,
            notes="demo data",
        )

        db.add(report)
        created += 1

    db.commit()
    return created, skipped


def main():
    db = SessionLocal()

    lovin_created, lovin_skipped = seed_company(db, LOVIN_ID, 1200)
    camerino_created, camerino_skipped = seed_company(db, CAMERINO_ID, 2500)

    db.close()

    print("Seed finished")
    print(f"Lovin     -> created: {lovin_created}, skipped: {lovin_skipped}")
    print(f"Camerino  -> created: {camerino_created}, skipped: {camerino_skipped}")


if __name__ == "__main__":
    main()