from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.schemas.purchase_invoice import (
    PurchaseInvoiceCreate,
    PurchaseInvoiceListResponse,
    PurchaseInvoiceResponse,
)
from app.services.purchase_invoices_service import (
    create_purchase_invoice,
    get_purchase_invoice,
    list_purchase_invoices,
)

router = APIRouter(prefix="/api/costing", tags=["Costing"])


@router.get("/{company_id}/purchase-invoices", response_model=PurchaseInvoiceListResponse)
def list_company_purchase_invoices(
    company_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return list_purchase_invoices(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
    )


@router.post("/{company_id}/purchase-invoices", response_model=PurchaseInvoiceResponse)
def create_company_purchase_invoice(
    company_id: UUID,
    payload: PurchaseInvoiceCreate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return create_purchase_invoice(
        db,
        tenant_id=tenant_id,
        company_id=company_id,
        payload=payload,
    )


@router.get("/purchase-invoices/{invoice_id}", response_model=PurchaseInvoiceResponse)
def get_company_purchase_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return get_purchase_invoice(
        db,
        tenant_id=tenant_id,
        invoice_id=invoice_id,
    )
