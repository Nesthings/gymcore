"""CRM de leads — pipeline de ventas por-tenant."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.core.events import record_audit
from app.db.session import get_db
from app.models import Lead, Member
from app.schemas.lead import (
    LeadCreate,
    LeadPipelineResponse,
    LeadPipelineStat,
    LeadRead,
    LeadUpdate,
)

router = APIRouter(prefix="/leads", tags=["leads"])

STATUS_ORDER = {"nuevo": 0, "contacto": 1, "propuesta": 2, "ganado": 3, "perdido": 4}


@router.get("", response_model=list[LeadRead])
def list_leads(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    status: str | None = Query(default=None, pattern="^(nuevo|contacto|propuesta|ganado|perdido)$"),
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=100, ge=1, le=200),
) -> list[Lead]:
    stmt = select(Lead).where(Lead.gym_id == ctx.gym["id"])
    if status:
        stmt = stmt.where(Lead.status == status)
    if search:
        like = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            Lead.full_name.ilike(like) | Lead.phone.ilike(like) | Lead.email.ilike(like)
        )
    stmt = stmt.order_by(Lead.updated_at.desc()).limit(limit)
    return list(db.scalars(stmt))


@router.get("/pipeline-stats", response_model=LeadPipelineResponse)
def pipeline_stats(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> LeadPipelineResponse:
    rows = db.execute(
        select(Lead.status, func.count(), func.coalesce(func.sum(Lead.value), 0))
        .where(Lead.gym_id == ctx.gym["id"])
        .group_by(Lead.status)
    ).all()
    by_status = {status: (count, value) for status, count, value in rows}
    pipeline = []
    for st in ("nuevo", "contacto", "propuesta", "ganado", "perdido"):
        count, value = by_status.get(st, (0, 0))
        pipeline.append(LeadPipelineStat(status=st, count=int(count), value=float(value)))
    return LeadPipelineResponse(pipeline=pipeline)


def _get_lead_or_404(db: Session, gym_id: str, lead_id: str) -> Lead:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id, Lead.gym_id == gym_id))
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead no encontrado")
    return lead


@router.post("", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead(
    body: LeadCreate,
    ctx: CurrentGym = Depends(require_component("crm")),
    db: Session = Depends(get_db),
) -> Lead:
    lead = Lead(gym_id=ctx.gym["id"], **body.model_dump(exclude_none=True))
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.patch("/{lead_id}", response_model=LeadRead)
def update_lead(
    lead_id: str,
    body: LeadUpdate,
    ctx: CurrentGym = Depends(require_component("crm")),
    db: Session = Depends(get_db),
) -> Lead:
    lead = _get_lead_or_404(db, ctx.gym["id"], lead_id)
    old_status = lead.status
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(lead, field, value)

    # Conversión: al pasar a 'ganado' se crea el socio si no existe.
    if lead.status == "ganado" and old_status != "ganado":
        existing = db.scalar(
            select(Member).where(Member.gym_id == ctx.gym["id"], Member.email == lead.email)
            if lead.email
            else select(Member).where(
                Member.gym_id == ctx.gym["id"],
                Member.phone == lead.phone,
                Member.phone.isnot(None),
            )
        )
        if existing is None:
            member = Member(
                gym_id=ctx.gym["id"],
                full_name=lead.full_name,
                email=lead.email,
                phone=lead.phone,
            )
            db.add(member)
            db.flush()
            lead.converted_member_id = member.id

        # Recompensa por invitación: si el lead vino de un pase, el socio que
        # invitó gana días extra de membresía (constante configurable).
        _reward_inviter(db, ctx, lead)

    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="lead_updated",
        entity_type="lead",
        entity_id=lead.id,
        metadata={"status": lead.status, "old_status": old_status},
    )
    db.commit()
    db.refresh(lead)
    return lead


GUEST_REWARD_DAYS = 7


def _reward_inviter(db: Session, ctx, lead: Lead) -> None:
    """Si el lead viene de un pase de invitado, bonifica al socio que invitó."""
    if lead.source != "pase de invitado":
        return
    row = (
        db.execute(
            text("SELECT member_id FROM member_passes WHERE redeemed_lead_id = :lid LIMIT 1"),
            {"lid": str(lead.id)},
        )
        .mappings()
        .first()
    )
    if row is None:
        return
    inviter_id = row["member_id"]
    membership = (
        db.execute(
            text(
                "SELECT id FROM member_memberships WHERE member_id = :mid "
                "AND status IN ('active', 'expiring') ORDER BY expires_at DESC LIMIT 1"
            ),
            {"mid": str(inviter_id)},
        )
        .mappings()
        .first()
    )
    if membership is None:
        return
    db.execute(
        text(
            "UPDATE member_memberships SET expires_at = expires_at + interval '7 days' "
            "WHERE id = :mmid"
        ),
        {"mmid": membership["id"]},
    )
    inviter = db.get(Member, inviter_id)
    db.execute(
        text(
            "INSERT INTO internal_notifications (id, gym_id, user_id, type, message, link) "
            "SELECT gen_random_uuid(), :gid, id, 'invitacion', :msg, :link "
            "FROM users WHERE gym_id = :gid AND role = 'admin' AND is_active = true"
        ),
        {
            "gid": str(ctx.gym["id"]),
            "msg": (
                f"🎉 {lead.full_name} se convirtió en miembro (invitado de "
                f"{inviter.full_name if inviter else 'un socio'}). "
                f"El socio ganó {GUEST_REWARD_DAYS} días extra."
            ),
            "link": f"/socios/{inviter_id}",
        },
    )


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: str,
    ctx: CurrentGym = Depends(require_component("crm")),
    db: Session = Depends(get_db),
) -> None:
    lead = _get_lead_or_404(db, ctx.gym["id"], lead_id)
    db.delete(lead)
    db.commit()
