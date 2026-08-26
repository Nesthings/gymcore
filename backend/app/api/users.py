"""CRUD de personal del gimnasio — por-tenant, solo admin para mutar.

Incluye los endpoints de perfil propio (`/users/me`) y los accesos por
componente (paso de accesos del wizard).
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import (
    CurrentGym,
    CurrentUser,
    get_current_gym,
    require_component,
    require_staff,
)
from app.core.events import record_audit
from app.core.permissions import (
    COMPONENTS,
    component_catalog,
    default_components,
    effective_components,
    get_overrides,
)
from app.core.security import hash_password, verify_password
from app.core.storage import ALLOWED_IMAGE_EXTENSIONS, public_url, save_media, validate_extension
from app.db.session import get_db
from app.models import GymBranch, User, UserComponentPermission
from app.schemas.staff import ProfileUpdate, UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _validate_reports_to(db: Session, gym_id: str, reports_to: str) -> None:
    manager = db.scalar(select(User).where(User.id == reports_to, User.gym_id == gym_id))
    if manager is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El responsable (reports_to) debe pertenecer al mismo gimnasio",
        )


def _with_branch_names(db: Session, users: list[User]) -> list[dict]:
    if not users:
        return []
    branch_ids = {u.branch_id for u in users if u.branch_id}
    branches = (
        dict(
            db.execute(
                select(GymBranch.id, GymBranch.name).where(GymBranch.id.in_(branch_ids))
            ).all()
        )
        if branch_ids
        else {}
    )
    out = []
    for u in users:
        data = UserRead.model_validate(u).model_dump()
        data["branch_name"] = branches.get(u.branch_id)
        out.append(data)
    return out


@router.get("", response_model=list[UserRead])
def list_users(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    stmt = (
        select(User)
        .where(User.gym_id == ctx.gym["id"])
        .order_by(User.created_at)
        .limit(limit)
        .offset(offset)
    )
    return _with_branch_names(db, list(db.scalars(stmt)))


@router.get("/me", response_model=UserRead, summary="Perfil propio del staff")
def my_profile(
    me: CurrentUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, me.sub)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return _with_branch_names(db, [user])[0]


@router.patch("/me", response_model=UserRead, summary="Actualiza tu perfil / contraseña")
def update_my_profile(
    body: ProfileUpdate,
    me: CurrentUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, me.sub)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if body.new_password is not None:
        if not body.current_password or not verify_password(
            body.current_password, user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña actual no es correcta",
            )
        user.password_hash = hash_password(body.new_password)

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.phone is not None:
        user.phone = body.phone
    for field in ("job_title", "description"):
        value = getattr(body, field)
        if value is not None:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return _with_branch_names(db, [user])[0]


def _get_user_or_404(db: Session, gym_id: str, user_id: str) -> User:
    user = db.scalar(select(User).where(User.id == user_id, User.gym_id == gym_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    return _with_branch_names(db, [_get_user_or_404(db, ctx.gym["id"], user_id)])[0]


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    ctx: CurrentGym = Depends(require_component("configuracion")),
    db: Session = Depends(get_db),
) -> dict:
    email = body.email.strip().lower()
    exists = db.scalar(select(User).where(User.gym_id == ctx.gym["id"], User.email == email))
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email en el gimnasio",
        )
    data = body.model_dump(exclude={"password"})
    data["email"] = email
    data["password_hash"] = hash_password(body.password)
    if data.get("reports_to"):
        _validate_reports_to(db, ctx.gym["id"], str(data["reports_to"]))
    user = User(gym_id=ctx.gym["id"], **data)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email duplicado") from exc
    db.refresh(user)
    return _with_branch_names(db, [user])[0]


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    body: UserUpdate,
    ctx: CurrentGym = Depends(require_component("configuracion")),
    db: Session = Depends(get_db),
) -> dict:
    user = _get_user_or_404(db, ctx.gym["id"], user_id)
    data = body.model_dump(exclude_unset=True, exclude={"password"})
    if data.get("email"):
        data["email"] = data["email"].strip().lower()
    if data.get("reports_to"):
        _validate_reports_to(db, ctx.gym["id"], str(data["reports_to"]))
    for field, value in data.items():
        setattr(user, field, value)
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email duplicado") from exc
    db.refresh(user)
    return _with_branch_names(db, [user])[0]


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: str,
    ctx: CurrentGym = Depends(require_component("configuracion")),
    db: Session = Depends(get_db),
) -> None:
    """Desactiva el usuario (soft-delete via is_active)."""
    user = _get_user_or_404(db, ctx.gym["id"], user_id)
    user.is_active = False
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="user_deactivated",
        entity_type="user",
        entity_id=user.id,
    )
    db.commit()


@router.post(
    "/{user_id}/photo",
    response_model=UserRead,
    summary="Sube la foto de perfil del staff",
)
def upload_user_photo(
    user_id: str,
    file: UploadFile = File(...),
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> dict:
    user = _get_user_or_404(db, ctx.gym["id"], user_id)
    if ctx.user.role != "admin" and str(user.id) != ctx.user.sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para esta acción",
        )
    validate_extension(file.filename or "", ALLOWED_IMAGE_EXTENSIONS)
    content = file.file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen supera el límite de 5 MB",
        )
    rel = save_media(f"users/{user.id}", "avatar.jpg", content)
    user.photo_url = public_url(rel)
    db.commit()
    db.refresh(user)
    return _with_branch_names(db, [user])[0]


@router.get("/me/components", summary="Componentes efectivos del staff autenticado")
def my_components(
    me: CurrentUser = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    return {"components": sorted(effective_components(db, me.sub, me.role))}


def _user_components_row(db: Session, user: User) -> dict:
    overrides = get_overrides(db, str(user.id))
    return {
        "user_id": user.id,
        "role": user.role,
        "catalog": component_catalog(),
        "defaults": sorted(default_components(user.role)),
        "overrides": overrides,
        "effective": sorted(effective_components(db, str(user.id), user.role)),
    }


@router.get("/{user_id}/components", summary="Accesos a componentes de un usuario (admin)")
def user_components(
    user_id: str,
    ctx: CurrentGym = Depends(require_component("configuracion")),
    db: Session = Depends(get_db),
) -> dict:
    user = _get_user_or_404(db, ctx.gym["id"], user_id)
    return _user_components_row(db, user)


class ComponentOverrides(BaseModel):
    overrides: dict[str, bool] = Field(
        default_factory=dict,
        description="component -> allowed. El admin establece/revoca por componente.",
    )


@router.put(
    "/{user_id}/components",
    summary="Reemplaza los overrides de componentes de un usuario (admin)",
)
def update_user_components(
    user_id: str,
    body: ComponentOverrides,
    ctx: CurrentGym = Depends(require_component("configuracion")),
    db: Session = Depends(get_db),
) -> dict:
    user = _get_user_or_404(db, ctx.gym["id"], user_id)
    for component in body.overrides:
        if component not in COMPONENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Componente desconocido: {component}",
            )
    db.execute(delete(UserComponentPermission).where(UserComponentPermission.user_id == user.id))
    for component, allowed in body.overrides.items():
        db.add(UserComponentPermission(user_id=user.id, component=component, allowed=allowed))
    db.commit()
    db.refresh(user)
    return _user_components_row(db, user)
