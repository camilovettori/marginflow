from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantResponse

router = APIRouter(prefix="/api/tenants", tags=["Tenants"])


@router.post("/", response_model=TenantResponse)
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db)):
    # valida slug unico (simples)
    exists = db.query(Tenant).filter(Tenant.slug == payload.slug).first()
    if exists:
        raise HTTPException(status_code=409, detail="slug já existe")

    t = Tenant(name=payload.name, slug=payload.slug)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.get("/", response_model=list[TenantResponse])
def list_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).order_by(Tenant.created_at.desc()).all()