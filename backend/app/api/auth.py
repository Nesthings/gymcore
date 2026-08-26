"""Endpoints de autenticación: staff y super-admin.

Incluye: login unificado (detecta identidad staff/super-admin), identidad del
token actual, recuperación de contraseña del staff.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, CurrentUser, get_current_gym, get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_reset_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    ResetPasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _staff_login(db: Session, identifier: str, password: str) -> LoginResponse:
    row = (
        db.execute(
            text(
                "SELECT id, gym_id, branch_id, role, password_hash, is_active "
                "FROM users WHERE LOWER(email) = LOWER(:email)"
            ),
            {"email": identifier},
        )
        .mappings()
        .first()
    )
    if row is None or not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    if not verify_password(password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    db.execute(text("UPDATE users SET last_login_at = now() WHERE id = :uid"), {"uid": row["id"]})
    db.commit()
    token = create_access_token(
        subject=str(row["id"]),
        role=row["role"],
        gym_id=str(row["gym_id"]),
        branch_id=str(row["branch_id"]) if row["branch_id"] else None,
    )
    return LoginResponse(
        access_token=token,
        role=row["role"],
        sub=str(row["id"]),
        gym_id=str(row["gym_id"]),
        branch_id=str(row["branch_id"]) if row["branch_id"] else None,
    )


def _super_admin_login(db: Session, identifier: str, password: str) -> LoginResponse:
    row = (
        db.execute(
            text(
                "SELECT id, password_hash, is_active FROM super_admins "
                "WHERE LOWER(email) = LOWER(:email)"
            ),
            {"email": identifier},
        )
        .mappings()
        .first()
    )
    if row is None or not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    if not verify_password(password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    db.execute(
        text("UPDATE super_admins SET last_login_at = now() WHERE id = :uid"), {"uid": row["id"]}
    )
    db.commit()
    token = create_access_token(subject=str(row["id"]), role="super-admin")
    return LoginResponse(access_token=token, role="super-admin", sub=str(row["id"]))


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login por correo y contraseña (identifica gimnasio y rol automáticamente)",
)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    """Autentica con correo + contraseña y detecta la identidad:
    staff de gimnasio (identifica `gym_id`, `branch_id` y rol) o super-admin."""
    for fn in (_staff_login, _super_admin_login):
        try:
            return fn(db, body.identifier, body.password)
        except HTTPException:
            continue
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")


@router.post(
    "/login/super-admin",
    response_model=LoginResponse,
    summary="Login de super-admin (dueño del producto)",
)
def login_super_admin(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    return _super_admin_login(db, body.identifier, body.password)


@router.get("/me", response_model=MeResponse, summary="Identidad del token actual")
def me(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> MeResponse:
    full_name = None
    photo_url = None
    setup_completed = None
    if user.role == "super-admin":
        row = (
            db.execute(
                text("SELECT full_name, photo_url FROM super_admins WHERE id = :uid"),
                {"uid": user.sub},
            )
            .mappings()
            .first()
        )
        if row:
            full_name, photo_url = row["full_name"], row["photo_url"]
    elif user.role in ("admin", "recepcion", "coach"):
        row = (
            db.execute(
                text("SELECT full_name, photo_url FROM users WHERE id = :uid"),
                {"uid": user.sub},
            )
            .mappings()
            .first()
        )
        if row:
            full_name, photo_url = row["full_name"], row["photo_url"]
        if user.gym_id:
            setup_completed = db.execute(
                text("SELECT setup_completed FROM gyms WHERE id = :gid"),
                {"gid": user.gym_id},
            ).scalar()
    return MeResponse(
        sub=user.sub,
        role=user.role,
        gym_id=user.gym_id,
        branch_id=user.branch_id,
        full_name=full_name,
        photo_url=photo_url,
        setup_completed=setup_completed,
    )


@router.get(
    "/gym-check",
    summary="Demo de middleware multi-tenant: valida suscripción del gimnasio",
)
def gym_check(ctx: CurrentGym = Depends(get_current_gym)) -> dict:
    return {"gym_id": ctx.gym["id"], "status": ctx.gym["subscription_status"]}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    """Solicita recuperación de contraseña para un staff de gimnasio.

    En dev, el token de reset se devuelve en la respuesta (no hay servicio de
    email aún). La respuesta es genérica para no revelar emails existentes.
    """
    user = (
        db.execute(
            text("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) AND is_active = true"),
            {"email": body.email},
        )
        .mappings()
        .first()
    )

    reset_token = None
    if user is not None:
        reset_token, expires = create_reset_token()
        db.execute(
            text(
                "INSERT INTO password_reset_tokens (user_id, token, expires_at) "
                "VALUES (:uid, :token, :expires)"
            ),
            {
                "uid": user["id"],
                "token": reset_token,
                "expires": expires,
            },
        )
        db.commit()

    if settings.env == "development" and reset_token is not None:
        return ForgotPasswordResponse(
            message="Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
            reset_token=reset_token,
        )
    return ForgotPasswordResponse(
        message="Si el correo existe, recibirás un enlace para restablecer tu contraseña."
    )


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> None:
    reset = (
        db.execute(
            text(
                "SELECT id, user_id, expires_at FROM password_reset_tokens "
                "WHERE token = :token AND used_at IS NULL"
            ),
            {"token": body.token},
        )
        .mappings()
        .first()
    )

    if reset is None or reset["expires_at"] < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de recuperación inválido o expirado",
        )

    db.execute(
        text("UPDATE users SET password_hash = :hash WHERE id = :uid"),
        {"hash": hash_password(body.password), "uid": reset["user_id"]},
    )
    db.execute(
        text("UPDATE password_reset_tokens SET used_at = now() WHERE id = :rid"),
        {"rid": reset["id"]},
    )
    db.commit()
