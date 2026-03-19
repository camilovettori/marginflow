# backend/app/models/weekly_metrics.py
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WeeklyMetrics(Base):
    """
    Output calculado (derivado do WeeklyReport).
    Tabela para:
    - dashboard rápido
    - alertas
    - relatórios PDF/email
    - analytics no futuro
    """

    __tablename__ = "weekly_metrics"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    tenant_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    company_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    weekly_report_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("weekly_reports.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ===== CALCS =====
    gross_profit: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    gross_margin_pct: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, default=0)  # 0.1234 = 12.34%

    wage_pct: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    wage_pct_ex_holiday: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, default=0)

    cash_left_after_wages_food: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    projected_net_profit: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    net_margin_pct: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, default=0)

    # flags simples (base para AlertEngine)
    flag_high_wage: Mapped[bool] = mapped_column(nullable=False, default=False)
    flag_negative_profit: Mapped[bool] = mapped_column(nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships (SEM imports para evitar circular import)
    tenant = relationship("Tenant")
    company = relationship("Company")
    report = relationship(
        "WeeklyReport",
        back_populates="metrics",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "company_id", "weekly_report_id", name="uq_weekly_metrics_tenant_company_report"),
        Index("ix_weekly_metrics_tenant_company", "tenant_id", "company_id"),
    )