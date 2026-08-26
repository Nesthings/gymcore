"""Riesgo de abandono — score por reglas de negocio."""

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.db.session import get_db
from app.schemas.risk import RiskMemberRead, RiskSummary
from app.services.risk_engine import risk_for_gym, risk_summary

router = APIRouter(
    prefix="/risk",
    tags=["risk"],
    dependencies=[Depends(require_component("inteligencia"))],
)


@router.get("/members", response_model=list[RiskMemberRead])
def list_risk_members(
    ctx: CurrentGym = Depends(get_current_gym),
    db=Depends(get_db),
    level: str | None = Query(default=None, pattern="^(critical|warning|info)$"),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    members = risk_for_gym(db, str(ctx.gym["id"]), limit=limit)
    if level:
        members = [m for m in members if m["risk_level"] == level]
    return members[:limit]


@router.get("/summary", response_model=RiskSummary)
def summary(
    ctx: CurrentGym = Depends(get_current_gym),
    db=Depends(get_db),
) -> dict:
    return risk_summary(db, str(ctx.gym["id"]))
