"""Módulo Layout: catálogo de equipos, assets del gimnasio y plano.

Aislamiento multi-tenant: todo asset se consulta/crea siempre con `gym_id`
del contexto (`require_component("layout")` + `require_gym_roles` para
escrituras). El catálogo global (`gym_id IS NULL`) es de solo lectura.
"""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component, require_gym_roles
from app.core.events import record_audit
from app.db.session import get_db
from app.models import (
    EquipmentAsset,
    EquipmentBrand,
    EquipmentCategory,
    EquipmentIncident,
    EquipmentModel,
    EquipmentModelMaintenanceRecommendation,
    EquipmentType,
    GymLayout,
    MaintenanceRecord,
    MaintenanceTask,
)
from app.schemas.equipment import (
    CustomModelCreate,
    CustomTypeCreate,
    EquipmentAssetCreate,
    EquipmentAssetRead,
    EquipmentAssetUpdate,
    EquipmentDetail,
    GymLayoutRead,
    GymLayoutUpdate,
    PositionUpdate,
)

catalog_router = APIRouter(prefix="/equipment-catalog", tags=["equipment-catalog"])
layout_router = APIRouter(prefix="/gym-layout", tags=["gym-layout"])
router = APIRouter(prefix="/equipment", tags=["equipment"])

# Escrituras de catálogo/equipos restringidas a admins del gimnasio
MUTATORS = ("admin",)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _get_layout(db: Session, gym_id: str) -> GymLayout:
    lay = db.scalar(select(GymLayout).where(GymLayout.gym_id == gym_id))
    if lay is None:
        lay = GymLayout(gym_id=gym_id, width_m=30, length_m=18, notice_days=7, zones=[], rooms=[])
        db.add(lay)
        db.commit()
        db.refresh(lay)
    return lay


def _asset_or_404(db: Session, gym_id: str, asset_id: str) -> EquipmentAsset:
    asset = db.scalar(
        select(EquipmentAsset).where(EquipmentAsset.id == asset_id, EquipmentAsset.gym_id == gym_id)
    )
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipo no encontrado")
    return asset


def _effective_task_status(next_due_at, notice_days: int) -> str:
    if next_due_at is None:
        return "scheduled"
    days = (next_due_at.date() - datetime.now(UTC).date()).days
    if days < 0:
        return "overdue"
    if days == 0:
        return "due"
    if days <= notice_days:
        return "due_soon"
    return "scheduled"


def _tasks_by_asset(db: Session, gym_id: str, asset_ids: list[uuid.UUID], notice_days: int) -> dict[str, list[dict]]:
    if not asset_ids:
        return {}
    rows = db.execute(
        select(
            MaintenanceTask.equipment_asset_id,
            MaintenanceTask.id,
            MaintenanceTask.name,
            MaintenanceTask.task_type,
            MaintenanceTask.interval_days,
            MaintenanceTask.frequency,
            MaintenanceTask.last_completed_at,
            MaintenanceTask.next_due_at,
            MaintenanceTask.status,
            MaintenanceTask.manufacturer_recommended,
            MaintenanceTask.source,
            MaintenanceTask.source_document,
        ).where(
            MaintenanceTask.equipment_asset_id.in_(asset_ids),
            MaintenanceTask.status != "disabled",
        )
    ).mappings().all()
    out: dict[str, list[dict]] = {}
    for r in rows:
        st = r["status"]
        if st == "completed":
            st = "scheduled"
        if r["next_due_at"] is not None:
            st = _effective_task_status(r["next_due_at"], notice_days)
        out.setdefault(str(r["equipment_asset_id"]), []).append(
            {
                "id": str(r["id"]),
                "name": r["name"],
                "task_type": r["task_type"],
                "interval_days": r["interval_days"],
                "frequency": r["frequency"],
                "last_completed_at": r["last_completed_at"],
                "next_due_at": r["next_due_at"],
                "status": st,
                "manufacturer_recommended": r["manufacturer_recommended"],
                "source": r["source"],
                "source_document": r["source_document"],
            }
        )
    return out


