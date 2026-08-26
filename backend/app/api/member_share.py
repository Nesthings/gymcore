"""Portal público del socio (acceso por link de invitación, sin login).

Espejo del patrón `/cartilla?token=` de VetCore: el socio entra con el link
que le genera el gimnasio y puede ver su perfil, membresía, QR, rachas,
historial y registrar su peso. NO expone datos sensibles (email/teléfono).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.storage import ALLOWED_IMAGE_EXTENSIONS, public_url, save_media, validate_extension
from app.db.session import get_db
from app.models import Member
from app.services.engagement import engagement

router = APIRouter(tags=["member-share"])


def _resolve_member(db: Session, token: str) -> Member:
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Falta el token")
    member = db.scalar(select(Member).where(Member.share_token == token))
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link inválido")
    if member.share_expires_at is None or member.share_expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="El enlace ha expirado. Pide a tu gimnasio uno nuevo.",
        )
    return member


def _public_profile(db: Session, member: Member) -> dict:
    gid = str(member.gym_id)
    gym = db.execute(
        text("SELECT name, logo_url FROM gyms WHERE id = :gid"), {"gid": gid}
    ).mappings().first()
    membership = (
        db.execute(
            text(
                "SELECT p.name AS plan_name, mm.status, mm.expires_at, mm.checkins_used, "
                "p.checkins_limit "
                "FROM member_memberships mm JOIN membership_plans p ON p.id = mm.plan_id "
                "WHERE mm.member_id = :mid AND mm.status IN ('active', 'expiring') "
                "ORDER BY mm.expires_at DESC LIMIT 1"
            ),
            {"mid": str(member.id)},
        )
        .mappings()
        .first()
    )
    eng = engagement(db, gid, str(member.id))
    return {
        "gym": {
            "name": gym["name"] if gym else "Gimnasio",
            "logo_url": gym["logo_url"] if gym else None,
        },
        "member": {
            "id": str(member.id),
            "full_name": member.full_name,
            "photo_url": member.photo_url,
            "joined_at": member.joined_at,
            "status": member.status,
        },
        "membership": dict(membership) if membership else None,
        "stats": {
            "checkin_count": eng["checkin_count"],
            "current_streak": eng["current_streak"],
            "best_streak": eng["best_streak"],
            "visits_30d": eng["visits_30d"],
            "total_training_min": eng["total_training_min"],
        },
        "weight_records": eng["weight_records"],
        "recent_checkins": eng["last_checkins"],
    }


@router.get("/member-share", summary="Perfil público del socio (link de invitación)")
def member_share_profile(
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    return _public_profile(db, _resolve_member(db, token or ""))


@router.put("/member-share/photo", summary="El socio actualiza su foto (desde el portal)")
def member_share_photo(
    token: str | None = None,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    validate_extension(photo.filename or "", ALLOWED_IMAGE_EXTENSIONS)
    content = photo.file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen supera el límite de 5 MB",
        )
    rel = save_media(f"members/{member.id}", "profile.jpg", content)
    member.photo_url = public_url(rel)
    db.commit()
    return {"photo_url": member.photo_url}


@router.post("/member-share/weights", status_code=status.HTTP_201_CREATED)
def member_share_weight(
    body: dict,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    weight_kg = body.get("weight_kg")
    if weight_kg is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="weight_kg es requerido"
        )
    try:
        weight_kg = float(weight_kg)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Peso inválido"
        ) from None
    if not (20 <= weight_kg <= 400):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Peso fuera de rango")
    from app.models import MemberWeightRecord

    record = MemberWeightRecord(
        gym_id=member.gym_id,
        member_id=member.id,
        weight_kg=weight_kg,
        notes=body.get("notes"),
        recorded_at=datetime.now(UTC),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": str(record.id),
        "weight_kg": float(record.weight_kg),
        "notes": record.notes,
        "recorded_at": record.recorded_at,
    }


@router.post(
    "/member-suggestions",
    status_code=status.HTTP_201_CREATED,
    summary="El socio envía un comentario/sugerencia al gimnasio (portal)",
)
def member_suggestion(
    body: dict,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Escribe tu mensaje")
    if len(message) > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje es muy largo (máx. 2000)"
        )
    # Anti-spam ligero: máximo 10 sugerencias por socio al día
    sent_today = db.execute(
        text(
            "SELECT COUNT(*) FROM gym_suggestions WHERE gym_id = :gid "
            "AND member_id = :mid AND created_at >= current_date"
        ),
        {"gid": member.gym_id, "mid": member.id},
    ).scalar()
    if (sent_today or 0) >= 10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Has enviado muchas sugerencias hoy. Vuelve mañana.",
        )

    from app.models import GymSuggestion

    suggestion = GymSuggestion(
        gym_id=member.gym_id,
        member_id=member.id,
        member_name=member.full_name,
        message=message,
        status="new",
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    return {
        "id": str(suggestion.id),
        "status": suggestion.status,
        "created_at": suggestion.created_at,
    }
