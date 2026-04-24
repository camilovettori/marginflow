from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.schemas.pdf_extract import PdfExtractResponse
from app.schemas.purchase_invoice import (
    PurchaseInvoiceCreate,
    PurchaseInvoiceListResponse,
    PurchaseInvoiceResponse,
    PurchaseInvoiceUpdate,
)
from app.services.purchase_invoices_service import (
    create_purchase_invoice,
    delete_purchase_invoice,
    get_purchase_invoice,
    list_purchase_invoices,
    update_purchase_invoice,
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


@router.put("/purchase-invoices/{invoice_id}", response_model=PurchaseInvoiceResponse)
def update_company_purchase_invoice(
    invoice_id: UUID,
    payload: PurchaseInvoiceUpdate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return update_purchase_invoice(
        db,
        tenant_id=tenant_id,
        invoice_id=invoice_id,
        payload=payload,
    )


@router.post("/{company_id}/purchase-invoices/upload", response_model=PdfExtractResponse)
async def upload_purchase_invoice_pdf(
    company_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    """
    Extract invoice data from a supplier PDF for form pre-fill.
    Does NOT save the invoice — the client must submit the form to save.
    """
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    if "pdf" not in content_type and not filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    try:
        pdf_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {exc}")

    if len(pdf_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large. Maximum size is 20 MB.")

    from app.services.pdf_invoice_parser import extract_invoice_from_pdf

    result = extract_invoice_from_pdf(pdf_bytes)
    return PdfExtractResponse(**result)


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


@router.delete("/purchase-invoices/{invoice_id}")
def delete_company_purchase_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return delete_purchase_invoice(
        db,
        tenant_id=tenant_id,
        invoice_id=invoice_id,
    )
