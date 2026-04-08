from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import get_tenant_id
from app.schemas.unify_sync import UnifyZohoSyncResponse
from app.services.unify_zoho_sync_service import sync_unify_orders_to_zoho_invoices

router = APIRouter(prefix="/api/integrations/unify", tags=["Unify Sync"])


@router.post("/sync/{company_id}", response_model=UnifyZohoSyncResponse)
async def sync_unify_orders(
    company_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
):
    return await sync_unify_orders_to_zoho_invoices(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
    )
