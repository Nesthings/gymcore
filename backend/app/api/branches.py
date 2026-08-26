"""CRUD de sucursales — por-tenant."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.db.session import get_db
from app.models import GymBranch
from app.schemas.gym import BranchCreate, BranchRead, BranchUpdate

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=list[BranchRead])
def list_branches(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[GymBranch]:
    stmt = (
        select(GymBranch)
        .where(GymBranch.gym_id == ctx.gym["id"])
        .order_by(GymBranch.created_at)
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


def _get_branch_or_404(db: Session, gym_id: str, branch_id: str) -> GymBranch:
    branch = db.scalar(
        select(GymBranch).where(GymBranch.id == branch_id, GymBranch.gym_id == gym_id)
    )
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada")
    return branch


@router.get("/{branch_id}", response_model=BranchRead)
def get_branch(
    branch_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> GymBranch:
    return _get_branch_or_404(db, ctx.gym["id"], branch_id)


@router.post("", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
def create_branch(
    body: BranchCreate,
    ctx: CurrentGym = Depends(require_component("configuracion")),
    db: Session = Depends(get_db),
) -> GymBranch:
    branch = GymBranch(gym_id=ctx.gym["id"], **body.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.patch("/{branch_id}", response_model=BranchRead)
def update_branch(
    branch_id: str,
    body: BranchUpdate,
    ctx: CurrentGym = Depends(require_component("configuracion")),
    db: Session = Depends(get_db),
) -> GymBranch:
    branch = _get_branch_or_404(db, ctx.gym["id"], branch_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(branch, field, value)
    db.commit()
    db.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(
    branch_id: str,
    ctx: CurrentGym = Depends(require_component("configuracion")),
    db: Session = Depends(get_db),
) -> None:
    branch = _get_branch_or_404(db, ctx.gym["id"], branch_id)
    try:
        db.delete(branch)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: la sucursal tiene socios, pagos u otros registros",
        ) from exc
