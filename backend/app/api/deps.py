"""Dependencias de autenticación y control de acceso multi-tenant."""

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.permissions import effective_components
from app.core.security import get_token_payload
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

VALID_ROLES = {"super-admin", "admin", "recepcion", "coach"}

STAFF_ROLES = {"admin", "recepcion", "coach"}


class CurrentUser:
    def __init__(self, sub: str, role: str, gym_id: str | None, branch_id: str | None):
        self.sub = sub
        self.role = role
        self.gym_id = gym_id
        self.branch_id = branch_id


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la credencial",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = get_token_payload(token)
    except Exception:
        raise credentials_exception from None

    sub = payload.get("sub")
    role = payload.get("role")
    if not sub or not role or role not in VALID_ROLES:
        raise credentials_exception

    return CurrentUser(
        sub=sub,
        role=role,
        gym_id=payload.get("gym_id"),
        branch_id=payload.get("branch_id"),
    )


def require_roles(*roles: str):
    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para esta acción",
            )
        return user

    return dependency


def require_staff(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role not in STAFF_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo personal del gimnasio",
        )
    if not user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token sin gimnasio asociado",
        )
    return user


def require_gym_roles(*roles: str):
    """Restringe una ruta tenant a roles específicos del staff.

    Combina la validación de suscripción (get_current_gym) con el chequeo
    de rol, devolviendo el contexto de gimnasio ya validado.
    """

    def dependency(ctx: CurrentGym = Depends(get_current_gym)) -> CurrentGym:
        if ctx.user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para esta acción",
            )
        return ctx

    return dependency


def require_component(*components: str):
    """Restringe una ruta a staff con acceso a (al menos) uno de los
    componentes dados (modelo de permisos por componente).

    El acceso efectivo = default del rol + overrides por usuario en la tabla
    `user_component_permissions`.
    """

    def dependency(
        ctx: CurrentGym = Depends(get_current_gym),
        db: Session = Depends(get_db),
    ) -> CurrentGym:
        allowed = effective_components(db, ctx.user.sub, ctx.user.role)
        if not allowed.intersection(components):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a este módulo",
            )
        return ctx

    return dependency


@dataclass
class CurrentGym:
    user: CurrentUser
    gym: dict


def get_current_gym(
    user: CurrentUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> CurrentGym:
    """Valida que el gimnasio del usuario tenga una suscripción activa.

    Cada request del gimnasio valida `subscription_status`. Los gimnasios
    suspendidos o cancelados quedan bloqueados para el staff.
    """
    row = (
        db.execute(
            text("SELECT id, name, subscription_status FROM gyms WHERE id = :gid"),
            {"gid": user.gym_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Gimnasio no encontrado",
        )
    if row["subscription_status"] not in ("active", "trial"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Suscripción del gimnasio no activa",
        )
    return CurrentGym(user=user, gym=dict(row))
