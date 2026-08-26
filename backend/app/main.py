import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import (
    audit,
    auth,
    automation,
    branches,
    checkin,
    create_gym,
    dashboards,
    gyms,
    health,
    leads,
    member_share,
    members,
    memberships,
    notifications,
    payments,
    risk,
    users,
    whatsapp,
)
from app.core.config import settings
from app.services import risk_engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    sweep_seconds = getattr(settings, "risk_sweep_seconds", 1800)
    task = None
    if sweep_seconds and sweep_seconds > 0:

        async def _sweep() -> None:
            while True:
                await asyncio.sleep(sweep_seconds)
                try:
                    from app.db.session import SessionLocal

                    with SessionLocal() as db:
                        created = risk_engine.sweep_risk_alerts(db)
                    if created:
                        logger.info("Riesgo: %s alertas críticas nuevas", created)
                except Exception:  # noqa: BLE001
                    logger.exception("Barrido periódico de riesgo falló")

        task = asyncio.create_task(_sweep())
        logger.info("Barrido periódico de riesgo activado cada %ss", sweep_seconds)
    try:
        yield
    finally:
        if task is not None:
            task.cancel()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API de GymCore — Sistema de gestión de gimnasios (SaaS multi-tenant).",
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(gyms.router, prefix="/api/v1")
app.include_router(branches.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(members.router, prefix="/api/v1")
app.include_router(memberships.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(checkin.router, prefix="/api/v1")
app.include_router(leads.router, prefix="/api/v1")
app.include_router(member_share.router, prefix="/api/v1")
app.include_router(risk.router, prefix="/api/v1")
app.include_router(dashboards.router, prefix="/api/v1")
app.include_router(automation.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(whatsapp.router, prefix="/api/v1")
app.include_router(create_gym.router, prefix="/api/v1")

# Media (MVP local). La URL pública /media/... es la que devuelven los endpoints.
media_dir = Path(settings.media_root)
media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_dir), name="media")
