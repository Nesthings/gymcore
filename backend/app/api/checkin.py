"""Check-in por QR/nombre — registra la entrada del socio."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.db.session import get_db
from app.models import Checkin, Member, MemberMembership
from app.schemas.checkin import CheckinRequest, CheckinResult, TodayCheckinRead

router = APIRouter(tags=["checkin"])


def _member_or_404(db: Session, gym_id: str, member_id: str) -> Member:
    member = db.scalar(select(Member).where(Member.id == member_id, Member.gym_id == gym_id))
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Socio no encontrado")
    return member


@router.post("/checkin", response_model=CheckinResult)
def checkin(
    body: CheckinRequest,
    ctx: CurrentGym = Depends(require_component("checkin")),
    db: Session = Depends(get_db),
) -> CheckinResult:
    member_id = body.member_id
    if not member_id and body.qr_token:
        try:
            member_id = body.qr_token.split(":")[-1]
        except Exception:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="QR inválido"
            ) from None
    if not member_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Indica member_id o qr_token"
        )

    member = db.scalar(select(Member).where(Member.id == member_id, Member.gym_id == ctx.gym["id"]))
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Socio no encontrado")
    if member.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="El socio está dado de baja"
        )

    # Si ya tiene una sesión abierta hoy (sin check-out), no duplicamos: la
    # devolvemos para que el staff pueda cerrarla (tiempo de entrenamiento).
    open_session = db.execute(
        text(
            "SELECT id FROM checkins WHERE member_id = :mid AND gym_id = :gid "
            "AND checked_out_at IS NULL AND checked_at::date = current_date LIMIT 1"
        ),
        {"mid": member.id, "gid": str(ctx.gym["id"])},
    ).scalar()
    if open_session:
        return CheckinResult(
            ok=True,
            message=f"{member.full_name} ya está registrado (sesión activa)",
            member_id=member.id,
            member_name=member.full_name,
            plan_active=True,
        )

    # Membresía vigente (descontando cupos si el plan tiene límite)
    mm = db.scalar(
        select(MemberMembership)
        .where(
            MemberMembership.member_id == member.id,
            MemberMembership.gym_id == ctx.gym["id"],
            MemberMembership.status.in_(("active", "expiring")),
        )
        .order_by(MemberMembership.expires_at.desc())
    )

    plan_active = True
    message = f"Bienvenido, {member.full_name}"
    if mm is None:
        plan_active = False
        message = f"{member.full_name} no tiene membresía activa"

    if mm is not None:
        plan = (
            db.execute(
                text("SELECT checkins_limit FROM membership_plans WHERE id = :pid"),
                {"pid": str(mm.plan_id)},
            )
            .mappings()
            .first()
        )
        if plan and plan["checkins_limit"] and mm.checkins_used >= plan["checkins_limit"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El socio agotó los check-ins de su plan",
            )
        mm.checkins_used += 1

    checkin_row = Checkin(
        gym_id=ctx.gym["id"],
        member_id=member.id,
        membership_id=mm.id if mm else None,
        branch_id=ctx.user.branch_id,
        checked_by=ctx.user.sub,
        checked_at=datetime.now(UTC),
    )
    db.add(checkin_row)
    db.commit()

    if member.status == "inactive":
        member.status = "active"
        db.commit()

    return CheckinResult(
        ok=True,
        message=message,
        member_id=member.id,
        member_name=member.full_name,
        plan_active=plan_active,
    )


@router.post(
    "/checkins/{checkin_id}/checkout",
    summary="Registra la salida del socio (cierra la sesión y mide duración)",
)
def checkout(
    checkin_id: str,
    ctx: CurrentGym = Depends(require_component("checkin")),
    db: Session = Depends(get_db),
    body: dict | None = None,
) -> dict:
    row = (
        db.execute(
            text(
                "SELECT id, member_id, checked_at, checked_out_at, duration_min "
                "FROM checkins WHERE id = :cid AND gym_id = :gid"
            ),
            {"cid": checkin_id, "gid": str(ctx.gym["id"])},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check-in no encontrado")
    if row["checked_out_at"] is not None:
        return {
            "id": str(row["id"]),
            "checked_out_at": row["checked_out_at"],
            "duration_min": row["duration_min"],
            "already_closed": True,
        }
    now = datetime.now(UTC)
    duration_min = None
    if body and body.get("duration_min"):
        duration_min = int(body["duration_min"])
    else:
        duration_min = max(1, int((now - row["checked_at"]).total_seconds() // 60))
    db.execute(
        text(
            "UPDATE checkins SET checked_out_at = :out, duration_min = :dur "
            "WHERE id = :cid"
        ),
        {"out": now, "dur": duration_min, "cid": checkin_id},
    )
    db.commit()
    return {
        "id": str(row["id"]),
        "checked_out_at": now,
        "duration_min": duration_min,
        "already_closed": False,
    }


@router.get("/checkins/today", response_model=list[TodayCheckinRead])
def today_checkins(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    branch_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict]:
    sql = (
        "SELECT c.id, c.member_id, m.full_name AS member_name, b.name AS branch_name, "
        "c.checked_at, c.checked_out_at, c.duration_min "
        "FROM checkins c "
        "JOIN members m ON m.id = c.member_id "
        "LEFT JOIN gym_branches b ON b.id = c.branch_id "
        "WHERE c.gym_id = :gid AND c.checked_at >= current_date "
        "AND c.checked_at < current_date + interval '1 day'"
    )
    params: dict = {"gid": str(ctx.gym["id"])}
    if branch_id:
        sql += " AND c.branch_id = :bid"
        params["bid"] = branch_id
    sql += " ORDER BY c.checked_at DESC LIMIT :limit"
    params["limit"] = limit
    return [dict(r) for r in db.execute(text(sql), params).mappings().all()]


@router.get("/members/{member_id}/checkins", summary="Historial de check-ins de un socio")
def member_checkins(
    member_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    _member_or_404(db, ctx.gym["id"], member_id)
    rows = (
        db.execute(
            text(
                "SELECT c.id, c.checked_at, b.name AS branch_name FROM checkins c "
                "LEFT JOIN gym_branches b ON b.id = c.branch_id "
                "WHERE c.member_id = :mid AND c.gym_id = :gid "
                "ORDER BY c.checked_at DESC LIMIT :limit"
            ),
            {"mid": member_id, "gid": str(ctx.gym["id"]), "limit": limit},
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]
