from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.company import Company


def create_company(db: Session, tenant_id, name: str, slug: str, currency: str = "EUR") -> Company:
    c = Company(tenant_id=tenant_id, name=name, slug=slug, currency=currency)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def list_companies(db: Session, tenant_id=None) -> list[Company]:
    q = db.query(Company)
    if tenant_id:
        q = q.filter(Company.tenant_id == tenant_id)
    return q.order_by(Company.created_at.desc()).all()


def get_company(db: Session, company_id) -> Company | None:
    return db.query(Company).filter(Company.id == company_id).first()