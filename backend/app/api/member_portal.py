"""Portal del socio — logros, objetivos, calendario, feed y pases.

Todos los endpoints usan el token de acceso (`/m?token=`) y solo exponen
datos del propio socio. Los pases generan un token de un solo uso que se
redime en recepción (ver `passes.py`).
"""

import secrets
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.member_share import _resolve_member
from app.db.session import get_db
from app.models import MemberGoal, MemberPass, MembershipPlan
from app.services.achievements import achievements_for
from app.services.goals import goal_progress

router = APIRouter(tags=["member-portal"])

GOAL_TYPES_VALID = (
    "peso",
    "entrenamientos_semana",
    "visitas_mes",
    "tiempo_entrenado",
    "consistencia",
    "personalizado",
)


# --------------------------------------------------------------------------
# Logros
# --------------------------------------------------------------------------


@router.get("/member-share/achievements", summary="Logros del socio (portal)")
def member_achievements(
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    return achievements_for(db, str(member.gym_id), str(member.id))


# --------------------------------------------------------------------------
# Objetivos
# --------------------------------------------------------------------------


def _goal_to_read(db: Session, gym_id: str, g: MemberGoal) -> dict:
    base = {
        "id": str(g.id),
        "goal_type": g.goal_type,
        "title": g.title,
        "target_value": float(g.target_value),
        "end_date": g.end_date,
        "active": g.active,
        "created_at": g.created_at,
    }
    prog = goal_progress(db, gym_id, str(g.member_id), base)
    base.update(prog)
    return base


@router.get("/member-share/goals", summary="Objetivos del socio con progreso")
def member_goals(
    token: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    member = _resolve_member(db, token or "")
    rows = (
        db.execute(
            text(
                "SELECT * FROM member_goals WHERE member_id = :mid AND active = true "
                "ORDER BY created_at DESC"
            ),
            {"mid": str(member.id)},
        )
        .mappings()
        .all()
    )
    return [
        _goal_to_read(db, str(member.gym_id), MemberGoal(**{k: v for k, v in r.items()}))
        for r in rows
    ]


@router.post("/member-share/goals", status_code=status.HTTP_201_CREATED)
def create_goal(
    body: dict,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    goal_type = body.get("goal_type")
    if goal_type not in GOAL_TYPES_VALID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de objetivo inválido"
        )
    try:
        target = float(body.get("target_value"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="target_value inválido"
        ) from None
    if target <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La meta debe ser positiva"
        )
    title = body.get("title") or {
        "peso": "Peso objetivo",
        "entrenamientos_semana": "Entrenamientos por semana",
        "visitas_mes": "Visitas al mes",
        "tiempo_entrenado": "Tiempo de entrenamiento",
        "consistencia": "Racha de consistencia",
        "personalizado": "Mi objetivo",
    }.get(goal_type, "Mi objetivo")
    goal = MemberGoal(
        gym_id=member.gym_id,
        member_id=member.id,
        goal_type=goal_type,
        title=title,
        target_value=target,
        start_date=date.today(),
        end_date=body.get("end_date"),
        active=True,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _goal_to_read(db, str(member.gym_id), goal)


def _get_goal_or_404(db: Session, member_id: str, goal_id: str) -> MemberGoal:
    goal = db.scalar(
        select(MemberGoal).where(MemberGoal.id == goal_id, MemberGoal.member_id == member_id)
    )
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objetivo no encontrado")
    return goal


@router.patch("/member-share/goals/{goal_id}")
def update_goal(
    goal_id: str,
    body: dict,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    goal = _get_goal_or_404(db, str(member.id), goal_id)
    if body.get("target_value") is not None:
        try:
            goal.target_value = float(body["target_value"])
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="target_value inválido"
            ) from None
    if body.get("title") is not None:
        goal.title = body["title"]
    if body.get("end_date") is not None:
        goal.end_date = body["end_date"]
    if "active" in body:
        goal.active = bool(body["active"])
    db.commit()
    db.refresh(goal)
    return _goal_to_read(db, str(member.gym_id), goal)


@router.delete("/member-share/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: str,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> None:
    member = _resolve_member(db, token or "")
    goal = _get_goal_or_404(db, str(member.id), goal_id)
    db.delete(goal)
    db.commit()


# --------------------------------------------------------------------------
# Calendario personal
# --------------------------------------------------------------------------


@router.get("/member-share/calendar", summary="Días entrenados del mes (portal)")
def member_calendar(
    token: str | None = None,
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    now = datetime.now(UTC)
    y = year or now.year
    m = month or now.month
    rows = (
        db.execute(
            text(
                "SELECT checked_at::date AS d, checked_at, checked_out_at, duration_min "
                "FROM checkins WHERE member_id = :mid "
                "AND EXTRACT(YEAR FROM checked_at) = :y AND EXTRACT(MONTH FROM checked_at) = :m "
                "ORDER BY checked_at ASC"
            ),
            {"mid": str(member.id), "y": y, "m": m},
        )
        .mappings()
        .all()
    )
    days: dict[str, dict] = {}
    for r in rows:
        key = str(r["d"])
        entry = {
            "checked_at": r["checked_at"],
            "checked_out_at": r["checked_out_at"],
            "duration_min": r["duration_min"],
        }
        if key not in days:
            days[key] = {"date": key, "entries": []}
        days[key]["entries"].append(entry)
    return {"year": y, "month": m, "days": sorted(days.values(), key=lambda d: d["date"])}


# --------------------------------------------------------------------------
# Feed del gimnasio
# --------------------------------------------------------------------------


@router.get("/member-share/feed", summary="Novedades del gimnasio (portal)")
def member_feed(
    token: str | None = None,
    db: Session = Depends(get_db),
    limit: int = Query(default=10, ge=1, le=50),
) -> list[dict]:
    member = _resolve_member(db, token or "")
    rows = (
        db.execute(
            text(
                "SELECT id, title, message, created_at FROM gym_posts "
                "WHERE gym_id = :gid AND active = true ORDER BY created_at DESC LIMIT :limit"
            ),
            {"gid": str(member.gym_id), "limit": limit},
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]


# --------------------------------------------------------------------------
# Pases
# --------------------------------------------------------------------------


def _active_plan(db: Session, member_id: str) -> MembershipPlan | None:
    row = (
        db.execute(
            text(
                "SELECT p.* FROM member_memberships mm "
                "JOIN membership_plans p ON p.id = mm.plan_id "
                "WHERE mm.member_id = :mid AND mm.status IN ('active', 'expiring') "
                "ORDER BY mm.expires_at DESC LIMIT 1"
            ),
            {"mid": str(member_id)},
        )
        .mappings()
        .first()
    )
    if row is None:
        return None
    return MembershipPlan(**{k: v for k, v in row.items()})


def _period_start(period: str) -> date:
    today = date.today()
    if period == "week":
        return today - timedelta(days=today.weekday())
    return today.replace(day=1)


def _renewal_date(period: str) -> date:
    ps = _period_start(period)
    if period == "week":
        return ps + timedelta(days=7)
    return (ps.replace(day=28) + timedelta(days=4)).replace(day=1)


def _used_in_period(db: Session, member_id: str, period_start: date) -> int:
    return (
        db.execute(
            text(
                "SELECT COUNT(*) FROM member_passes WHERE member_id = :mid "
                "AND status IN ('generated', 'redeemed') AND period_start = :ps"
            ),
            {"mid": str(member_id), "ps": period_start},
        ).scalar()
        or 0
    )


@router.get("/member-share/passes", summary="Pases disponibles e historial (portal)")
def member_passes(
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    plan = _active_plan(db, str(member.id))
    policy = {
        "pass_type": plan.pass_type if plan else None,
        "pass_period": plan.pass_period if plan else None,
        "pass_duration_days": plan.pass_duration_days if plan else None,
        "requires_guest": plan.pass_requires_guest if plan else False,
        "ask_phone": plan.pass_ask_phone if plan else False,
        "ask_email": plan.pass_ask_email if plan else False,
        "max_accumulate": plan.pass_max_accumulate if plan else None,
        "expiry_minutes": plan.pass_expiry_minutes if plan else 30,
    }
    available = 0
    renewal_date = None
    if plan and plan.pass_quantity and plan.pass_period:
        ps = _period_start(plan.pass_period)
        used = _used_in_period(db, str(member.id), ps)
        available = max(0, plan.pass_quantity - used)
        renewal_date = _renewal_date(plan.pass_period)

    history = [
        dict(r)
        for r in db.execute(
            text(
                "SELECT id, pass_type, status, guest_name, generated_at, expires_at, "
                "redeemed_at, period_start FROM member_passes "
                "WHERE member_id = :mid ORDER BY created_at DESC LIMIT 20"
            ),
            {"mid": str(member.id)},
        )
        .mappings()
        .all()
    ]
    return {
        "policy": policy,
        "available": available,
        "renewal_date": renewal_date,
        "history": history,
    }


@router.post(
    "/member-share/passes/generate",
    status_code=status.HTTP_201_CREATED,
    summary="Genera un pase (token de un solo uso)",
)
def generate_pass(
    body: dict,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    plan = _active_plan(db, str(member.id))
    if plan is None or not plan.pass_quantity or not plan.pass_period:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Tu plan no incluye pases"
        )
    ps = _period_start(plan.pass_period)
    if _used_in_period(db, str(member.id), ps) >= plan.pass_quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ya usaste tus pases del periodo"
        )

    guest_name = (body.get("guest_name") or "").strip() or None
    if plan.pass_requires_guest and not guest_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este pase requiere registrar al invitado",
        )

    expires_at = datetime.now(UTC) + timedelta(minutes=plan.pass_expiry_minutes or 30)
    pase = MemberPass(
        gym_id=member.gym_id,
        member_id=member.id,
        pass_type=plan.pass_type or "invitado",
        token=secrets.token_urlsafe(24),
        status="generated",
        guest_name=guest_name,
        guest_phone=(body.get("guest_phone") or "").strip() or None,
        guest_email=(body.get("guest_email") or "").strip() or None,
        generated_at=datetime.now(UTC),
        expires_at=expires_at,
        period_start=ps,
    )
    db.add(pase)
    db.commit()
    db.refresh(pase)
    return {
        "id": str(pase.id),
        "token": pase.token,
        "status": pase.status,
        "expires_at": pase.expires_at,
        "guest_name": pase.guest_name,
        "pass_type": pase.pass_type,
        "share_url": f"/g?token={pase.token}",
    }


@router.post(
    "/member-share/passes/{pass_id}/cancel",
    summary="Cancela un pase generado (portal)",
)
def cancel_pass(
    pass_id: str,
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    member = _resolve_member(db, token or "")
    pase = db.scalar(
        select(MemberPass).where(MemberPass.id == pass_id, MemberPass.member_id == member.id)
    )
    if pase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pase no encontrado")
    if pase.status not in ("generated", "available"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pase no cancelable")
    pase.status = "cancelled"
    db.commit()
    return {"id": str(pase.id), "status": pase.status}
