"""Bitácora de auditoría del gimnasio — staff."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.db.session import get_db
from app.models import AuditLog
from app.schemas.events import AuditLogRead

router = APIRouter(
    prefix="/audit",
    tags=["audit"],
    dependencies=[Depends(require_component("auditoria"))],
)


@router.get("", response_model=list[AuditLogRead])
def list_audit(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    entity_type: str | None = Query(default=None, max_length=50),
    action: str | None = Query(default=None, max_length=50),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AuditLog]:
    stmt = select(AuditLog).where(AuditLog.gym_id == ctx.gym["id"])
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if from_:
        stmt = stmt.where(AuditLog.created_at >= from_)
    if to:
        stmt = stmt.where(AuditLog.created_at <= to)
    stmt = stmt.order_by(AuditLog.created_at.desc()).limit(limit)
    return list(db.scalars(stmt))
