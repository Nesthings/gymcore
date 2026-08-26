"""Pases del socio: página pública del invitado y redención en recepción.

El invitado abre `/g?token=...` (público) y muestra un QR. El staff escanea
el QR (o teclea el token) y lo redime: invalida el pase y crea un LEAD en el
CRM con fuente 'pase de invitado' para dar seguimiento.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, require_component
from app.core.events import record_audit
from app.db.session import get_db
from app.models import Member, MemberPass

router = APIRouter(tags=["passes"])


def _normalize_pass_token(raw: str | None) -> str:
    """Normaliza un token de pase venga como token crudo, URL (`/g?token=…`),
    esquema `gymcore:pass:<token>` o parámetro suelto `token=<token>`."""
    value = (raw or "").strip()
    if not value:
        return ""
    if value.startswith(("http://", "https://", "/", "gymcore:pass:", "token=")):
        if "token=" in value:
            # Aísla el primer parámetro `token=…` (hasta `&` o el final).
            start = value.index("token=") + len("token=")
            end = value.find("&", start)
            token = value[start:] if end == -1 else value[start:end]
            token = token.strip()
            if token:
                return token
        if value.startswith("gymcore:pass:"):
            token = value[len("gymcore:pass:") :].strip()
            if token:
                return token
    return value


def _resolve_pass(db: Session, raw_token: str) -> MemberPass:
    token = _normalize_pass_token(raw_token)
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Falta el token")
    pase = db.scalar(select(MemberPass).where(MemberPass.token == token))
    if pase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pase no encontrado")
    return pase


@router.get("/guest-pass", summary="Página pública del pase de invitado (sin login)")
def guest_pass(
    token: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    pase = _resolve_pass(db, token or "")
    now = datetime.now(UTC)
    if pase.status == "redeemed":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Este pase ya fue utilizado")
    if pase.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Este pase fue cancelado")
    if pase.status != "generated" or pase.expires_at is None or pase.expires_at < now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Este pase ha expirado")
    member = db.get(Member, pase.member_id)
    gym = (
        db.execute(
            text("SELECT name, logo_url FROM gyms WHERE id = :gid"),
            {"gid": str(pase.gym_id)},
        )
        .mappings()
        .first()
    )
    return {
        "token": pase.token,
        "pass_type": pase.pass_type,
        "gym": {
            "name": gym["name"] if gym else "Gimnasio",
            "logo_url": gym["logo_url"] if gym else None,
        },
        "inviter_name": member.full_name if member else None,
        "guest_name": pase.guest_name,
        "expires_at": pase.expires_at,
    }


@router.post("/passes/redeem", summary="Redime el pase en recepción (crea un lead)")
def redeem_pass(
    body: dict,
    ctx: CurrentGym = Depends(require_component("checkin")),
    db: Session = Depends(get_db),
) -> dict:
    pase = _resolve_pass(db, str(body.get("token") or ""))
    if pase.gym_id != ctx.gym["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pase no encontrado")
    now = datetime.now(UTC)
    if pase.status == "redeemed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El pase ya fue utilizado")
    if pase.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El pase fue cancelado")
    if pase.status != "generated" or pase.expires_at is None or pase.expires_at < now:
        pase.status = "expired"
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="El pase ha expirado")

    member = db.get(Member, pase.member_id)
    guest_name = pase.guest_name or "Invitado"

    from app.models import Lead

    lead = Lead(
        gym_id=ctx.gym["id"],
        full_name=guest_name,
        phone=pase.guest_phone,
        email=pase.guest_email,
        source="pase de invitado",
        status="nuevo",
        notes=f"Invitado por {member.full_name if member else 'un socio'} · pase de invitado",
    )
    db.add(lead)
    db.flush()

    pase.status = "redeemed"
    pase.redeemed_at = now
    pase.redeemed_by = ctx.user.sub
    pase.redeemed_lead_id = lead.id
    db.commit()

    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="pass_redeemed",
        entity_type="pass",
        entity_id=pase.id,
        metadata={"guest_name": guest_name},
    )
    db.commit()

    return {
        "ok": True,
        "pass_id": str(pase.id),
        "guest_name": guest_name,
        "inviter_name": member.full_name if member else None,
        "lead_id": str(lead.id),
    }
