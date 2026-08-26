from fastapi import APIRouter

from app.core.config import settings
from app.db.session import check_db_connection

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    db_ok = check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "app": settings.app_name,
        "env": settings.env,
        "database": "connected" if db_ok else "unreachable",
    }
