"""Centro de notificaciones internas del staff."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, require_staff
from app.db.session import get_db
from app.models import InternalNotification
from app.schemas.events import NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_notifications(
    me: CurrentUser = Depends(require_staff),
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[InternalNotification]:
    stmt = (
        select(InternalNotification)
        .where(InternalNotification.user_id == me.sub)
        .order_by(InternalNotification.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


@router.get("/unread-count")
def unread_count(
    me: CurrentUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    count = (
        db.scalar(
            select(func.count())
            .select_from(InternalNotification)
            .where(
                InternalNotification.user_id == me.sub,
                InternalNotification.read_at.is_(None),
            )
        )
        or 0
    )
    return {"count": count}


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    notification_id: str,
    me: CurrentUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> None:
    notification = db.scalar(
        select(InternalNotification).where(
            InternalNotification.id == notification_id,
            InternalNotification.user_id == me.sub,
        )
    )
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada"
        )
    now = datetime.now(UTC)
    db.execute(
        update(InternalNotification)
        .where(
            InternalNotification.gym_id == notification.gym_id,
            InternalNotification.type == notification.type,
            InternalNotification.message == notification.message,
            InternalNotification.link == notification.link,
            InternalNotification.read_at.is_(None),
        )
        .values(read_at=now)
    )
    db.commit()


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    me: CurrentUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> None:
    if not me.gym_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin gimnasio asociado")
    db.execute(
        update(InternalNotification)
        .where(
            InternalNotification.gym_id == me.gym_id,
            InternalNotification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    db.commit()
