"""Módulo Layout: mantenimiento preventivo e incidencias de equipos.

Incluye el barrido periódico que genera notificaciones internas (reutilizando
el sistema existente de `InternalNotification`) cuando un mantenimiento está
próximo o vencido, con deduplicación.
"""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component, require_gym_roles
from app.api.equipment import _asset_dict, _asset_or_404, _get_layout, _tasks_by_asset
from app.core.events import notify_roles, record_audit
from app.db.session import get_db
from app.models import (
    EquipmentAsset,
    EquipmentIncident,
    EquipmentModelMaintenanceRecommendation,
    MaintenanceRecord,
    MaintenanceTask,
)
from app.schemas.equipment import (
    IncidentCreate,
    IncidentRead,
    IncidentUpdate,
    MaintenanceCompleteIn,
    MaintenanceTaskCreate,
)

router = APIRouter(tags=["equipment"])

MUTATORS = ("admin",)


# --------------------------------------------------------------------------
# Mantenimiento
# --------------------------------------------------------------------------


def _task_or_404(db: Session, gym_id: str, task_id: str) -> MaintenanceTask:
    task = db.scalar(
        select(MaintenanceTask).where(MaintenanceTask.id == task_id, MaintenanceTask.gym_id == gym_id)
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")
    return task


@router.post("/equipment/{asset_id}/maintenance", status_code=status.HTTP_201_CREATED)
def add_maintenance_task(
    asset_id: str,
    body: MaintenanceTaskCreate,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    gid = str(ctx.gym["id"])
    asset = _asset_or_404(db, gid, asset_id)
    task = MaintenanceTask(
        gym_id=ctx.gym["id"],
        equipment_asset_id=asset.id,
        name=body.name.strip(),
        task_type=body.task_type,
        interval_days=body.interval_days,
        frequency=body.frequency,
        next_due_at=datetime.now(UTC) + timedelta(days=body.interval_days),
        status="scheduled",
        instructions=body.instructions,
        manufacturer_recommended=body.manufacturer_recommended,
        source=body.source,
        source_document=body.source_document,
    )
    db.add(task)
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="maintenance_task_created", entity_type="equipment_asset", entity_id=asset.id,
        metadata={"task": task.name},
    )
    db.commit()
    db.refresh(task)
    return {
        "id": str(task.id),
        "name": task.name,
        "task_type": task.task_type,
        "interval_days": task.interval_days,
        "next_due_at": task.next_due_at,
        "status": "scheduled",
        "manufacturer_recommended": task.manufacturer_recommended,
    }


@router.post("/equipment/{asset_id}/maintenance/apply-recommendations")
def apply_manufacturer_recommendations(
    asset_id: str,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    """Copia las recomendaciones del fabricante del modelo como tareas del asset.

    Si el gimnasio ya ajustó la frecuencia de una tarea (mismo nombre), se
    conserva la configuración del gimnasio (regla 30).
    """
    gid = str(ctx.gym["id"])
    asset = _asset_or_404(db, gid, asset_id)
    if not asset.equipment_model_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El equipo no tiene modelo de catálogo")
    recs = db.scalars(
        select(EquipmentModelMaintenanceRecommendation).where(
            EquipmentModelMaintenanceRecommendation.equipment_model_id == asset.equipment_model_id
        )
    ).all()
    existing = db.scalars(
        select(MaintenanceTask).where(MaintenanceTask.equipment_asset_id == asset.id)
    ).all()
    by_name = {t.name.lower(): t for t in existing}
    created = 0
    for r in recs:
        task = by_name.get(r.task.lower())
        if task is None:
            task = MaintenanceTask(
                gym_id=ctx.gym["id"],
                equipment_asset_id=asset.id,
                name=r.task,
                task_type=r.task_type,
                interval_days=r.interval_days,
                frequency=r.frequency,
                next_due_at=datetime.now(UTC) + timedelta(days=r.interval_days),
                status="scheduled",
                instructions=r.instructions,
                manufacturer_recommended=True,
                source=r.source,
                source_document=r.source_document,
            )
            db.add(task)
            created += 1
        # Si ya existe, se conserva la configuración del gimnasio (no se pisa)
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="maintenance_recommendations_applied", entity_type="equipment_asset", entity_id=asset.id,
        metadata={"created": created},
    )
    db.commit()
    return {"created": created}


@router.post("/equipment/{asset_id}/maintenance/{task_id}/complete")
def complete_maintenance(
    asset_id: str,
    task_id: str,
    body: MaintenanceCompleteIn,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    gid = str(ctx.gym["id"])
    asset = _asset_or_404(db, gid, asset_id)
    task = _task_or_404(db, gid, task_id)
    completed_at = body.completed_at or datetime.now(UTC)
    record = MaintenanceRecord(
        gym_id=ctx.gym["id"],
        equipment_asset_id=asset.id,
        maintenance_task_id=task.id,
        task_name=task.name,
        task_type=task.task_type,
        completed_at=completed_at,
        completed_by=ctx.user.sub,
        notes=body.notes,
        cost=body.cost,
        replaced_parts=body.replaced_parts or None,
        attachments=body.attachments or None,
    )
    db.add(record)
    task.last_completed_at = completed_at
    task.next_due_at = completed_at + timedelta(days=task.interval_days)
    task.status = "scheduled"
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="maintenance_completed", entity_type="equipment_asset", entity_id=asset.id,
        metadata={"task": task.name},
    )
    db.commit()
    return {
        "ok": True,
        "next_due_at": task.next_due_at,
        "record_id": str(record.id),
    }


@router.patch("/equipment/{asset_id}/maintenance/{task_id}")
def update_maintenance_task(
    asset_id: str,
    task_id: str,
    body: dict,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> dict:
    gid = str(ctx.gym["id"])
    asset = _asset_or_404(db, gid, asset_id)
    task = _task_or_404(db, gid, task_id)
    if body.get("disabled"):
        task.status = "disabled"
    elif body.get("skip"):
        task.status = "skipped"
        task.next_due_at = datetime.now(UTC) + timedelta(days=task.interval_days)
    elif "interval_days" in body:
        new_days = int(body["interval_days"])
        if new_days <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El intervalo debe ser mayor a 0 días",
            )
        task.interval_days = new_days
        if task.last_completed_at:
            task.next_due_at = task.last_completed_at + timedelta(days=task.interval_days)
        # Recalcula sin modificar historial (regla 74)
    elif "status" in body and body["status"] == "enabled":
        task.status = "scheduled"
        if task.next_due_at is None:
            task.next_due_at = datetime.now(UTC) + timedelta(days=task.interval_days)
    db.commit()
    return {"ok": True}


@router.delete("/equipment/{asset_id}/maintenance/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_maintenance_task(
    asset_id: str,
    task_id: str,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> None:
    gid = str(ctx.gym["id"])
    _asset_or_404(db, gid, asset_id)
    task = _task_or_404(db, gid, task_id)
    db.delete(task)
    db.commit()


# --------------------------------------------------------------------------
# Incidencias
# --------------------------------------------------------------------------


@router.post("/equipment/{asset_id}/incidents", response_model=IncidentRead, status_code=status.HTTP_201_CREATED)
def create_incident(
    asset_id: str,
    body: IncidentCreate,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> EquipmentIncident:
    gid = str(ctx.gym["id"])
    asset = _asset_or_404(db, gid, asset_id)
    incident = EquipmentIncident(
        gym_id=ctx.gym["id"],
        equipment_asset_id=asset.id,
        category=body.category,
        title=body.title.strip(),
        description=body.description,
        priority=body.priority,
        status="open",
        took_out_of_service=body.take_out_of_service,
        created_by=ctx.user.sub,
    )
    if body.take_out_of_service:
        asset.status = "fuera_servicio"
    db.add(incident)
    db.flush()
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="incident_created", entity_type="equipment_asset", entity_id=asset.id,
        metadata={"incident": body.title, "priority": body.priority},
    )
    db.commit()
    db.refresh(incident)
    if body.take_out_of_service:
        notify_roles(
            db, ctx.gym["id"], ["admin"], "incident",
            f"{_display_name_for(db, asset)} fue marcado fuera de servicio",
            link=None,
        )
        db.commit()
    return incident


def _display_name_for(db: Session, asset: EquipmentAsset) -> str:
    if asset.custom_name:
        return asset.custom_name
    return " · ".join(
        [p for p in (asset.brand_name, asset.model_name or asset.type_name) if p]
    ) or "Equipo"


@router.get("/incidents/{incident_id}", response_model=IncidentRead)
def get_incident(
    incident_id: str,
    ctx: CurrentGym = Depends(require_component("layout")),
    db: Session = Depends(get_db),
) -> EquipmentIncident:
    incident = db.scalar(
        select(EquipmentIncident).where(
            EquipmentIncident.id == incident_id, EquipmentIncident.gym_id == ctx.gym["id"]
        )
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incidencia no encontrada")
    return incident


@router.patch("/incidents/{incident_id}", response_model=IncidentRead)
def update_incident(
    incident_id: str,
    body: IncidentUpdate,
    ctx: CurrentGym = Depends(require_gym_roles(*MUTATORS)),
    db: Session = Depends(get_db),
) -> EquipmentIncident:
    incident = db.scalar(
        select(EquipmentIncident).where(
            EquipmentIncident.id == incident_id, EquipmentIncident.gym_id == ctx.gym["id"]
        )
    )
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incidencia no encontrada")
    asset = db.get(EquipmentAsset, incident.equipment_asset_id)
    if body.status:
        incident.status = body.status
    if body.resolution_notes is not None:
        incident.resolution_notes = body.resolution_notes
    if body.status in ("resolved", "closed") and incident.resolved_at is None:
        incident.resolved_at = datetime.now(UTC)
        incident.resolved_by = ctx.user.sub
        if asset and asset.status == "fuera_servicio":
            if body.back_to_service is None:
                # Pedir confirmación: si no se indica, se conserva fuera de servicio.
                pass
            if body.back_to_service is True:
                asset.status = "operativo"
    if body.back_to_service is True:
        asset.status = "operativo"
    record_audit(
        db, gym_id=ctx.gym["id"], actor_type="user", actor_id=ctx.user.sub,
        action="incident_resolved", entity_type="equipment_asset",
        entity_id=asset.id if asset else incident.equipment_asset_id,
        metadata={"status": body.status},
    )
    db.commit()
    db.refresh(incident)
    return incident


# --------------------------------------------------------------------------
# Barrido periódico de mantenimiento (notificaciones)
# --------------------------------------------------------------------------


def maintenance_sweep(db: Session) -> int:
    """Genera notificaciones internas para mantenimientos próximos/vencidos.

    Deduplicado: una tarea no genera más de una notificación activa (sin leer)
    por asset. Reutiliza `InternalNotification` + `notify_roles`.
    """
    now = datetime.now(UTC)
    created = 0
    gym_ids = db.scalars(select(EquipmentAsset.gym_id).distinct()).all()
    for gid in gym_ids:
        notice = _get_layout(db, str(gid)).notice_days
        window = now + timedelta(days=notice)
        tasks = db.execute(
            select(
                MaintenanceTask.equipment_asset_id,
                MaintenanceTask.name,
                MaintenanceTask.next_due_at,
            ).where(
                MaintenanceTask.gym_id == gid,
                MaintenanceTask.status != "disabled",
                MaintenanceTask.next_due_at.is_not(None),
                MaintenanceTask.next_due_at <= window,
            )
        ).mappings().all()
        if not tasks:
            continue
        asset_ids = {t["equipment_asset_id"] for t in tasks}
        assets = db.scalars(
            select(EquipmentAsset).where(EquipmentAsset.id.in_(list(asset_ids)))
        ).all()
        by_id = {a.id: a for a in assets}
        admin_ids = db.scalars(
            select(text("id")).select_from(text("users")).where(
                text("gym_id = :gid AND role = 'admin' AND is_active = true")
            ),
            {"gid": gid},
        ).all()
        for t in tasks:
            asset = by_id.get(t["equipment_asset_id"])
            if asset is None:
                continue
            # Sin enlace de navegación: la notificación es informativa y no
            # debe abrir Layout ni redirigir a otra pantalla.
            overdue = t["next_due_at"] < now
            msg = (
                f"{_display_name_for(db, asset)} tiene mantenimiento vencido ({t['name']})."
                if overdue
                else f"{_display_name_for(db, asset)} requiere {t['name'].lower()} en "
                f"{(t['next_due_at'] - now).days + 1} días."
            )
            for uid in admin_ids:
                exists = db.scalar(
                    text(
                        "SELECT id FROM internal_notifications WHERE user_id = :u "
                        "AND gym_id = :g AND type = 'maintenance' AND message = :m "
                        "AND read_at IS NULL LIMIT 1"
                    ),
                    {"u": uid, "g": gid, "m": msg},
                )
                if exists:
                    continue
                db.execute(
                    text(
                        "INSERT INTO internal_notifications (gym_id, user_id, type, message, link) "
                        "VALUES (:g, :u, 'maintenance', :m, NULL)"
                    ),
                    {"g": gid, "u": uid, "m": msg},
                )
                created += 1
    if created:
        db.commit()
    return created