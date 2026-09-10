"""Endpoints de autenticación: staff y super-admin.

Incluye: login unificado (detecta identidad staff/super-admin), identidad del
token actual, recuperación de contraseña del staff.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, CurrentUser, get_current_gym, get_current_user
from app.core.config import settings
from app.core.ratelimit import login_limiter, twofa_limiter
from app.core.security import (
    create_access_token,
    create_reset_token,
    create_twofa_challenge_token,
    get_token_payload,
    hash_password,
    verify_password,
)
from app.core.totp import build_otpauth_uri, generate_secret, qr_data_uri, verify_code
from app.db.session import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    ResetPasswordRequest,
    TwoFactorConfirmRequest,
    TwoFactorRequiredResponse,
    TwoFactorSetupResponse,
    TwoFactorStatusResponse,
    TwoFactorVerifyRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _staff_login(
    db: Session, identifier: str, password: str
) -> LoginResponse | TwoFactorRequiredResponse:
    row = (
        db.execute(
            text(
                "SELECT id, gym_id, branch_id, role, password_hash, is_active, "
                "totp_enabled FROM users WHERE LOWER(email) = LOWER(:email)"
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
    if row["totp_enabled"]:
        # Paso 1 OK: se entrega el challenge de 2FA de corta duración.
        return TwoFactorRequiredResponse(
            challenge_token=create_twofa_challenge_token(str(row["id"]), role=row["role"]),
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


def _super_admin_login(
    db: Session, identifier: str, password: str
) -> LoginResponse | TwoFactorRequiredResponse:
    row = (
        db.execute(
            text(
                "SELECT id, password_hash, is_active, totp_enabled FROM super_admins "
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
    if row["totp_enabled"]:
        # Paso 1 OK: password válido. Se entrega un challenge de corta duración
        # que debe completarse con el código TOTP.
        return TwoFactorRequiredResponse(
            challenge_token=create_twofa_challenge_token(str(row["id"]), role="super-admin"),
        )
    db.execute(
        text("UPDATE super_admins SET last_login_at = now() WHERE id = :uid"), {"uid": row["id"]}
    )
    db.commit()
    token = create_access_token(subject=str(row["id"]), role="super-admin")
    return LoginResponse(access_token=token, role="super-admin", sub=str(row["id"]))


@router.post(
    "/login",
    summary="Login por correo y contraseña (identifica gimnasio y rol automáticamente)",
)
def login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse | TwoFactorRequiredResponse:
    """Autentica con correo + contraseña y detecta la identidad:
    staff de gimnasio (identifica `gym_id`, `branch_id` y rol) o super-admin.
    Si la cuenta tiene 2FA activo, devuelve un challenge a completar en
    `/auth/2fa/verify`."""
    client_ip = request.client.host if request.client else "unknown"
    rl_key = f"{body.identifier.strip().lower()}:{client_ip}"
    if not login_limiter.allow(rl_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Intenta de nuevo en un minuto.",
        )
    for fn in (_staff_login, _super_admin_login):
        try:
            resp = fn(db, body.identifier, body.password)
            login_limiter.reset(rl_key)
            return resp
        except HTTPException:
            continue
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")


@router.post(
    "/login/super-admin",
    summary="Login de super-admin (dueño del producto)",
)
def login_super_admin(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse | TwoFactorRequiredResponse:
    client_ip = request.client.host if request.client else "unknown"
    rl_key = f"{body.identifier.strip().lower()}:{client_ip}"
    if not login_limiter.allow(rl_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Intenta de nuevo en un minuto.",
        )
    try:
        resp = _super_admin_login(db, body.identifier, body.password)
        login_limiter.reset(rl_key)
        return resp
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        ) from None


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


# ---------------------------------------------------------------------------
# 2FA (TOTP, compatible con Microsoft Authenticator)
# ---------------------------------------------------------------------------


@router.post(
    "/2fa/verify",
    response_model=LoginResponse,
    summary="Paso 2 del login (staff o super-admin): valida el código TOTP",
)
def verify_2fa(
    body: TwoFactorVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse:
    client_ip = request.client.host if request.client else "unknown"
    if not twofa_limiter.allow(f"{body.challenge_token}:{client_ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos de verificación. Vuelve a iniciar sesión.",
        )
    try:
        payload = get_token_payload(body.challenge_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El challenge de 2FA es inválido o expiró. Vuelve a iniciar sesión.",
        ) from None
    if payload.get("purpose") != "2fa":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El challenge de 2FA es inválido o expiró. Vuelve a iniciar sesión.",
        )
    challenge_role = payload.get("role")

    if challenge_role == "super-admin":
        row = (
            db.execute(
                text(
                    "SELECT id, totp_secret, totp_enabled FROM super_admins "
                    "WHERE id = :uid AND is_active = true"
                ),
                {"uid": payload.get("sub")},
            )
            .mappings()
            .first()
        )
        if row is None or not row["totp_enabled"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="El 2FA no está habilitado para esta cuenta",
            )
        if not verify_code(row["totp_secret"] or "", body.code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="El código de verificación es incorrecto",
            )
        db.execute(
            text("UPDATE super_admins SET last_login_at = now() WHERE id = :uid"),
            {"uid": row["id"]},
        )
        db.commit()
        return LoginResponse(
            access_token=create_access_token(subject=str(row["id"]), role="super-admin"),
            role="super-admin",
            sub=str(row["id"]),
        )

    row = (
        db.execute(
            text(
                "SELECT id, gym_id, branch_id, role, totp_secret, totp_enabled "
                "FROM users WHERE id = :uid AND is_active = true"
            ),
            {"uid": payload.get("sub")},
        )
        .mappings()
        .first()
    )
    if row is None or not row["totp_enabled"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El 2FA no está habilitado para esta cuenta",
        )
    if not verify_code(row["totp_secret"] or "", body.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El código de verificación es incorrecto",
        )
    db.execute(
        text("UPDATE users SET last_login_at = now() WHERE id = :uid"),
        {"uid": row["id"]},
    )
    db.commit()
    return LoginResponse(
        access_token=create_access_token(
            subject=str(row["id"]),
            role=row["role"],
            gym_id=str(row["gym_id"]),
            branch_id=str(row["branch_id"]) if row["branch_id"] else None,
        ),
        role=row["role"],
        sub=str(row["id"]),
        gym_id=str(row["gym_id"]),
        branch_id=str(row["branch_id"]) if row["branch_id"] else None,
    )


@router.get(
    "/super-admin/2fa/status",
    response_model=TwoFactorStatusResponse,
    summary="Estado del 2FA del super-admin",
)
def super_admin_2fa_status(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorStatusResponse:
    if user.role != "super-admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    enabled = db.execute(
        text("SELECT totp_enabled FROM super_admins WHERE id = :uid"),
        {"uid": user.sub},
    ).scalar()
    return TwoFactorStatusResponse(totp_enabled=bool(enabled))


@router.post(
    "/super-admin/2fa/setup",
    response_model=TwoFactorSetupResponse,
    summary="Inicia la configuración del 2FA (genera secreto + QR)",
)
def super_admin_2fa_setup(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorSetupResponse:
    if user.role != "super-admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    email = db.execute(
        text("SELECT email FROM super_admins WHERE id = :uid"),
        {"uid": user.sub},
    ).scalar()
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta no encontrada")
    secret = generate_secret()
    uri = build_otpauth_uri(email, secret)
    # Se guarda el secreto ANTES de confirmar para validarlo al escanear el QR.
    db.execute(
        text("UPDATE super_admins SET totp_secret = :s WHERE id = :uid"),
        {"s": secret, "uid": user.sub},
    )
    db.commit()
    return TwoFactorSetupResponse(secret=secret, otpauth_uri=uri, qr_data=qr_data_uri(uri))


@router.post(
    "/super-admin/2fa/confirm",
    response_model=TwoFactorStatusResponse,
    summary="Confirma el 2FA validando un primer código TOTP",
)
def super_admin_2fa_confirm(
    body: TwoFactorConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorStatusResponse:
    if user.role != "super-admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    row = (
        db.execute(
            text("SELECT totp_secret FROM super_admins WHERE id = :uid"),
            {"uid": user.sub},
        )
        .mappings()
        .first()
    )
    if row is None or not row["totp_secret"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primero inicia la configuración del 2FA",
        )
    if not verify_code(row["totp_secret"], body.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de verificación es incorrecto",
        )
    db.execute(
        text("UPDATE super_admins SET totp_enabled = true WHERE id = :uid"),
        {"uid": user.sub},
    )
    db.commit()
    return TwoFactorStatusResponse(totp_enabled=True)


@router.post(
    "/super-admin/2fa/disable",
    response_model=TwoFactorStatusResponse,
    summary="Desactiva el 2FA (requiere código TOTP actual)",
)
def super_admin_2fa_disable(
    body: TwoFactorConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorStatusResponse:
    if user.role != "super-admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    row = (
        db.execute(
            text("SELECT totp_secret, totp_enabled FROM super_admins WHERE id = :uid"),
            {"uid": user.sub},
        )
        .mappings()
        .first()
    )
    if row is None or not row["totp_enabled"]:
        return TwoFactorStatusResponse(totp_enabled=False)
    if not verify_code(row["totp_secret"] or "", body.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de verificación es incorrecto",
        )
    db.execute(
        text("UPDATE super_admins SET totp_enabled = false WHERE id = :uid"),
        {"uid": user.sub},
    )
    db.commit()
    return TwoFactorStatusResponse(totp_enabled=False)


# ---------------------------------------------------------------------------
# 2FA del staff de gimnasio (TOTP) — solo para el rol admin
# ---------------------------------------------------------------------------


def _require_admin_staff(user: CurrentUser, db: Session) -> dict:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")
    row = (
        db.execute(
            text("SELECT id, email, totp_secret, totp_enabled FROM users WHERE id = :uid"),
            {"uid": user.sub},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta no encontrada")
    return dict(row)


@router.get(
    "/me/2fa/status",
    response_model=TwoFactorStatusResponse,
    summary="Estado del 2FA del usuario autenticado (staff admin)",
)
def me_2fa_status(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorStatusResponse:
    if user.role == "super-admin":
        enabled = db.execute(
            text("SELECT totp_enabled FROM super_admins WHERE id = :uid"),
            {"uid": user.sub},
        ).scalar()
        return TwoFactorStatusResponse(totp_enabled=bool(enabled))
    row = _require_admin_staff(user, db)
    return TwoFactorStatusResponse(totp_enabled=bool(row["totp_enabled"]))


@router.post(
    "/me/2fa/setup",
    response_model=TwoFactorSetupResponse,
    summary="Inicia la configuración del 2FA del admin del gimnasio",
)
def me_2fa_setup(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorSetupResponse:
    if user.role == "super-admin":
        email = db.execute(
            text("SELECT email FROM super_admins WHERE id = :uid"),
            {"uid": user.sub},
        ).scalar()
        secret = generate_secret()
        uri = build_otpauth_uri(email, secret)
        db.execute(
            text("UPDATE super_admins SET totp_secret = :s WHERE id = :uid"),
            {"s": secret, "uid": user.sub},
        )
        db.commit()
        return TwoFactorSetupResponse(secret=secret, otpauth_uri=uri, qr_data=qr_data_uri(uri))
    row = _require_admin_staff(user, db)
    secret = generate_secret()
    uri = build_otpauth_uri(row["email"], secret)
    db.execute(
        text("UPDATE users SET totp_secret = :s WHERE id = :uid"),
        {"s": secret, "uid": user.sub},
    )
    db.commit()
    return TwoFactorSetupResponse(secret=secret, otpauth_uri=uri, qr_data=qr_data_uri(uri))


@router.post(
    "/me/2fa/confirm",
    response_model=TwoFactorStatusResponse,
    summary="Confirma el 2FA validando un primer código TOTP",
)
def me_2fa_confirm(
    body: TwoFactorConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorStatusResponse:
    if user.role == "super-admin":
        row = (
            db.execute(
                text("SELECT totp_secret FROM super_admins WHERE id = :uid"),
                {"uid": user.sub},
            )
            .mappings()
            .first()
        )
    else:
        row = _require_admin_staff(user, db)
    if row is None or not row["totp_secret"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primero inicia la configuración del 2FA",
        )
    if not verify_code(row["totp_secret"], body.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de verificación es incorrecto",
        )
    table = "super_admins" if user.role == "super-admin" else "users"
    db.execute(
        text(f"UPDATE {table} SET totp_enabled = true WHERE id = :uid"),
        {"uid": user.sub},
    )
    db.commit()
    return TwoFactorStatusResponse(totp_enabled=True)


@router.post(
    "/me/2fa/disable",
    response_model=TwoFactorStatusResponse,
    summary="Desactiva el 2FA (requiere código TOTP actual)",
)
def me_2fa_disable(
    body: TwoFactorConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorStatusResponse:
    if user.role == "super-admin":
        row = (
            db.execute(
                text("SELECT totp_secret, totp_enabled FROM super_admins WHERE id = :uid"),
                {"uid": user.sub},
            )
            .mappings()
            .first()
        )
    else:
        row = _require_admin_staff(user, db)
    if row is None or not row["totp_enabled"]:
        return TwoFactorStatusResponse(totp_enabled=False)
    if not verify_code(row["totp_secret"] or "", body.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de verificación es incorrecto",
        )
    table = "super_admins" if user.role == "super-admin" else "users"
    db.execute(
        text(f"UPDATE {table} SET totp_enabled = false WHERE id = :uid"),
        {"uid": user.sub},
    )
    db.commit()
    return TwoFactorStatusResponse(totp_enabled=False)
