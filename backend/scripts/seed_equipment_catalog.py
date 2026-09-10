"""Seed del catálogo global de equipos y datos demo del módulo Layout.

Uso: .venv/bin/python -m scripts.seed_equipment_catalog

- Catálogo global: categorías, tipos y marcas (datos estándar/verificables).
- Unos pocos modelos reales conocidos con dimensiones y mantenimiento
  SIN CONFIRMAR (NULL) — no se inventa información (regla 15).
- Datos demo (solo si el gimnasio no tiene equipos): assets variados con
  estados, mantenimiento próximo/vencido e incidencias.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import (
    EquipmentAsset,
    EquipmentBrand,
    EquipmentCategory,
    EquipmentIncident,
    EquipmentModel,
    EquipmentType,
    GymLayout,
    MaintenanceTask,
)

CATEGORIES = [
    ("Cardio", "cardio", "Equipos de entrenamiento cardiovascular"),
    ("Strength", "strength", "Máquinas de fuerza y poleas"),
    ("Free Weight", "free_weight", "Peso libre: racks, bancos y mancuernas"),
    ("Functional", "functional", "Estaciones de entrenamiento funcional"),
    ("Other", "other", "Otros equipos"),
]

TYPES = {
    "cardio": [
        "Treadmill", "Upright Bike", "Recumbent Bike", "Spin Bike", "Elliptical",
        "Stair Climber", "Stepper", "Rowing Machine", "Ski Erg", "Air Bike",
    ],
    "strength": [
        "Chest Press", "Shoulder Press", "Leg Press", "Leg Extension", "Leg Curl",
        "Hack Squat", "Smith Machine", "Lat Pulldown", "Seated Row", "Pec Deck",
        "Functional Trainer", "Cable Crossover", "Hip Thrust", "Abductor",
        "Adductor", "Calf Raise", "Biceps Curl", "Triceps Extension",
        "Glute Machine", "Back Extension",
    ],
    "free_weight": [
        "Power Rack", "Squat Rack", "Half Rack", "Bench", "Adjustable Bench",
        "Preacher Bench", "Dumbbell Rack", "Barbell Rack", "Plate Tree",
    ],
    "functional": [
        "Sled", "Battle Rope Station", "Functional Rig", "Pull-up Station",
        "Dip Station", "Plyometric Box",
    ],
}

BRANDS = [
    "Life Fitness", "Hammer Strength", "Precor", "Technogym", "Matrix", "Cybex",
    "TRUE", "Nautilus", "Panatta", "Hoist", "Body-Solid", "Rogue", "Eleiko",
    "Atlantis", "Prime Fitness",
]

# Modelos reales conocidos; specs/mantenimiento SIN CONFIRMAR → NULL.
MODELS = [
    ("Life Fitness", "Treadmill", "Integrity+"),
    ("Life Fitness", "Leg Press", "Insignia"),
    ("Hammer Strength", "Leg Press", "Plate Loaded Leg Press"),
    ("Precor", "Treadmill", "TRM 800"),
    ("Rogue", "Power Rack", "Monster Lite Rack"),
]

DEMO_GYM = "4483db63-b93c-4289-9374-f5da747cd046"


def _type_slug(name: str) -> str:
    return name.lower().replace(" ", "-").replace("/", "-")


def seed_catalog(db: Session) -> None:
    cat_by_slug: dict[str, EquipmentCategory] = {}
    for name, slug, desc in CATEGORIES:
        c = db.scalar(select(EquipmentCategory).where(EquipmentCategory.slug == slug))
        if c is None:
            c = EquipmentCategory(name=name, slug=slug, description=desc)
            db.add(c)
            db.flush()
        cat_by_slug[slug] = c

    type_by_name: dict[str, EquipmentType] = {}
    for slug, names in TYPES.items():
        cat = cat_by_slug[slug]
        for name in names:
            ts = _type_slug(name)
            t = db.scalar(
                select(EquipmentType).where(EquipmentType.slug == ts, EquipmentType.gym_id.is_(None))
            )
            if t is None:
                t = EquipmentType(category_id=cat.id, name=name, slug=ts, is_custom=False)
                db.add(t)
                db.flush()
            type_by_name[name] = t

    brand_by_name: dict[str, EquipmentBrand] = {}
    for name in BRANDS:
        b = db.scalar(select(EquipmentBrand).where(EquipmentBrand.name == name))
        if b is None:
            b = EquipmentBrand(name=name)
            db.add(b)
            db.flush()
        brand_by_name[name] = b

    for brand_name, type_name, model_name in MODELS:
        brand = brand_by_name.get(brand_name)
        type_ = type_by_name.get(type_name)
        if not brand or not type_:
            continue
        exists = db.scalar(
            select(EquipmentModel).where(
                EquipmentModel.name == model_name,
                EquipmentModel.brand_id == brand.id,
                EquipmentModel.gym_id.is_(None),
            )
        )
        if exists is None:
            db.add(
                EquipmentModel(
                    brand_id=brand.id,
                    type_id=type_.id,
                    name=model_name,
                    description="Modelo del catálogo global (specs sin verificar).",
                    is_global=True,
                    active=True,
                )
            )

    db.commit()


def seed_demo(db: Session) -> None:
    if db.scalar(select(EquipmentAsset).where(EquipmentAsset.gym_id == DEMO_GYM)):
        return
    now = datetime.now(UTC)
    lay = db.scalar(select(GymLayout).where(GymLayout.gym_id == DEMO_GYM))
    if lay is None:
        lay = GymLayout(
            gym_id=DEMO_GYM,
            width_m=30,
            length_m=18,
            notice_days=7,
            zones=[
                {"id": str(uuid.uuid4()), "name": "Main Floor", "color": "#19e68c"},
                {"id": str(uuid.uuid4()), "name": "Cardio", "color": "#8af5c5"},
            ],
        )
        db.add(lay)
        db.flush()

    def type_(name: str) -> EquipmentType:
        return db.scalar(select(EquipmentType).where(EquipmentType.name == name))

    def brand(name: str) -> EquipmentBrand:
        return db.scalar(select(EquipmentBrand).where(EquipmentBrand.name == name))

    def model_(bn: str, tn: str, mn: str) -> EquipmentModel:
        return db.scalar(
            select(EquipmentModel).where(
                EquipmentModel.name == mn, EquipmentModel.brand_id == brand(bn).id
            )
        )

    def asset(
        tn: str,
        bn: str,
        mn: str,
        x: float,
        y: float,
        rot: float = 0,
        status: str = "operativo",
        asset_no: str = "LF-001",
    ) -> EquipmentAsset:
        # Si el modelo no existe en el catálogo, el asset se crea como
        # personalizado (snapshots de marca/tipo) — igual de funcional.
        m = model_(bn, tn, mn)
        t = type_(tn)
        cat = db.get(EquipmentCategory, t.category_id) if t else None
        b = brand(bn)
        a = EquipmentAsset(
            gym_id=DEMO_GYM,
            equipment_model_id=m.id if m else None,
            category_id=cat.id if cat else None,
            type_id=t.id if t else None,
            brand_id=b.id if b else None,
            category_name=cat.name if cat else None,
            type_name=tn,
            brand_name=bn,
            model_name=mn,
            asset_number=asset_no,
            position_x=x,
            position_y=y,
            rotation=rot,
            status=status,
            created_at=now,
        )
        db.add(a)
        db.flush()
        return a

    treadmill = asset("Treadmill", "Life Fitness", "Integrity+", 2.5, 2, 0, "operativo", "LF-TM-001")
    treadmill2 = asset("Treadmill", "Life Fitness", "Integrity+", 6, 2, 90, "operativo", "LF-TM-002")
    treadmill3 = asset("Treadmill", "Precor", "TRM 800", 9.5, 2, 0, "fuera_servicio", "PR-TM-003")
    legpress = asset("Leg Press", "Life Fitness", "Insignia", 3, 8, 0, "operativo", "LF-LP-004")
    legpress2 = asset("Leg Press", "Hammer Strength", "Plate Loaded Leg Press", 7.5, 8, 180, "operativo", "HS-LP-005")
    rack = asset("Power Rack", "Rogue", "Monster Lite Rack", 5, 13, 0, "operativo", "RG-PR-006")
    bike = asset("Spin Bike", "Matrix", "Matrix", 14, 8, 0, "operativo", "MX-BI-007")

    # Mantenimiento: vencido en treadmill3 (fuera de servicio) y próximo en legpress
    db.add(
        MaintenanceTask(
            gym_id=DEMO_GYM,
            equipment_asset_id=treadmill3.id,
            name="Inspección de cinta",
            task_type="inspection",
            interval_days=30,
            frequency="monthly",
            next_due_at=now - timedelta(days=6),
            status="scheduled",
        )
    )
    db.add(
        MaintenanceTask(
            gym_id=DEMO_GYM,
            equipment_asset_id=legpress.id,
            name="Lubricación de guías",
            task_type="lubrication",
            interval_days=60,
            frequency="every_2_months",
            next_due_at=now + timedelta(days=4),
            status="scheduled",
        )
    )
    db.add(
        MaintenanceTask(
            gym_id=DEMO_GYM,
            equipment_asset_id=treadmill.id,
            name="Limpieza de consola",
            task_type="cleaning",
            interval_days=14,
            frequency="biweekly",
            next_due_at=now + timedelta(days=12),
            status="scheduled",
        )
    )

    db.add(
        EquipmentIncident(
            gym_id=DEMO_GYM,
            equipment_asset_id=treadmill3.id,
            category="consola_pantalla",
            title="Consola no enciende",
            description="La pantalla quedó en negro tras un corte de luz.",
            priority="high",
            status="open",
            took_out_of_service=True,
            created_at=now,
        )
    )

    db.commit()
    print("Catálogo global + datos demo listos.")


if __name__ == "__main__":
    with SessionLocal() as db:
        seed_catalog(db)
        seed_demo(db)