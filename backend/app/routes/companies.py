from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.services.financial_categories_service import ensure_default_financial_categories

router = APIRouter(prefix="/api/companies", tags=["Companies"])


@router.post("/", response_model=CompanyResponse)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    exists = (
        db.query(Company)
        .filter(Company.tenant_id == tenant_id, Company.slug == payload.slug)
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="slug já existe para este tenant")

    ensure_default_financial_categories(db, tenant_id)

    c = Company(
        tenant_id=tenant_id,
        name=payload.name,
        slug=payload.slug,
        address=payload.address,
        contact_name=payload.contact_name,
        phone=payload.phone,
        email=payload.email,
        sales_source=payload.sales_source or "manual",
        square_location_id=payload.square_location_id,
        zoho_org_id=payload.zoho_org_id,
        integration_notes=payload.integration_notes,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/", response_model=list[CompanyResponse])
def list_companies(
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return (
        db.query(Company)
        .filter(Company.tenant_id == tenant_id)
        .order_by(Company.created_at.desc())
        .all()
    )


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    c = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    return c


@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: UUID,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    c = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")

    slug_exists = (
        db.query(Company)
        .filter(
            Company.tenant_id == tenant_id,
            Company.slug == payload.slug,
            Company.id != company_id,
        )
        .first()
    )
    if slug_exists:
        raise HTTPException(status_code=409, detail="slug já existe para este tenant")

    c.name = payload.name
    c.slug = payload.slug
    c.address = payload.address
    c.contact_name = payload.contact_name
    c.phone = payload.phone
    c.email = payload.email
    c.sales_source = payload.sales_source or "manual"
    c.square_location_id = payload.square_location_id
    c.zoho_org_id = payload.zoho_org_id
    c.integration_notes = payload.integration_notes

    db.commit()
    db.refresh(c)
    return c


@router.delete("/{company_id}")
def delete_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    c = (
        db.query(Company)
        .filter(Company.id == company_id, Company.tenant_id == tenant_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")

    db.delete(c)
    db.commit()
    return {"success": True}