def _open_incidents_by_asset(db: Session, asset_ids: list[uuid.UUID]) -> dict[str, int]:
    if not asset_ids:
        return {}
    rows = db.execute(
        select(
            EquipmentIncident.equipment_asset_id,
            EquipmentIncident.status,
        ).where(
            EquipmentIncident.equipment_asset_id.in_(asset_ids),
            EquipmentIncident.status.in_(("open", "in_progress")),
        )
    ).all()
    out: dict[str, int] = {}
    for aid, _st in rows:
        out[str(aid)] = out.get(str(aid), 0) + 1
    return out


def _effective_asset_status(asset_status: str, tasks: list[dict]) -> str:
    if asset_status in ("fuera_servicio", "retirado"):
        return asset_status
    for t in tasks:
        if t["status"] in ("overdue", "due"):
            return "mantenimiento_vencido"
    for t in tasks:
        if t["status"] == "due_soon":
            return "mantenimiento_proximo"
    return "operativo"


def _display_name(asset: EquipmentAsset) -> str:
    if asset.custom_name:
        return asset.custom_name
    parts = [p for p in (asset.brand_name, asset.model_name or asset.type_name) if p]
    return " · ".join(parts) if parts else "Equipo"


def _asset_dict(asset: EquipmentAsset, tasks: list[dict], open_incidents: int) -> dict:
    status_ = _effective_asset_status(asset.status, tasks)
    next_due = min((t["next_due_at"] for t in tasks if t["next_due_at"]), default=None)
    width = asset.width_m
    depth = asset.depth_m
    if width is None and asset.equipment_model_id:
        m = _model_dimensions_cache.get(str(asset.equipment_model_id))
        if m:
            width, depth = m
    return {
        "id": str(asset.id),
        "gym_id": str(asset.gym_id),
        "branch_id": str(asset.branch_id) if asset.branch_id else None,
        "room_id": str(asset.room_id) if asset.room_id else None,
        "zone_id": str(asset.zone_id) if asset.zone_id else None,
        "equipment_model_id": str(asset.equipment_model_id) if asset.equipment_model_id else None,
        "category_id": str(asset.category_id) if asset.category_id else None,
        "type_id": str(asset.type_id) if asset.type_id else None,
        "brand_id": str(asset.brand_id) if asset.brand_id else None,
        "category_name": asset.category_name,
        "type_name": asset.type_name,
        "brand_name": asset.brand_name,
        "model_name": asset.model_name,
        "custom_name": asset.custom_name,
        "display_name": _display_name(asset),
        "asset_number": asset.asset_number,
        "serial_number": asset.serial_number,
        "position_x": asset.position_x,
        "position_y": asset.position_y,
        "rotation": asset.rotation,
        "width_m": width,
        "depth_m": depth,
        "height_m": asset.height_m,
        "status": status_,
        "installation_date": asset.installation_date,
        "purchase_date": asset.purchase_date,
        "notes": asset.notes,
        "next_due_at": next_due,
        "open_incidents": open_incidents,
    }


_model_dimensions_cache: dict[str, tuple[float | None, float | None]] = {}


def _load_model_dimensions(db: Session, model_ids: list[str]) -> None:
    for mid in model_ids:
        if mid in _model_dimensions_cache:
            continue
        row = db.execute(
            select(EquipmentModel.width_m, EquipmentModel.depth_m).where(EquipmentModel.id == mid)
        ).mappings().first()
        _model_dimensions_cache[mid] = (row["width_m"], row["depth_m"]) if row else (None, None)


# --------------------------------------------------------------------------
# Catálogo
# --------------------------------------------------------------------------


