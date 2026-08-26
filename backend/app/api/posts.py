"""Feed de novedades del gimnasio — admin (comunicados)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_gym_roles
from app.db.session import get_db
from app.models import GymPost

router = APIRouter(
    prefix="/posts",
    tags=["posts"],
    dependencies=[Depends(require_gym_roles("admin"))],
)


@router.get("", summary="Comunicados del gimnasio")
def list_posts(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT id, title, message, active, created_at, "
                "(SELECT full_name FROM users u WHERE u.id = p.created_by) AS author "
                "FROM gym_posts p WHERE gym_id = :gid ORDER BY created_at DESC LIMIT 100"
            ),
            {"gid": str(ctx.gym["id"])},
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED, summary="Publica un comunicado")
def create_post(
    body: dict,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    title = (body.get("title") or "").strip()
    message = (body.get("message") or "").strip()
    if not title or not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Título y mensaje requeridos"
        )
    post = GymPost(
        gym_id=ctx.gym["id"],
        title=title,
        message=message,
        created_by=ctx.user.sub,
        active=True,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {
        "id": str(post.id),
        "title": post.title,
        "message": post.message,
        "active": post.active,
        "created_at": post.created_at,
    }


@router.patch("/{post_id}", summary="Activa/desactiva un comunicado")
def update_post(
    post_id: str,
    body: dict,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    post = db.scalar(select(GymPost).where(GymPost.id == post_id, GymPost.gym_id == ctx.gym["id"]))
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comunicado no encontrado"
        )
    if "active" in body:
        post.active = bool(body["active"])
    if body.get("title"):
        post.title = body["title"]
    if body.get("message"):
        post.message = body["message"]
    db.commit()
    return {"id": str(post.id), "title": post.title, "message": post.message, "active": post.active}


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> None:
    post = db.scalar(select(GymPost).where(GymPost.id == post_id, GymPost.gym_id == ctx.gym["id"]))
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comunicado no encontrado"
        )
    db.delete(post)
    db.commit()
