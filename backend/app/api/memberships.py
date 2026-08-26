"""Membresías: planes y membresías de socios (asignación, renovación, cancelación)."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.core.events import record_audit
from app.db.session import get_db
from app.models import Member, MemberMembership, MembershipPlan, Payment
from app.schemas.membership import (
    ActiveMembershipRead,
    AssignMembershipRequest,
    CancelMembershipRequest,
    MembershipPlanCreate,
    MembershipPlanRead,
    MembershipPlanUpdate,
    RenewMembershipRequest,
)

router = APIRouter(tags=["memberships"])


def _active_row(db: Session, gym_id: str, membership_id: str) -> dict:
    row = (
        db.execute(
            text(
                "SELECT mm.id, mm.member_id, m.full_name AS member_name, mm.plan_id, "
                "p.name AS plan_name, mm.status, mm.starts_at, mm.expires_at, mm.checkins_used, "
                "p.checkins_limit, mm.paid_amount "
                "FROM member_memberships mm "
                "JOIN members m ON m.id = mm.member_id "
                "JOIN membership_plans p ON p.id = mm.plan_id "
                "WHERE mm.id = :mid AND mm.gym_id = :gid"
            ),
            {"mid": membership_id, "gid": gym_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membresía no encontrada")
    return dict(row)


# --------------------------------------------------------------------------
# Planes
# --------------------------------------------------------------------------


@router.get("/membership-plans", response_model=list[MembershipPlanRead])
def list_plans(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    include_inactive: bool = False,
) -> list[MembershipPlan]:
    stmt = select(MembershipPlan).where(MembershipPlan.gym_id == ctx.gym["id"])
    if not include_inactive:
        stmt = stmt.where(MembershipPlan.is_active.is_(True))
    return list(db.scalars(stmt.order_by(MembershipPlan.price)))


@router.post(
    "/membership-plans",
    response_model=MembershipPlanRead,
    status_code=status.HTTP_201_CREATED,
)
def create_plan(
    body: MembershipPlanCreate,
    ctx: CurrentGym = Depends(require_component("membresias")),
    db: Session = Depends(get_db),
) -> MembershipPlan:
    plan = MembershipPlan(gym_id=ctx.gym["id"], **body.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/membership-plans/{plan_id}", response_model=MembershipPlanRead)
def update_plan(
    plan_id: str,
    body: MembershipPlanUpdate,
    ctx: CurrentGym = Depends(require_component("membresias")),
    db: Session = Depends(get_db),
) -> MembershipPlan:
    plan = db.scalar(
        select(MembershipPlan).where(
            MembershipPlan.id == plan_id, MembershipPlan.gym_id == ctx.gym["id"]
        )
    )
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/membership-plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(
    plan_id: str,
    ctx: CurrentGym = Depends(require_component("membresias")),
    db: Session = Depends(get_db),
) -> None:
    plan = db.scalar(
        select(MembershipPlan).where(
            MembershipPlan.id == plan_id, MembershipPlan.gym_id == ctx.gym["id"]
        )
    )
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")
    in_use = db.scalar(
        select(MemberMembership.id).where(MemberMembership.plan_id == plan.id).limit(1)
    )
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: el plan tiene membresías asignadas. Desactívalo.",
        )
    db.delete(plan)
    db.commit()


# --------------------------------------------------------------------------
# Membresías de socios
# --------------------------------------------------------------------------


def _status_for(expires_at: datetime) -> str:
    now = datetime.now(UTC)
    if expires_at < now:
        return "expired"
    if expires_at - now <= timedelta(days=5):
        return "expiring"
    return "active"


def _sync_statuses(db: Session, gym_id: str) -> None:
    """Actualiza el estado de membresías vencidas (expiring→expired)."""
    db.execute(
        text(
            "UPDATE member_memberships SET status = 'expired' "
            "WHERE gym_id = :gid AND status IN ('active', 'expiring') AND expires_at < now()"
        ),
        {"gid": gym_id},
    )


def _record_payment(
    db: Session,
    *,
    gym_id: uuid.UUID,
    member_id: uuid.UUID,
    membership_id: uuid.UUID,
    amount: float,
    method: str,
    concept: str,
    branch_id: uuid.UUID | None = None,
    user_id: str | None = None,
) -> Payment:
    payment = Payment(
        gym_id=gym_id,
        member_id=member_id,
        membership_id=membership_id,
        branch_id=branch_id,
        amount=amount,
        method=method,
        status="paid",
        concept=concept,
        paid_at=datetime.now(UTC),
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(payment)
    return payment


@router.get("/memberships", response_model=list[ActiveMembershipRead])
def list_memberships(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    status: str | None = Query(default=None, pattern="^(active|expiring|expired|cancelled)$"),
    branch_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    _sync_statuses(db, str(ctx.gym["id"]))
    sql = (
        "SELECT mm.id, mm.member_id, m.full_name AS member_name, mm.plan_id, "
        "p.name AS plan_name, mm.status, mm.starts_at, mm.expires_at, mm.checkins_used, "
        "p.checkins_limit, mm.paid_amount "
        "FROM member_memberships mm "
        "JOIN members m ON m.id = mm.member_id "
        "JOIN membership_plans p ON p.id = mm.plan_id "
        "WHERE mm.gym_id = :gid AND m.status != 'cancelled'"
    )
    params: dict = {"gid": str(ctx.gym["id"])}
    if status:
        if status in ("active", "expiring"):
            sql += " AND mm.status IN ('active', 'expiring')"
        else:
            sql += " AND mm.status = :st"
            params["st"] = status
    else:
        sql += " AND mm.status IN ('active', 'expiring')"
    if branch_id:
        sql += " AND mm.branch_id = :bid"
        params["bid"] = branch_id
    sql += " ORDER BY mm.expires_at ASC LIMIT :limit"
    params["limit"] = limit
    return [dict(r) for r in db.execute(text(sql), params).mappings().all()]


@router.post(
    "/members/{member_id}/memberships",
    response_model=ActiveMembershipRead,
    status_code=status.HTTP_201_CREATED,
)
def assign_membership(
    member_id: str,
    body: AssignMembershipRequest,
    ctx: CurrentGym = Depends(require_component("membresias")),
    db: Session = Depends(get_db),
) -> dict:
    member = db.scalar(select(Member).where(Member.id == member_id, Member.gym_id == ctx.gym["id"]))
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Socio no encontrado")
    plan = db.scalar(
        select(MembershipPlan).where(
            MembershipPlan.id == body.plan_id, MembershipPlan.gym_id == ctx.gym["id"]
        )
    )
    if plan is None or not plan.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")

    db.execute(
        text(
            "UPDATE member_memberships SET status = 'cancelled', cancel_reason = 'sustituida' "
            "WHERE member_id = :mid AND status IN ('active', 'expiring')"
        ),
        {"mid": member_id},
    )

    start = body.start_date or datetime.now(UTC)
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    expires = start + timedelta(days=plan.duration_days)
    mm = MemberMembership(
        gym_id=ctx.gym["id"],
        member_id=member.id,
        plan_id=plan.id,
        branch_id=body.branch_id,
        starts_at=start,
        expires_at=expires,
        status=_status_for(expires),
        paid_amount=body.paid_amount or 0,
    )
    db.add(mm)
    db.flush()

    if body.paid_amount and body.paid_amount > 0:
        _record_payment(
            db,
            gym_id=ctx.gym["id"],
            member_id=member.id,
            membership_id=mm.id,
            amount=body.paid_amount,
            method=body.payment_method or "cash",
            concept=f"Membresía {plan.name}",
            branch_id=body.branch_id,
            user_id=str(ctx.user.sub),
        )

    if member.status == "inactive":
        member.status = "active"

    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="membership_assigned",
        entity_type="member",
        entity_id=member.id,
        metadata={"plan": plan.name},
    )
    db.commit()
    return _active_row(db, str(ctx.gym["id"]), str(mm.id))


@router.post("/memberships/{membership_id}/renew", response_model=ActiveMembershipRead)
def renew_membership(
    membership_id: str,
    body: RenewMembershipRequest,
    ctx: CurrentGym = Depends(require_component("membresias")),
    db: Session = Depends(get_db),
) -> dict:
    _sync_statuses(db, str(ctx.gym["id"]))
    mm = db.scalar(
        select(MemberMembership).where(
            MemberMembership.id == membership_id, MemberMembership.gym_id == ctx.gym["id"]
        )
    )
    if mm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membresía no encontrada")
    plan = db.get(MembershipPlan, mm.plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan no encontrado")

    now = datetime.now(UTC)
    base = mm.expires_at if mm.expires_at > now else now
    mm.starts_at = mm.starts_at if mm.expires_at > now else now
    mm.expires_at = base + timedelta(days=plan.duration_days)
    mm.status = _status_for(mm.expires_at)
    mm.cancel_reason = None
    mm.checkins_used = 0

    amount = body.amount if body.amount is not None else float(plan.price)
    if amount > 0:
        _record_payment(
            db,
            gym_id=ctx.gym["id"],
            member_id=mm.member_id,
            membership_id=mm.id,
            amount=amount,
            method=body.payment_method or "cash",
            concept=f"Renovación {plan.name}",
            branch_id=mm.branch_id,
            user_id=str(ctx.user.sub),
        )
        mm.paid_amount = amount

    member = db.get(Member, mm.member_id)
    if member and member.status == "inactive":
        member.status = "active"

    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="membership_renewed",
        entity_type="member",
        entity_id=mm.member_id,
        metadata={"plan": plan.name, "amount": amount},
    )
    db.commit()
    return _active_row(db, str(ctx.gym["id"]), membership_id)


@router.patch("/memberships/{membership_id}/cancel", response_model=ActiveMembershipRead)
def cancel_membership(
    membership_id: str,
    body: CancelMembershipRequest,
    ctx: CurrentGym = Depends(require_component("membresias")),
    db: Session = Depends(get_db),
) -> dict:
    mm = db.scalar(
        select(MemberMembership).where(
            MemberMembership.id == membership_id, MemberMembership.gym_id == ctx.gym["id"]
        )
    )
    if mm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membresía no encontrada")
    mm.status = "cancelled"
    mm.cancel_reason = body.reason or "Cancelada por el gimnasio"
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="membership_cancelled",
        entity_type="member",
        entity_id=mm.member_id,
        metadata={"reason": mm.cancel_reason},
    )
    db.commit()
    return _active_row(db, str(ctx.gym["id"]), membership_id)