@catalog_router.get("")
def catalog_tree(ctx: CurrentGym = Depends(require_component("layout")), db: Session = Depends(get_db)) -> dict:
    categories = db.scalars(select(EquipmentCategory).order_by(EquipmentCategory.name)).all()
    types = db.scalars(
        select(EquipmentType).where((EquipmentType.gym_id.is_(None)) | (EquipmentType.gym_id == ctx.gym["id"]))
    ).all()
    brands = db.scalars(select(EquipmentBrand).order_by(EquipmentBrand.name)).all()
    models = db.scalars(
        select(EquipmentModel).where(
            EquipmentModel.active.is_(True),
            (EquipmentModel.gym_id.is_(None)) | (EquipmentModel.gym_id == ctx.gym["id"]),
        )
    ).all()
    recs = db.scalars(
        select(EquipmentModelMaintenanceRecommendation).where(
            EquipmentModelMaintenanceRecommendation.equipment_model_id.in_([m.id for m in models] or [uuid.UUID(int=0)])
        )
    ).all()
    rec_by_model: dict[str, list[dict]] = {}
    for r in recs:
        rec_by_model.setdefault(str(r.equipment_model_id), []).append(
            {
                "id": str(r.id),
                "task": r.task,
                "task_type": r.task_type,
                "interval_days": r.interval_days,
                "frequency": r.frequency,
                "instructions": r.instructions,
                "manufacturer_recommended": r.manufacturer_recommended,
                "source": r.source,
                "source_document": r.source_document,
            }
        )
    return {
        "categories": [
            {"id": str(c.id), "name": c.name, "slug": c.slug, "description": c.description}
            for c in categories
        ],
        "types": [
            {
                "id": str(t.id),
                "category_id": str(t.category_id),
                "name": t.name,
                "slug": t.slug,
                "is_custom": t.is_custom,
            }
            for t in types
        ],
        "brands": [{"id": str(b.id), "name": b.name} for b in brands],
        "models": [
            {
                "id": str(m.id),
                "brand_id": str(m.brand_id),
                "type_id": str(m.type_id),
                "name": m.name,
                "description": m.description,
                "width_m": m.width_m,
                "depth_m": m.depth_m,
                "height_m": m.height_m,
                "image_url": m.image_url,
                "manual_url": m.manual_url,
                "maintenance_guide_url": m.maintenance_guide_url,
                "is_global": m.is_global,
                "active": m.active,
                "recommendations": rec_by_model.get(str(m.id), []),
            }
            for m in models
        ],
    }


@catalog_router.post("/types", status_code=status.HTTP_201_CREATED)
def create_custom_type(
    body: CustomTypeCreate,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    cat = db.get(EquipmentCategory, body.category_id)
    if cat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    slug = f"custom-{uuid.uuid4().hex[:8]}"
    t = EquipmentType(
        category_id=cat.id,
        name=body.name.strip(),
        slug=slug,
        gym_id=ctx.gym["id"],
        is_custom=True,
        created_by=ctx.user.sub,
    )
    db.add(t)
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="equipment_type_created", entity_type="equipment_type", entity_id=t.id,
        metadata={"name": t.name},
    )
    db.commit()
    db.refresh(t)
    return {"id": str(t.id), "category_id": str(t.category_id), "name": t.name, "is_custom": True}


@catalog_router.post("/models/custom", status_code=status.HTTP_201_CREATED)
def create_custom_model(
    body: CustomModelCreate,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    """Crea un modelo personalizado DEL GIMNASIO (no contamina el catálogo global)."""
    type_ = db.scalar(
        select(EquipmentType).where(
            EquipmentType.id == body.type_id,
            (EquipmentType.gym_id.is_(None)) | (EquipmentType.gym_id == ctx.gym["id"]),
        )
    )
    if type_ is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo no encontrado")
    brand = db.scalar(select(EquipmentBrand).where(EquipmentBrand.name == body.brand_name.strip()))
    if brand is None:
        brand = EquipmentBrand(name=body.brand_name.strip())
        db.add(brand)
        db.flush()
    model = EquipmentModel(
        brand_id=brand.id,
        type_id=type_.id,
        name=body.name.strip(),
        description=body.description,
        width_m=body.width_m,
        depth_m=body.depth_m,
        height_m=body.height_m,
        gym_id=ctx.gym["id"],
        is_global=False,
        active=True,
    )
    db.add(model)
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="equipment_model_created", entity_type="equipment_model", entity_id=model.id,
        metadata={"name": model.name, "brand": brand.name},
    )
    db.commit()
    db.refresh(model)
    return {
        "id": str(model.id),
        "brand_id": str(brand.id),
        "type_id": str(type_.id),
        "name": model.name,
        "brand_name": brand.name,
        "width_m": model.width_m,
        "depth_m": model.depth_m,
        "height_m": model.height_m,
    }


