"""Recordatorios automáticos de renovación de membresías.

Motor escalonado con deduplicación por plantilla (`renew:<mm_id>`): avisa a
los socios cuya membresía vence pronto (7/3/1 días) o ya venció. Sin WhatsApp
configurado se registra el envío como stub (status 'sent').
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.db.session import get_db
from app.services.queue import dispatch
from app.services.whatsapp import normalize_mx

router = APIRouter(prefix="/automation", tags=["automation"])

STAGES = [7, 3, 1, 0]  # días de antelación / 0 = vencida


def _candidates(db: Session, gym_id: str, days_ahead: int) -> list[dict]:
    if days_ahead > 0:
        sql = (
            "SELECT mm.id, mm.member_id, m.full_name AS member_name, m.phone, "
            "p.name AS plan_name, mm.expires_at "
            "FROM member_memberships mm "
            "JOIN members m ON m.id = mm.member_id "
            "JOIN membership_plans p ON p.id = mm.plan_id "
            "WHERE mm.gym_id = :gid AND mm.status IN ('active', 'expiring') "
            "AND mm.expires_at >= now() AND mm.expires_at <= now() + :days * interval '1 day'"
        )
    else:
        sql = (
            "SELECT mm.id, mm.member_id, m.full_name AS member_name, m.phone, "
            "p.name AS plan_name, mm.expires_at "
            "FROM member_memberships mm "
            "JOIN members m ON m.id = mm.member_id "
            "JOIN membership_plans p ON p.id = mm.plan_id "
            "WHERE mm.gym_id = :gid AND mm.status = 'expired' "
            "AND mm.expires_at >= now() - interval '10 days'"
        )
    return [
        dict(r) for r in db.execute(text(sql), {"gid": gym_id, "days": days_ahead}).mappings().all()
    ]


def _already_sent(db: Session, gym_id: str, template: str) -> bool:
    return (
        db.execute(
            text(
                "SELECT 1 FROM outbound_notifications "
                "WHERE gym_id = :gid AND template = :tpl LIMIT 1"
            ),
            {"gid": gym_id, "tpl": template},
        ).first()
        is not None
    )


@router.post("/renewal-reminders/run", summary="Ejecuta el envío de recordatorios de renovación")
def run_renewal_reminders(
    ctx: CurrentGym = Depends(require_component("membresias")),
    db: Session = Depends(get_db),
) -> dict:
    gym_id = str(ctx.gym["id"])
    gym_name = ctx.gym["name"]
    sent = 0
    skipped = 0
    for stage in STAGES:
        for c in _candidates(db, gym_id, stage):
            template = f"renew:{stage}:{c['id']}"
            if _already_sent(db, gym_id, template):
                skipped += 1
                continue
            to = normalize_mx(c["phone"])
            if not to:
                skipped += 1
                continue
            when = "hoy vence" if stage == 0 else f"vence en {stage} días"
            msg = (
                f"{gym_name}: la membresía de {c['member_name']} ({c['plan_name']}) {when}. "
                f"Renueva para no perder tu acceso."
            )
            dispatch(
                db,
                ctx.gym["id"],
                "renewal",
                to,
                msg,
                [c["member_name"], c["plan_name"], when],
                template,
                member_id=c["member_id"],
            )
            sent += 1
    db.commit()
    return {"sent": sent, "skipped": skipped}


@router.get("/renewal-reminders/pending", summary="Membresías que vencen pronto (14 días)")
def pending_renewals(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT mm.id, m.full_name AS member_name, m.phone, p.name AS plan_name, "
                "mm.expires_at, mm.status "
                "FROM member_memberships mm "
                "JOIN members m ON m.id = mm.member_id "
                "JOIN membership_plans p ON p.id = mm.plan_id "
                "WHERE mm.gym_id = :gid AND mm.status IN ('active', 'expiring', 'expired') "
                "AND mm.expires_at <= now() + interval '14 days' "
                "ORDER BY mm.expires_at ASC"
            ),
            {"gid": str(ctx.gym["id"])},
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]
