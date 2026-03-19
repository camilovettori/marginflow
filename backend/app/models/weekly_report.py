from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WeeklyReport(Base):
    """
    Input bruto do cliente (o que ele preenche semanalmente).
    Tudo aqui é 'source of truth' para métricas, alertas e relatórios.
    """

    __tablename__ = "weekly_reports"

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

    week_ending: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")

    # ===== SALES =====
    sales_inc_vat: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sales_ex_vat: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    # ===== COSTS =====
    wages: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    holiday_pay: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    food_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    fixed_costs: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    variable_costs: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    loans_hp: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    # ===== VAT / TAX (opcional por enquanto) =====
    vat_due: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company")
    tenant = relationship("Tenant")

    metrics = relationship(
        "WeeklyMetrics",
        back_populates="report",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )

    __table_args__ = (
        # Um report por semana por company dentro do tenant
        UniqueConstraint("tenant_id", "company_id", "week_ending", name="uq_weekly_reports_tenant_company_week"),
        # Índice para leitura rápida de timeline (SaaS real)
        Index("ix_weekly_reports_tenant_company_week_desc", "tenant_id", "company_id", "week_ending"),
    )

from sqlalchemy.orm import relationship

# ...

