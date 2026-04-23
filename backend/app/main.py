from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import APP_NAME

# Registra todos os models no metadata antes de qualquer request
import app.db.models  # noqa: F401

from app.api.routes.setup import router as setup_router
from app.routes.weekly_report import router as weekly_report_router
from app.routes.dashboard import router as dashboard_router
from app.routes.tenants import router as tenants_router
from app.routes.companies import router as companies_router
from app.routes.auth import router as auth_router
from app.api.tenant_members import router as tenant_members_router
from app.routes.zoho import router as zoho_router
from app.routes.zoho_sync import router as zoho_sync_router
from app.routes.unify_sync import router as unify_sync_router
from app.routes.sales import router as sales_router
from app.routes.financial_categories import router as financial_categories_router
from app.routes.weekly_report_items import router as weekly_report_items_router
from app.routes.purchase_invoices import router as purchase_invoices_router

app = FastAPI(title=f"{APP_NAME} API")

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.0.195:3000",
    "https://marginflow-finance.vercel.app",
    "https://www.marginflow-finance.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(setup_router)

app.include_router(auth_router)
app.include_router(tenants_router)
app.include_router(companies_router)
app.include_router(tenant_members_router)

app.include_router(weekly_report_router)
app.include_router(dashboard_router)
app.include_router(sales_router)
app.include_router(unify_sync_router)
app.include_router(financial_categories_router)
app.include_router(weekly_report_items_router)
app.include_router(purchase_invoices_router)

# Integrations
app.include_router(zoho_router)
app.include_router(zoho_sync_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
