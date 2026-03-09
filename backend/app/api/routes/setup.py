from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import engine

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/db")
def db_ping():
    with engine.connect() as conn:
        v = conn.execute(text("select 1")).scalar_one()
    return {"db": v}