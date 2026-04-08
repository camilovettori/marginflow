# backend/app/db/models.py
# Arquivo só para registrar models no metadata

from app.models.tenant import Tenant  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.company import Company  # noqa: F401
from app.models.weekly_report import WeeklyReport  # noqa: F401
from app.models.weekly_metrics import WeeklyMetrics  # noqa: F401
from app.models.tenant_user import TenantUser  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.models.zoho_connection import ZohoConnection  # noqa: F401
from app.models.zoho_sales_invoice import ZohoSalesInvoice  # noqa: F401
from app.models.zoho_sales_invoice_item import ZohoSalesInvoiceItem  # noqa: F401
