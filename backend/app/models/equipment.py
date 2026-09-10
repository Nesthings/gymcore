"""Modelos del módulo Layout: catálogo global de equipos, assets del gimnasio,
mantenimiento preventivo, incidencias y configuración del plano.

Separación conceptual (regla 54):
- Catálogo global: categoría → tipo → marca → modelo (información del modelo).
- Asset: la máquina física concreta que pertenece a un gimnasio/branch.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import GymScopedMixin, UUIDPkMixin


# --------------------------------------------------------------------------
# Catálogo global
# --------------------------------------------------------------------------


class EquipmentCategory(UUIDPkMixin, Base):
    """Categoría de equipos del catálogo global (Cardio, Strength, …)."""

    __tablename__ = "equipment_categories"

    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class EquipmentType(UUIDPkMixin, Base):
    """Tipo de equipo (Treadmill, Leg Press…).

    `gym_id` NULL = catálogo global; con `gym_id` = tipo personalizado de un
    gimnasio (no contamina el catálogo global).
    """

    __tablename__ = "equipment_types"

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_categories.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    gym_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))


class EquipmentBrand(UUIDPkMixin, Base):
    """Marca comercial del catálogo global."""

    __tablename__ = "equipment_brands"

    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)


class EquipmentModel(UUIDPkMixin, Base):
    """Modelo comercial de un equipo.

    Las dimensiones/specs que no estén confirmadas se guardan como NULL (ver
    regla 15: no inventar información). `gym_id` NULL = modelo global;
    con `gym_id` = modelo personalizado de un gimnasio.
    """

    __tablename__ = "equipment_models"

    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_brands.id"), nullable=False, index=True
    )
    type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_types.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Dimensiones físicas en metros (NULL = desconocidas)
    width_m: Mapped[float | None] = mapped_column(Float)
    depth_m: Mapped[float | None] = mapped_column(Float)
    height_m: Mapped[float | None] = mapped_column(Float)
    image_url: Mapped[str | None] = mapped_column(String(255))
    manual_url: Mapped[str | None] = mapped_column(String(255))
    maintenance_guide_url: Mapped[str | None] = mapped_column(String(255))
    gym_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    is_global: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


class EquipmentModelMaintenanceRecommendation(UUIDPkMixin, Base):
    """Recomendación de mantenimiento del fabricante para un modelo del catálogo.

    Solo se guardan recomendaciones confirmadas con su fuente; en caso
    contrario no se presentan como "del fabricante".
    """

    __tablename__ = "equipment_model_maintenance_recommendations"

    equipment_model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_models.id"), nullable=False, index=True
    )
    task: Mapped[str] = mapped_column(String(120), nullable=False)
    task_type: Mapped[str] = mapped_column(String(40), nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False)
    frequency: Mapped[str] = mapped_column(String(40), nullable=False, default="custom")
    instructions: Mapped[str | None] = mapped_column(Text)
    manufacturer_recommended: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    source: Mapped[str | None] = mapped_column(String(200))
    source_document: Mapped[str | None] = mapped_column(String(255))


# --------------------------------------------------------------------------
# Asset del gimnasio
# --------------------------------------------------------------------------

EQUIPMENT_ASSET_STATUSES = (
    "operativo",
    "mantenimiento_proximo",
    "mantenimiento_vencido",
    "fuera_servicio",
    "retirado",
)

# Tipos de tarea de mantenimiento (regla 26)
MAINTENANCE_TASK_TYPES = (
    "cleaning",
    "inspection",
    "lubrication",
    "adjustment",
    "functional_test",
    "electrical",
    "technical_service",
    "replacement",
)

# Frecuencias (regla 27)
MAINTENANCE_FREQUENCIES = (
    "daily",
    "weekly",
    "biweekly",
    "monthly",
    "every_2_months",
    "quarterly",
    "semiannual",
    "annual",
    "custom",
)

MAINTENANCE_TASK_STATUSES = (
    "scheduled",
    "due_soon",
    "due",
    "overdue",
    "completed",
    "skipped",
    "disabled",
)

INCIDENT_CATEGORIES = (
    "ruido_extraño",
    "movimiento_irregular",
    "cable_desgastado",
    "pieza_suelta",
    "tapiceria_danada",
    "consola_pantalla",
    "no_funciona",
    "otro",
)

INCIDENT_PRIORITIES = ("low", "medium", "high", "critical")
INCIDENT_STATUSES = ("open", "in_progress", "resolved", "closed")


class EquipmentAsset(GymScopedMixin, UUIDPkMixin, Base):
    """Máquina física concreta dentro de un gimnasio.

    Un asset puede venir de un modelo del catálogo o ser personalizado
    (sin modelo, con snapshot de marca/modelo propios). `room_id` = sala del
    gimnasio; NULL = sala principal.
    """

    __tablename__ = "equipment_assets"

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gym_branches.id")
    )
    room_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    zone_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    equipment_model_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_models.id")
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_categories.id"), index=True
    )
    type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_types.id"), index=True
    )
    brand_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_brands.id")
    )
    # Snapshots para assets personalizados / render sin joins pesados
    category_name: Mapped[str | None] = mapped_column(String(80))
    type_name: Mapped[str | None] = mapped_column(String(80))
    brand_name: Mapped[str | None] = mapped_column(String(120))
    model_name: Mapped[str | None] = mapped_column(String(120))
    custom_name: Mapped[str | None] = mapped_column(String(120))
    asset_number: Mapped[str | None] = mapped_column(String(80))
    serial_number: Mapped[str | None] = mapped_column(String(120))
    # Posición en el plano (metros) y rotación en grados
    position_x: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    position_y: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    rotation: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    width_m: Mapped[float | None] = mapped_column(Float)
    depth_m: Mapped[float | None] = mapped_column(Float)
    height_m: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="operativo", server_default="operativo"
    )
    installation_date: Mapped[date | None] = mapped_column(Date)
    purchase_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MaintenanceTask(UUIDPkMixin, Base):
    """Tarea de mantenimiento preventivo de un asset concreto."""

    __tablename__ = "maintenance_tasks"

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    equipment_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_assets.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    task_type: Mapped[str] = mapped_column(String(40), nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False)
    frequency: Mapped[str] = mapped_column(String(40), nullable=False, default="custom")
    last_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="scheduled", server_default="scheduled"
    )
    instructions: Mapped[str | None] = mapped_column(Text)
    manufacturer_recommended: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    source: Mapped[str | None] = mapped_column(String(200))
    source_document: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MaintenanceRecord(UUIDPkMixin, Base):
    """Historial: un mantenimiento completado (auditoría del asset)."""

    __tablename__ = "maintenance_records"

    gym_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    equipment_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_assets.id"), nullable=False, index=True
    )
    maintenance_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("maintenance_tasks.id")
    )
    task_name: Mapped[str] = mapped_column(String(120), nullable=False)
    task_type: Mapped[str] = mapped_column(String(40), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    notes: Mapped[str | None] = mapped_column(Text)
    cost: Mapped[float | None] = mapped_column(Float)
    replaced_parts: Mapped[list | None] = mapped_column(JSON)
    attachments: Mapped[list | None] = mapped_column(JSON)


class EquipmentIncident(UUIDPkMixin, Base):
    """Incidencia/falla reportada sobre un asset."""

    __tablename__ = "equipment_incidents"

    gym_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    equipment_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment_assets.id"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="otro")
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    took_out_of_service: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_notes: Mapped[str | None] = mapped_column(Text)


class GymLayout(UUIDPkMixin, Base):
    """Configuración del plano de un gimnasio.

    `width_m`/`length_m` = dimensiones de la sala principal. `rooms` = salas
    adicionales [{id, name, width_m, length_m}]. `zones` = zonas (áreas).
    """

    __tablename__ = "gym_layouts"

    gym_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, index=True
    )
    width_m: Mapped[float] = mapped_column(Float, nullable=False, default=30)
    length_m: Mapped[float] = mapped_column(Float, nullable=False, default=18)
    notice_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    # Zonas: lista de {id, name, color}
    zones: Mapped[list | None] = mapped_column(JSON)
    # Salas adicionales: lista de {id, name, width_m, length_m}
    rooms: Mapped[list | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )