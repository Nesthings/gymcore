"""Perfil y configuración del gimnasio (tenant) — por-tenant.

Incluye el perfil propio del gimnasio (`/gyms/me`), subida de logo, el resumen
operativo (`/gyms/me/summary`) y endpoints de plataforma (super-admin) para
listar gimnasios, invitaciones y usuarios.
"""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, CurrentUser, get_current_gym, require_roles
from app.core.storage import ALLOWED_IMAGE_EXTENSIONS, public_url, save_media, validate_extension
from app.db.session import get_db
from app.models import Gym, GymInvite, User
from app.schemas.gym import GymRead, GymUpdate

router = APIRouter(tags=["gyms"])


@router.get("/gyms/me", response_model=GymRead)
def my_gym(ctx: CurrentGym = Depends(get_current_gym), db: Session = Depends(get_db)) -> Gym:
    gym = db.get(Gym, ctx.gym["id"])
    if gym is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gimnasio no encontrado")
    return gym


@router.patch("/gyms/me", response_model=GymRead)
def update_my_gym(
    body: GymUpdate,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> Gym:
    gym = db.get(Gym, ctx.gym["id"])
    if gym is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gimnasio no encontrado")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(gym, field, value)
    db.commit()
    db.refresh(gym)
    return gym


@router.post("/gyms/me/logo", response_model=GymRead)
def upload_gym_logo(
    file: UploadFile = File(...),
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> Gym:
    gym = db.get(Gym, ctx.gym["id"])
    if gym is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gimnasio no encontrado")
    validate_extension(file.filename or "", ALLOWED_IMAGE_EXTENSIONS)
    content = file.file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen supera el límite de 5 MB",
        )
    rel = save_media(f"gyms/{gym.id}", "logo.png", content)
    gym.logo_url = public_url(rel)
    db.commit()
    db.refresh(gym)
    return gym


def gym_summary_data(db: Session, gym_id: str) -> dict:
    gid = gym_id
    today = "current_date"
    socios_activos = db.execute(
        text("SELECT COUNT(*) FROM members WHERE gym_id = :gid AND status = 'active'"),
        {"gid": gid},
    ).scalar()
    checkins_hoy = db.execute(
        text(
            "SELECT COUNT(*) FROM checkins WHERE gym_id = :gid "
            f"AND checked_at >= {today} AND checked_at < {today} + interval '1 day'"
        ),
        {"gid": gid},
    ).scalar()
    nuevas_membresias = db.execute(
        text(
            "SELECT COUNT(*) FROM member_memberships WHERE gym_id = :gid "
            "AND created_at >= date_trunc('month', now())"
        ),
        {"gid": gid},
    ).scalar()
    ingresos_mes = db.execute(
        text(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE gym_id = :gid "
            "AND status = 'paid' AND paid_at >= date_trunc('month', now())"
        ),
        {"gid": gid},
    ).scalar()
    morosidad = db.execute(
        text(
            "SELECT COUNT(*) FROM members m "
            "WHERE m.gym_id = :gid AND m.status = 'active' AND NOT EXISTS ("
            "  SELECT 1 FROM member_memberships mm WHERE mm.member_id = m.id "
            "  AND mm.status IN ('active', 'expiring')"
            ")"
        ),
        {"gid": gid},
    ).scalar()
    socios_en_riesgo = db.execute(
        text(
            "SELECT COUNT(*) FROM members m WHERE m.gym_id = :gid AND m.status = 'active' "
            "AND ((SELECT MAX(c.checked_at) FROM checkins c WHERE c.member_id = m.id) IS NULL "
            "OR (SELECT MAX(c.checked_at) FROM checkins c WHERE c.member_id = m.id) "
            "< now() - interval '14 days')"
        ),
        {"gid": gid},
    ).scalar()
    return {
        "socios_activos": socios_activos or 0,
        "checkins_hoy": checkins_hoy or 0,
        "nuevas_membresias": nuevas_membresias or 0,
        "ingresos_mes": float(ingresos_mes or 0),
        "morosidad": morosidad or 0,
        "socios_en_riesgo": socios_en_riesgo or 0,
    }


@router.get("/gyms/me/summary", summary="Resumen operativo del gimnasio")
def gym_summary(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    return gym_summary_data(db, str(ctx.gym["id"]))


# --------------------------------------------------------------------------
# Plataforma (super-admin)
# --------------------------------------------------------------------------


@router.get(
    "/gyms", response_model=list[GymRead], dependencies=[Depends(require_roles("super-admin"))]
)
def platform_list_gyms(
    _user: CurrentUser = Depends(require_roles("super-admin")),
    db: Session = Depends(get_db),
) -> list[Gym]:
    return list(db.scalars(select(Gym).order_by(Gym.created_at.desc())))


@router.get(
    "/gyms/{gym_id}/summary",
    dependencies=[Depends(require_roles("super-admin"))],
)
def platform_gym_summary(gym_id: str, db: Session = Depends(get_db)) -> dict:
    gym = db.get(Gym, gym_id)
    if gym is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gimnasio no encontrado")
    branches = db.execute(
        text("SELECT COUNT(*) FROM gym_branches WHERE gym_id = :gid"), {"gid": gym_id}
    ).scalar()
    staff = db.execute(
        text("SELECT COUNT(*) FROM users WHERE gym_id = :gid"), {"gid": gym_id}
    ).scalar()
    members = db.execute(
        text("SELECT COUNT(*) FROM members WHERE gym_id = :gid AND status = 'active'"),
        {"gid": gym_id},
    ).scalar()
    memberships = db.execute(
        text(
            "SELECT COUNT(*) FROM member_memberships WHERE gym_id = :gid "
            "AND status IN ('active', 'expiring')"
        ),
        {"gid": gym_id},
    ).scalar()
    payments = db.execute(
        text(
            "SELECT COUNT(*) FROM payments WHERE gym_id = :gid AND status = 'paid'"
        ),
        {"gid": gym_id},
    ).scalar()
    return {
        "id": str(gym.id),
        "name": gym.name,
        "branches": branches or 0,
        "staff": staff or 0,
        "members": members or 0,
        "memberships": memberships or 0,
        "payments": payments or 0,
    }


@router.get(
    "/gyms/{gym_id}/events",
    dependencies=[Depends(require_roles("super-admin"))],
)
def platform_gym_events(gym_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT event_type, amount, notes, created_at FROM gym_subscription_events "
                "WHERE gym_id = :gid ORDER BY created_at DESC LIMIT 50"
            ),
            {"gid": gym_id},
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]


@router.post(
    "/gyms/{gym_id}/subscription",
    dependencies=[Depends(require_roles("super-admin"))],
)
def platform_set_subscription(gym_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    gym = db.get(Gym, gym_id)
    if gym is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gimnasio no encontrado")
    new_status = body.get("subscription_status")
    if new_status not in ("trial", "active", "suspended", "cancelled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Estado inválido")
    gym.subscription_status = new_status
    db.execute(
        text(
            "INSERT INTO gym_subscription_events (gym_id, event_type, notes) "
            "VALUES (:gid, :et, :notes)"
        ),
        {"gid": gym_id, "et": new_status, "notes": body.get("notes")},
    )
    db.commit()
    return {"id": str(gym.id), "subscription_status": gym.subscription_status}


@router.post(
    "/platform/gym-invites",
    dependencies=[Depends(require_roles("super-admin"))],
)
def platform_create_invite(body: dict, db: Session = Depends(get_db)) -> dict:
    import secrets
    from datetime import UTC, datetime, timedelta

    token = secrets.token_urlsafe(32)
    expires_in_days = body.get("expires_in_days") or 30
    invite = GymInvite(
        token=token,
        gym_name=body.get("gym_name"),
        contact_email=body.get("contact_email"),
        expires_at=datetime.now(UTC) + timedelta(days=int(expires_in_days)),
        status="pending",
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return {
        "id": str(invite.id),
        "token": token,
        "invite_link": f"/create-gym?token={token}",
        "gym_name": invite.gym_name,
        "contact_email": invite.contact_email,
        "status": invite.status,
        "expires_at": invite.expires_at,
        "created_at": invite.created_at,
    }


@router.get(
    "/platform/gym-invites",
    dependencies=[Depends(require_roles("super-admin"))],
)
def platform_list_invites(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(
        text("SELECT * FROM gym_invites ORDER BY created_at DESC LIMIT 100")
    ).mappings().all()
    out = []
    for r in rows:
        out.append(
            {
                "id": str(r["id"]),
                "token": r["token"],
                "invite_link": f"/create-gym?token={r['token']}",
                "gym_name": r["gym_name"],
                "contact_email": r["contact_email"],
                "status": r["status"],
                "used_at": r["used_at"],
                "expires_at": r["expires_at"],
                "created_at": r["created_at"],
            }
        )
    return out


@router.post(
    "/platform/gym-invites/{invite_id}/revoke",
    dependencies=[Depends(require_roles("super-admin"))],
)
def platform_revoke_invite(invite_id: str, db: Session = Depends(get_db)) -> dict:
    invite = db.get(GymInvite, invite_id)
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invitación no encontrada"
        )
    invite.status = "revoked"
    db.commit()
    return {"id": str(invite.id), "status": invite.status}


@router.get(
    "/platform/users",
    dependencies=[Depends(require_roles("super-admin"))],
)
def platform_list_users(
    gym_id: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    sql = "SELECT u.*, g.name AS gym_name FROM users u JOIN gyms g ON g.id = u.gym_id"
    where = []
    params: dict = {}
    if gym_id:
        where.append("u.gym_id = :gid")
        params["gid"] = gym_id
    if search:
        where.append("(LOWER(u.full_name) LIKE :s OR LOWER(u.email) LIKE :s)")
        params["s"] = f"%{search.lower()}%"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY u.created_at DESC LIMIT 100"
    rows = db.execute(text(sql), params).mappings().all()
    return [
        {
            "id": str(r["id"]),
            "gym_id": str(r["gym_id"]),
            "gym_name": r["gym_name"],
            "full_name": r["full_name"],
            "email": r["email"],
            "role": r["role"],
            "is_active": r["is_active"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@router.post(
    "/platform/staff/{user_id}/reset-password",
    dependencies=[Depends(require_roles("super-admin"))],
)
def platform_reset_staff_password(user_id: str, body: dict, db: Session = Depends(get_db)) -> dict:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario inválido"
        ) from None
    user = db.get(User, uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    new_password = body.get("new_password")
    if not new_password or len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 8 caracteres",
        )
    from app.core.security import hash_password

    user.password_hash = hash_password(new_password)
    db.commit()
    return {"id": str(user.id), "detail": "Contraseña restablecida"}
