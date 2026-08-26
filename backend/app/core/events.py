"""Helpers transversales: notificaciones internas y bitácora de auditoría."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, InternalNotification, User


def notify_user(
    db: Session,
    gym_id: uuid.UUID,
    user_id: uuid.UUID,
    type_: str,
    message: str,
    link: str | None = None,
) -> None:
    db.add(
        InternalNotification(gym_id=gym_id, user_id=user_id, type=type_, message=message, link=link)
    )


def notify_roles(
    db: Session,
    gym_id: uuid.UUID,
    roles: list[str],
    type_: str,
    message: str,
    link: str | None = None,
) -> None:
    """Notifica a todos los usuarios activos del gimnasio con los roles dados."""
    user_ids = db.scalars(
        select(User.id).where(
            User.gym_id == gym_id,
            User.role.in_(roles),
            User.is_active.is_(True),
        )
    ).all()
    for uid in user_ids:
        notify_user(db, gym_id, uid, type_, message, link=link)


def record_audit(
    db: Session,
    *,
    gym_id: uuid.UUID | None,
    actor_type: str,
    actor_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    metadata: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            gym_id=gym_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata,
        )
    )
