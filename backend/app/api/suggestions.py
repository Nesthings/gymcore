"""Buzón de sugerencias del gimnasio — admin.

Los socios envían comentarios desde su portal (`/m`); aquí el admin los lee,
marca como vistos y los responde en persona.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_gym_roles
from app.db.session import get_db
from app.models import GymSuggestion

router = APIRouter(
    prefix="/suggestions",
    tags=["suggestions"],
    dependencies=[Depends(require_gym_roles("admin"))],
)


def _to_read(s: GymSuggestion) -> dict:
    return {
        "id": str(s.id),
        "member_id": str(s.member_id) if s.member_id else None,
        "member_name": s.member_name,
        "message": s.message,
        "status": s.status,
        "created_at": s.created_at,
    }


@router.get("", summary="Sugerencias del gimnasio (nuevas primero)")
def list_suggestions(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    status_: str | None = Query(default=None, alias="status", pattern="^(new|read)$"),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    stmt = select(GymSuggestion).where(GymSuggestion.gym_id == ctx.gym["id"])
    if status_:
        stmt = stmt.where(GymSuggestion.status == status_)
    stmt = stmt.order_by(GymSuggestion.created_at.desc()).limit(limit)
    return [_to_read(s) for s in db.scalars(stmt)]


@router.get("/unread-count", summary="Cuenta de sugerencias sin leer")
def unread_count(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    from sqlalchemy import func

    count = (
        db.scalar(
            select(func.count())
            .select_from(GymSuggestion)
            .where(GymSuggestion.gym_id == ctx.gym["id"], GymSuggestion.status == "new")
        )
        or 0
    )
    return {"count": count}


@router.post("/{suggestion_id}/read", summary="Marca una sugerencia como leída")
def mark_read(
    suggestion_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    suggestion = db.scalar(
        select(GymSuggestion).where(
            GymSuggestion.id == suggestion_id, GymSuggestion.gym_id == ctx.gym["id"]
        )
    )
    if suggestion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sugerencia no encontrada"
        )
    suggestion.status = "read"
    db.commit()
    return _to_read(suggestion)


@router.post("/read-all", summary="Marca todas como leídas")
def mark_all_read(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    from sqlalchemy import update

    db.execute(
        update(GymSuggestion)
        .where(GymSuggestion.gym_id == ctx.gym["id"], GymSuggestion.status == "new")
        .values(status="read")
    )
    db.commit()
    return {"ok": True}
