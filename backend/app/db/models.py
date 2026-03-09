# backend/app/db/models.py
# Arquivo só para registrar models no metadata (Alembic/ORM)

from app.models.tenant import Tenant  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.company import Company  # noqa: F401
from app.models.weekly_report import WeeklyReport  # noqa: F401
from app.models.weekly_metrics import WeeklyMetrics  # noqa: F401