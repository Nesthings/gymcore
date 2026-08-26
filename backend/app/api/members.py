"""CRUD de socios — por-tenant.

Alta, edición, baja y detalle con membresías, pagos, check-ins y riesgo.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.core.events import record_audit
from app.db.session import get_db
from app.models import Member, MemberWeightRecord
from app.schemas.member import MemberCreate, MemberDetail, MemberRead, MemberUpdate
from app.services.engagement import engagement
from app.services.risk_engine import member_risk

router = APIRouter(prefix="/members", tags=["members"])


def _to_member_read(db: Session, gym_id: str, m: Member) -> dict:
    membership = (
        db.execute(
            text(
                "SELECT mm.id, mm.plan_id, p.name AS plan_name, mm.status, mm.starts_at, "
                "mm.expires_at, mm.checkins_used, p.checkins_limit, mm.paid_amount "
                "FROM member_memberships mm JOIN membership_plans p ON p.id = mm.plan_id "
                "WHERE mm.member_id = :mid AND mm.status IN ('active', 'expiring') "
                "ORDER BY mm.expires_at DESC LIMIT 1"
            ),
            {"mid": str(m.id)},
        )
        .mappings()
        .first()
    )
    risk = member_risk(db, gym_id, str(m.id))
    return {
        "id": m.id,
        "gym_id": m.gym_id,
        "full_name": m.full_name,
        "email": m.email,
        "phone": m.phone,
        "photo_url": m.photo_url,
        "status": m.status,
        "joined_at": m.joined_at,
        "risk_level": risk["risk_level"] if risk else None,
        "risk_score": risk["risk_score"] if risk else None,
        "membership": dict(membership) if membership else None,
    }


@router.get("", response_model=list[MemberRead])
def list_members(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=200),
    status: str | None = Query(default=None, pattern="^(active|inactive|cancelled)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    stmt = select(Member).where(Member.gym_id == ctx.gym["id"])
    if search:
        like = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            Member.full_name.ilike(like) | Member.email.ilike(like) | Member.phone.ilike(like)
        )
    if status:
        stmt = stmt.where(Member.status == status)
    stmt = stmt.order_by(Member.joined_at.desc()).limit(limit).offset(offset)
    members = list(db.scalars(stmt))
    return [_to_member_read(db, str(ctx.gym["id"]), m) for m in members]


@router.post("", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
def create_member(
    body: MemberCreate,
    ctx: CurrentGym = Depends(require_component("socios")),
    db: Session = Depends(get_db),
) -> dict:
    email = body.email.strip().lower() if body.email else None
    if email:
        exists = db.scalar(
            select(Member).where(Member.gym_id == ctx.gym["id"], Member.email == email)
        )
        if exists:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un socio con ese email",
            )
    data = body.model_dump(exclude={"email"})
    data["email"] = email
    member = Member(gym_id=ctx.gym["id"], **data)
    db.add(member)
    db.commit()
    db.refresh(member)
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="member_created",
        entity_type="member",
        entity_id=member.id,
    )
    db.commit()
    return _to_member_read(db, str(ctx.gym["id"]), member)


def _get_member_or_404(db: Session, gym_id: str, member_id: str) -> Member:
    try:
        mid = uuid.UUID(member_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Socio no encontrado"
        ) from None
    member = db.scalar(select(Member).where(Member.id == mid, Member.gym_id == gym_id))
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Socio no encontrado")
    return member


@router.get("/{member_id}", response_model=MemberDetail)
def get_member(
    member_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    m = _get_member_or_404(db, ctx.gym["id"], member_id)
    gid = str(ctx.gym["id"])
    memberships = (
        db.execute(
            text(
                "SELECT mm.id, mm.plan_id, p.name AS plan_name, mm.status, mm.starts_at, "
                "mm.expires_at, mm.checkins_used, p.checkins_limit, mm.paid_amount "
                "FROM member_memberships mm JOIN membership_plans p ON p.id = mm.plan_id "
                "WHERE mm.member_id = :mid ORDER BY mm.starts_at DESC"
            ),
            {"mid": member_id},
        )
        .mappings()
        .all()
    )
    payments = (
        db.execute(
            text(
                "SELECT id, amount, method, status, concept, paid_at FROM payments "
                "WHERE member_id = :mid ORDER BY paid_at DESC LIMIT 50"
            ),
            {"mid": member_id},
        )
        .mappings()
        .all()
    )
    checkins = (
        db.execute(
            text(
                "SELECT c.id, c.checked_at, b.name AS branch_name FROM checkins c "
                "LEFT JOIN gym_branches b ON b.id = c.branch_id "
                "WHERE c.member_id = :mid ORDER BY c.checked_at DESC LIMIT 50"
            ),
            {"mid": member_id},
        )
        .mappings()
        .all()
    )
    risk = member_risk(db, gid, member_id)
    return {
        "id": m.id,
        "gym_id": m.gym_id,
        "full_name": m.full_name,
        "email": m.email,
        "phone": m.phone,
        "birth_date": m.birth_date,
        "gender": m.gender,
        "emergency_contact": m.emergency_contact,
        "emergency_phone": m.emergency_phone,
        "photo_url": m.photo_url,
        "status": m.status,
        "notes": m.notes,
        "joined_at": m.joined_at,
        "memberships": [dict(r) for r in memberships],
        "payments": [dict(r) for r in payments],
        "checkins": [dict(r) for r in checkins],
        "risk_level": risk["risk_level"] if risk else None,
        "risk_score": risk["risk_score"] if risk else None,
        "risk_suggested_action": risk["suggested_action"] if risk else None,
        "last_checkin_at": checkins[0]["checked_at"] if checkins else None,
    }


@router.patch("/{member_id}", response_model=MemberRead)
def update_member(
    member_id: str,
    body: MemberUpdate,
    ctx: CurrentGym = Depends(require_component("socios")),
    db: Session = Depends(get_db),
) -> dict:
    member = _get_member_or_404(db, ctx.gym["id"], member_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("email"):
        data["email"] = data["email"].strip().lower()
    for field, value in data.items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="member_updated",
        entity_type="member",
        entity_id=member.id,
        metadata=data,
    )
    db.commit()
    return _to_member_read(db, str(ctx.gym["id"]), member)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_member(
    member_id: str,
    ctx: CurrentGym = Depends(require_component("socios")),
    db: Session = Depends(get_db),
) -> None:
    """Baja del socio: pasa a status 'cancelled' y cancela membresías activas."""
    member = _get_member_or_404(db, ctx.gym["id"], member_id)
    member.status = "cancelled"
    db.execute(
        text(
            "UPDATE member_memberships SET status = 'cancelled', cancel_reason = 'baja socio' "
            "WHERE member_id = :mid AND status IN ('active', 'expiring')"
        ),
        {"mid": member_id},
    )
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="member_cancelled",
        entity_type="member",
        entity_id=member.id,
    )
    db.commit()


# --------------------------------------------------------------------------
# Portal del socio: invitación (link con QR) y engagement
# --------------------------------------------------------------------------

SHARE_TOKEN_DAYS = 60


def _issue_share_token(member: Member) -> None:
    member.share_token = secrets.token_urlsafe(32)
    member.share_expires_at = datetime.now(UTC) + timedelta(days=SHARE_TOKEN_DAYS)


@router.post("/{member_id}/share", summary="Genera/rota el link de invitación del socio (60 días)")
def share_member(
    member_id: str,
    ctx: CurrentGym = Depends(require_component("socios")),
    db: Session = Depends(get_db),
) -> dict:
    member = _get_member_or_404(db, ctx.gym["id"], member_id)
    _issue_share_token(member)
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="member_share_created",
        entity_type="member",
        entity_id=member.id,
    )
    db.commit()
    return {
        "share_token": member.share_token,
        "share_url": f"/m?token={member.share_token}",
        "expires_at": member.share_expires_at,
        "expires_in_days": SHARE_TOKEN_DAYS,
    }


@router.get("/{member_id}/share", summary="Link de invitación vigente (si existe)")
def share_member_info(
    member_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    member = _get_member_or_404(db, ctx.gym["id"], member_id)
    if not member.share_token or (
        member.share_expires_at and member.share_expires_at < datetime.now(UTC)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sin invitación vigente")
    return {
        "share_token": member.share_token,
        "share_url": f"/m?token={member.share_token}",
        "expires_at": member.share_expires_at,
        "expires_in_days": SHARE_TOKEN_DAYS,
    }


@router.get("/{member_id}/engagement", summary="Rachas, visitas y progreso del socio")
def member_engagement(
    member_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    _get_member_or_404(db, ctx.gym["id"], member_id)
    return engagement(db, str(ctx.gym["id"]), member_id)


@router.post("/{member_id}/weights", status_code=status.HTTP_201_CREATED)
def add_member_weight(
    member_id: str,
    body: dict,
    ctx: CurrentGym = Depends(require_component("socios")),
    db: Session = Depends(get_db),
) -> dict:
    member = _get_member_or_404(db, ctx.gym["id"], member_id)
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
    record = MemberWeightRecord(
        gym_id=ctx.gym["id"],
        member_id=member.id,
        weight_kg=weight_kg,
        notes=body.get("notes"),
        recorded_at=datetime.now(UTC),
        created_by=ctx.user.sub,
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
