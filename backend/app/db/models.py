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
from app.models.ingredient import Ingredient  # noqa: F401
from app.models.purchase_invoice import PurchaseInvoice  # noqa: F401
from app.models.purchase_invoice_line import PurchaseInvoiceLine  # noqa: F401
from app.models.recipe import Recipe  # noqa: F401
from app.models.recipe_ingredient import RecipeIngredient  # noqa: F401
