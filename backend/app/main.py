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

app = FastAPI(title=f"{APP_NAME} API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.195:3000",
        "https://marginflow-finance.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(setup_router)
app.include_router(weekly_report_router)
app.include_router(dashboard_router)
app.include_router(auth_router)
app.include_router(tenants_router)
app.include_router(companies_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}