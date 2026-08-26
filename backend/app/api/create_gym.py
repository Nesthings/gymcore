"""Alta pública de un gimnasio vía invitación del super-admin.

Crea el gimnasio, la sucursal principal y el primer admin (setup wizard).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.models import Gym, GymBranch
from app.schemas.gym import CreateGymRequest, CreateGymResponse

router = APIRouter(tags=["onboarding"])


@router.post(
    "/create-gym",
    response_model=CreateGymResponse,
    summary="Crea un gimnasio con su admin inicial (token de invitación)",
)
def create_gym(body: CreateGymRequest, db: Session = Depends(get_db)) -> CreateGymResponse:
    invite = (
        db.execute(
            text(
                "SELECT id, status, expires_at, contact_email FROM gym_invites WHERE token = :token"
            ),
            {"token": body.invite_token},
        )
        .mappings()
        .first()
    )
    if invite is None or invite["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitación inválida o ya utilizada",
        )
    if invite["expires_at"] < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La invitación ha expirado",
        )

    email = body.admin_email.strip().lower()
    existing = db.execute(
        text("SELECT 1 FROM users WHERE LOWER(email) = :email"), {"email": email}
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese email",
        )

    gym = Gym(
        name=body.name.strip(),
        contact_name=body.admin_name.strip(),
        contact_email=email,
        setup_completed=False,
    )
    db.add(gym)
    db.flush()

    branch = GymBranch(gym_id=gym.id, name="Sucursal principal")
    db.add(branch)
    db.flush()

    db.execute(
        text(
            "INSERT INTO users (id, gym_id, branch_id, role, full_name, email, password_hash) "
            "VALUES (gen_random_uuid(), :gid, :bid, 'admin', :name, :email, :hash)"
        ),
        {
            "gid": gym.id,
            "bid": branch.id,
            "name": body.admin_name.strip(),
            "email": email,
            "hash": hash_password(body.admin_password),
        },
    )
    db.execute(
        text(
            "INSERT INTO gym_subscription_events (gym_id, event_type, notes) "
            "VALUES (:gid, 'trial_started', 'Alta inicial')"
        ),
        {"gid": gym.id},
    )
    db.execute(
        text("UPDATE gym_invites SET status = 'used', used_at = now() WHERE id = :iid"),
        {"iid": invite["id"]},
    )
    db.commit()

    admin = (
        db.execute(text("SELECT id FROM users WHERE LOWER(email) = :email"), {"email": email})
        .mappings()
        .first()
    )
    token = create_access_token(
        subject=str(admin["id"]), role="admin", gym_id=str(gym.id), branch_id=str(branch.id)
    )
    return CreateGymResponse(access_token=token, sub=str(admin["id"]), gym_id=str(gym.id))
