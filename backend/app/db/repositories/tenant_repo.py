from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.tenant import Tenant


def create_tenant(db: Session, name: str, slug: str) -> Tenant:
    t = Tenant(name=name, slug=slug)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def list_tenants(db: Session) -> list[Tenant]:
    return db.query(Tenant).order_by(Tenant.created_at.desc()).all()


def get_tenant(db: Session, tenant_id) -> Tenant | None:
    return db.query(Tenant).filter(Tenant.id == tenant_id).first()