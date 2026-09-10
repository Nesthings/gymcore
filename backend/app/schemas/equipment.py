"""Schemas del módulo Layout (equipos, catálogo, mantenimiento, incidencias)."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# Catálogo
# --------------------------------------------------------------------------


class CategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None


class TypeRead(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    slug: str
    is_custom: bool = False


class BrandRead(BaseModel):
    id: uuid.UUID
    name: str


class ModelRead(BaseModel):
    id: uuid.UUID
    brand_id: uuid.UUID
    type_id: uuid.UUID
    name: str
    description: str | None = None
    width_m: float | None = None
    depth_m: float | None = None
    height_m: float | None = None
    image_url: str | None = None
    manual_url: str | None = None
    maintenance_guide_url: str | None = None
    is_global: bool = False
    active: bool = True


class ModelRecommendationRead(BaseModel):
    id: uuid.UUID
    equipment_model_id: uuid.UUID
    task: str
    task_type: str
    interval_days: int
    frequency: str
    instructions: str | None = None
    manufacturer_recommended: bool = True
    source: str | None = None
    source_document: str | None = None


class CustomModelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type_id: uuid.UUID
    brand_name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    width_m: float | None = Field(default=None, gt=0)
    depth_m: float | None = Field(default=None, gt=0)
    height_m: float | None = Field(default=None, gt=0)


class CustomTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category_id: uuid.UUID
    description: str | None = None


# --------------------------------------------------------------------------
# Asset
# --------------------------------------------------------------------------


class EquipmentAssetCreate(BaseModel):
    equipment_model_id: uuid.UUID | None = None
    # Para asset personalizado (sin modelo del catálogo)
    custom_name: str | None = Field(default=None, max_length=120)
    category_id: uuid.UUID | None = None
    type_id: uuid.UUID | None = None
    brand_name: str | None = Field(default=None, max_length=120)
    model_name: str | None = Field(default=None, max_length=120)
    asset_number: str | None = Field(default=None, max_length=80)
    serial_number: str | None = Field(default=None, max_length=120)
    width_m: float | None = Field(default=None, gt=0)
    depth_m: float | None = Field(default=None, gt=0)
    height_m: float | None = Field(default=None, gt=0)
    zone_id: uuid.UUID | None = None
    room_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    position_x: float = 0
    position_y: float = 0
    rotation: float = 0
    installation_date: date | None = None
    purchase_date: date | None = None
    notes: str | None = None


class EquipmentAssetUpdate(BaseModel):
    custom_name: str | None = Field(default=None, max_length=120)
    asset_number: str | None = Field(default=None, max_length=80)
    serial_number: str | None = Field(default=None, max_length=120)
    zone_id: uuid.UUID | None = None
    room_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    width_m: float | None = Field(default=None, gt=0)
    depth_m: float | None = Field(default=None, gt=0)
    height_m: float | None = Field(default=None, gt=0)
    installation_date: date | None = None
    purchase_date: date | None = None
    notes: str | None = None


class PositionUpdate(BaseModel):
    position_x: float
    position_y: float
    rotation: float


class EquipmentAssetRead(BaseModel):
    id: uuid.UUID
    gym_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    room_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    equipment_model_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    type_id: uuid.UUID | None = None
    brand_id: uuid.UUID | None = None
    category_name: str | None = None
    type_name: str | None = None
    brand_name: str | None = None
    model_name: str | None = None
    custom_name: str | None = None
    display_name: str = ""
    asset_number: str | None = None
    serial_number: str | None = None
    position_x: float
    position_y: float
    rotation: float
    width_m: float | None = None
    depth_m: float | None = None
    height_m: float | None = None
    status: str
    installation_date: date | None = None
    purchase_date: date | None = None
    notes: str | None = None
    next_due_at: datetime | None = None
    open_incidents: int = 0


class EquipmentDetail(EquipmentAssetRead):
    maintenance: list[dict] = []
    maintenance_history: list[dict] = []
    incidents: list[dict] = []


# --------------------------------------------------------------------------
# Mantenimiento
# --------------------------------------------------------------------------


class MaintenanceTaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    task_type: str
    interval_days: int = Field(gt=0)
    frequency: str = "custom"
    instructions: str | None = None
    manufacturer_recommended: bool = False
    source: str | None = None
    source_document: str | None = None


class MaintenanceTaskRead(BaseModel):
    id: uuid.UUID
    equipment_asset_id: uuid.UUID
    name: str
    task_type: str
    interval_days: int
    frequency: str
    last_completed_at: datetime | None = None
    next_due_at: datetime | None = None
    status: str
    instructions: str | None = None
    manufacturer_recommended: bool = False
    source: str | None = None
    source_document: str | None = None


class MaintenanceCompleteIn(BaseModel):
    completed_at: datetime | None = None
    completed_by_name: str | None = None
    notes: str | None = None
    cost: float | None = Field(default=None, ge=0)
    replaced_parts: list[str] = []
    attachments: list[str] = []


# --------------------------------------------------------------------------
# Incidencias
# --------------------------------------------------------------------------


class IncidentCreate(BaseModel):
    category: str = "otro"
    title: str = Field(min_length=1, max_length=160)
    description: str | None = None
    priority: str = "medium"
    take_out_of_service: bool = False


class IncidentUpdate(BaseModel):
    status: str | None = None
    resolution_notes: str | None = None
    back_to_service: bool = False


class IncidentRead(BaseModel):
    id: uuid.UUID
    equipment_asset_id: uuid.UUID
    category: str
    title: str
    description: str | None = None
    priority: str
    status: str
    took_out_of_service: bool = False
    created_by: uuid.UUID | None = None
    created_at: datetime
    resolved_by: uuid.UUID | None = None
    resolved_at: datetime | None = None
    resolution_notes: str | None = None


# --------------------------------------------------------------------------
# Layout del gimnasio
# --------------------------------------------------------------------------


class ZoneIn(BaseModel):
    id: uuid.UUID
    name: str
    color: str = "#19e68c"


class RoomIn(BaseModel):
    id: uuid.UUID
    name: str
    width_m: float = Field(gt=0, le=200)
    length_m: float = Field(gt=0, le=200)


class GymLayoutUpdate(BaseModel):
    width_m: float = Field(gt=0, le=200)
    length_m: float = Field(gt=0, le=200)
    notice_days: int = Field(ge=0, le=60)
    zones: list[ZoneIn] = []
    rooms: list[RoomIn] = []


class GymLayoutRead(BaseModel):
    gym_id: uuid.UUID
    width_m: float
    length_m: float
    notice_days: int
    zones: list[ZoneIn] = []
    rooms: list[RoomIn] = []