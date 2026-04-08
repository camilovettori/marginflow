from __future__ import annotations

from typing import List
from uuid import UUID

from pydantic import BaseModel, Field


class UnifyZohoSyncResponse(BaseModel):
    success: bool
    company_id: UUID
    products_loaded: int
    orders_fetched: int
    buyer_groups: int
    invoices_created: int
    duplicates_skipped: int
    contacts_created: int
    contacts_reused: int
    items_created: int
    items_reused: int
    line_items_created: int
    logs: List[str] = Field(default_factory=list)