# --------------------------------------------------------------------------
# Plano del gimnasio
# --------------------------------------------------------------------------


@layout_router.get("", response_model=GymLayoutRead)
def get_layout(ctx: CurrentGym = Depends(require_component("layout")), db: Session = Depends(get_db)) -> GymLayout:
    return _get_layout(db, str(ctx.gym["id"]))


@layout_router.put("", response_model=GymLayoutRead)
def update_layout(
    body: GymLayoutUpdate,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> GymLayout:
    lay = _get_layout(db, str(ctx.gym["id"]))
    lay.width_m = body.width_m
    lay.length_m = body.length_m
    lay.notice_days = body.notice_days
    # mode="json" serializa los UUID a string (la columna es JSON, no UUID[])
    lay.zones = [z.model_dump(mode="json") for z in body.zones]
    lay.rooms = [r.model_dump(mode="json") for r in body.rooms]
    db.commit()
    db.refresh(lay)
    return lay


# --------------------------------------------------------------------------
# Assets
# --------------------------------------------------------------------------


@router.get("", response_model=list[EquipmentAssetRead])
def list_equipment(
    ctx: CurrentGym = Depends(require_component("layout")),
    db: Session = Depends(get_db),
    status_: str | None = Query(default=None, alias="status"),
    category_id: str | None = None,
    type_id: str | None = None,
    zone_id: str | None = None,
    room_id: str | None = None,
    search: str | None = None,
    include_retired: bool = False,
    limit: int = Query(default=500, ge=1, le=1000),
) -> list[dict]:
    gid = str(ctx.gym["id"])
    q = select(EquipmentAsset).where(EquipmentAsset.gym_id == gid)
    if status_:
        q = q.where(EquipmentAsset.status == status_)
    if category_id:
        q = q.where(EquipmentAsset.category_id == category_id)
    if type_id:
        q = q.where(EquipmentAsset.type_id == type_id)
    if zone_id:
        q = q.where(EquipmentAsset.zone_id == zone_id)
    if room_id:
        q = q.where(EquipmentAsset.room_id == room_id)
    if not include_retired:
        q = q.where(EquipmentAsset.status != "retirado")
    if search:
        like = f"%{search.strip()}%"
        q = q.where(
            (EquipmentAsset.custom_name.ilike(like))
            | (EquipmentAsset.brand_name.ilike(like))
            | (EquipmentAsset.model_name.ilike(like))
            | (EquipmentAsset.type_name.ilike(like))
            | (EquipmentAsset.asset_number.ilike(like))
            | (EquipmentAsset.serial_number.ilike(like))
        )
    assets = db.scalars(q.order_by(EquipmentAsset.created_at).limit(limit)).all()
    ids = [a.id for a in assets]
    _load_model_dimensions(db, [str(a.equipment_model_id) for a in assets if a.equipment_model_id])
    tasks = _tasks_by_asset(db, gid, ids, _get_layout(db, gid).notice_days)
    incidents = _open_incidents_by_asset(db, ids)
    return [_asset_dict(a, tasks.get(str(a.id), []), incidents.get(str(a.id), 0)) for a in assets]


@router.post("", response_model=EquipmentAssetRead, status_code=status.HTTP_201_CREATED)
def create_equipment(
    body: EquipmentAssetCreate,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    gid = ctx.gym["id"]
    model = None
    if body.equipment_model_id:
        model = db.scalar(
            select(EquipmentModel).where(
                EquipmentModel.id == body.equipment_model_id,
                (EquipmentModel.gym_id.is_(None)) | (EquipmentModel.gym_id == gid),
            )
        )
        if model is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado")
    type_ = None
    category = None
    brand_name = body.brand_name
    model_name = body.model_name
    category_name = None
    type_name = None
    width = body.width_m
    depth = body.depth_m
    height = body.height_m

    if model is not None:
        type_ = db.get(EquipmentType, model.type_id)
        category = db.get(EquipmentCategory, type_.category_id) if type_ else None
        brand = db.get(EquipmentBrand, model.brand_id)
        brand_name = brand.name if brand else brand_name
        model_name = model.name
        type_name = type_.name if type_ else type_name
        category_name = category.name if category else category_name
        if width is None:
            width = model.width_m
        if depth is None:
            depth = model.depth_m
        if height is None:
            height = model.height_m
    elif body.category_id:
        category = db.get(EquipmentCategory, body.category_id)
        category_name = category.name if category else None
        type_ = db.get(EquipmentType, body.type_id) if body.type_id else None
        type_name = type_.name if type_ else None

    asset = EquipmentAsset(
        gym_id=gid,
        branch_id=body.branch_id,
        room_id=body.room_id,
        zone_id=body.zone_id,
        equipment_model_id=model.id if model else None,
        category_id=category.id if category else body.category_id,
        type_id=type_.id if type_ else body.type_id,
        brand_id=model.brand_id if model else None,
        category_name=category_name,
        type_name=type_name,
        brand_name=brand_name,
        model_name=model_name,
        custom_name=body.custom_name,
        asset_number=body.asset_number,
        serial_number=body.serial_number,
        position_x=body.position_x,
        position_y=body.position_y,
        rotation=body.rotation,
        width_m=width,
        depth_m=depth,
        height_m=height,
        installation_date=body.installation_date,
        purchase_date=body.purchase_date,
        notes=body.notes,
        created_by=ctx.user.sub,
    )
    db.add(asset)
    db.flush()
    record_audit(
        db, gym_id=gid, actor_type="user", actor_id=ctx.user.sub,
        action="equipment_created", entity_type="equipment_asset", entity_id=asset.id,
        metadata={"name": _display_name(asset)},
    )
    db.commit()
    db.refresh(asset)
    return _asset_dict(asset, [], 0)


@router.get("/{asset_id}", response_model=EquipmentDetail)
def get_equipment(
    asset_id: str,
    ctx: CurrentGym = Depends(require_component("layout")),
    db: Session = Depends(get_db),
) -> dict:
    gid = str(ctx.gym["id"])
    asset = _asset_or_404(db, gid, asset_id)
    notice = _get_layout(db, gid).notice_days
    tasks = _tasks_by_asset(db, gid, [asset.id], notice).get(str(asset.id), [])
    records = db.execute(
        select(
            MaintenanceRecord.task_name,
            MaintenanceRecord.task_type,
            MaintenanceRecord.completed_at,
            MaintenanceRecord.completed_by,
            MaintenanceRecord.notes,
            MaintenanceRecord.cost,
            MaintenanceRecord.replaced_parts,
        )
        .where(MaintenanceRecord.equipment_asset_id == asset.id)
        .order_by(MaintenanceRecord.completed_at.desc())
        .limit(50)
    ).mappings().all()
    incidents = db.execute(
        select(EquipmentIncident)
        .where(EquipmentIncident.equipment_asset_id == asset.id)
        .order_by(EquipmentIncident.created_at.desc())
        .limit(50)
    ).scalars().all()
    base = _asset_dict(asset, tasks, len([i for i in incidents if i.status in ("open", "in_progress")]))
    base["maintenance"] = tasks
    base["maintenance_history"] = [dict(r) for r in records]
    base["incidents"] = [
        {
            "id": str(i.id),
            "category": i.category,
            "title": i.title,
            "description": i.description,
            "priority": i.priority,
            "status": i.status,
            "took_out_of_service": i.took_out_of_service,
            "created_at": i.created_at,
            "resolved_at": i.resolved_at,
            "resolution_notes": i.resolution_notes,
        }
        for i in incidents
    ]
    return base


@router.patch("/{asset_id}", response_model=EquipmentAssetRead)
def update_equipment(
    asset_id: str,
    body: EquipmentAssetUpdate,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    asset = _asset_or_404(db, str(ctx.gym["id"]), asset_id)
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(asset, field, value)
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="equipment_updated", entity_type="equipment_asset", entity_id=asset.id,
        metadata={"fields": list(data.keys())},
    )
    db.commit()
    db.refresh(asset)
    return _asset_dict(asset, [], 0)


@router.patch("/{asset_id}/position", response_model=EquipmentAssetRead)
def update_position(
    asset_id: str,
    body: PositionUpdate,
    ctx: CurrentGym = Depends(require_component("layout")),
    db: Session = Depends(get_db),
) -> dict:
    asset = _asset_or_404(db, str(ctx.gym["id"]), asset_id)
    lay = _get_layout(db, str(ctx.gym["id"]))
    # Clamp de coordenadas al plano (evita equipos fuera de los límites).
    x = max(0.0, min(body.position_x, lay.width_m - 0.1))
    y = max(0.0, min(body.position_y, lay.length_m - 0.1))
    asset.position_x = round(x, 2)
    asset.position_y = round(y, 2)
    asset.rotation = body.rotation % 360
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="equipment_moved", entity_type="equipment_asset", entity_id=asset.id,
        metadata={"x": asset.position_x, "y": asset.position_y, "rotation": asset.rotation},
    )
    db.commit()
    db.refresh(asset)
    return _asset_dict(asset, [], 0)


@router.post("/{asset_id}/duplicate", response_model=EquipmentAssetRead, status_code=status.HTTP_201_CREATED)
def duplicate_equipment(
    asset_id: str,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    gid = str(ctx.gym["id"])
    src = _asset_or_404(db, gid, asset_id)
    copy = EquipmentAsset(
        gym_id=src.gym_id,
        branch_id=src.branch_id,
        room_id=src.room_id,
        zone_id=src.zone_id,
        equipment_model_id=src.equipment_model_id,
        category_id=src.category_id,
        type_id=src.type_id,
        brand_id=src.brand_id,
        category_name=src.category_name,
        type_name=src.type_name,
        brand_name=src.brand_name,
        model_name=src.model_name,
        custom_name=(src.custom_name or _display_name(src)) + " (copia)",
        asset_number=src.asset_number,
        serial_number=src.serial_number,
        position_x=min(src.position_x + 1.2, 100),
        position_y=min(src.position_y + 1.2, 100),
        rotation=src.rotation,
        width_m=src.width_m,
        depth_m=src.depth_m,
        height_m=src.height_m,
        notes=src.notes,
        created_by=ctx.user.sub,
    )
    db.add(copy)
    db.flush()
    record_audit(
        db, gym_id=src.gym_id, actor_type="user", actor_id=ctx.user.sub,
        action="equipment_duplicated", entity_type="equipment_asset", entity_id=copy.id,
    )
    db.commit()
    db.refresh(copy)
    return _asset_dict(copy, [], 0)


@router.post("/{asset_id}/retire", response_model=EquipmentAssetRead)
def retire_equipment(
    asset_id: str,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    asset = _asset_or_404(db, str(ctx.gym["id"]), asset_id)
    asset.status = "retirado"
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="equipment_retired", entity_type="equipment_asset", entity_id=asset.id,
    )
    db.commit()
    db.refresh(asset)
    return _asset_dict(asset, [], 0)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    asset_id: str,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> None:
    gid = str(ctx.gym["id"])
    asset = _asset_or_404(db, gid, asset_id)
    has_history = db.scalar(
        select(MaintenanceRecord.id).where(MaintenanceRecord.equipment_asset_id == asset.id).limit(1)
    ) or db.scalar(
        select(EquipmentIncident.id).where(EquipmentIncident.equipment_asset_id == asset.id).limit(1)
    )
    if has_history:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este equipo tiene historial. Usa 'Retirar' para conservarlo.",
        )
    db.execute(text("DELETE FROM maintenance_tasks WHERE equipment_asset_id = :id"), {"id": asset.id})
    db.delete(asset)
    record_audit(
        db, gym_id=gid, actor_type="user", actor_id=ctx.user.sub,
        action="equipment_deleted", entity_type="equipment_asset", entity_id=asset.id,
    )
    db.commit()