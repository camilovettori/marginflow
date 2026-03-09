# backend/app/db/session.py

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import DATABASE_URL

# Engine (Postgres/Neon)
# Neon normalmente funciona melhor com NullPool (evita conexões presas no dev)
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    future=True,
)

# Session factory
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    future=True,
)

def get_db():
    """
    Dependency do FastAPI:
    injeta uma Session e garante close no final da request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()