"""Permisos por componente del panel del gimnasio.

El admin del gimnasio activa/desactiva el acceso a componentes (módulos) por
usuario. El acceso por defecto viene del rol (`ROLE_DEFAULT_COMPONENTS`) y se
sobreescribe por usuario con la tabla `user_component_permissions`.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.staff import UserComponentPermission

# Catálogo de componentes del panel del gimnasio (slug -> etiqueta)
COMPONENTS: dict[str, str] = {
    "dashboard": "Dashboard",
    "socios": "Socios",
    "membresias": "Membresías",
    "finanzas": "Pagos y cobranza",
    "checkin": "Check-in",
    "crm": "Ventas y leads",
    "productos": "Productos",
    "inteligencia": "Riesgo de abandono",
    "configuracion": "Configuración",
    "auditoria": "Bitácora",
}

COMPONENT_DESCRIPTIONS: dict[str, str] = {
    "dashboard": "Resumen del gimnasio: ingresos, socios, renovaciones y alertas.",
    "socios": "Padrón de socios: altas, perfiles, historial y membresías.",
    "membresias": "Planes de membresía y membresías activas de los socios.",
    "finanzas": "Cobranza: pagos registrados, recibos y morosidad.",
    "checkin": "Registro de entrada por nombre o código QR.",
    "crm": "Pipeline de leads: prospección, seguimiento y conversión.",
    "productos": "Catálogo de productos de venta con existencia y alertas de stock.",
    "inteligencia": "Socios en riesgo de abandono y score de retención.",
    "configuracion": "Gimnasio, sucursales, equipo y accesos.",
    "auditoria": "Bitácora de acciones del sistema.",
}

# Acceso por defecto según el rol
ROLE_DEFAULT_COMPONENTS: dict[str, set[str]] = {
    "admin": set(COMPONENTS),
    "coach": {
        "dashboard",
        "socios",
        "checkin",
        "crm",
        "productos",
        "inteligencia",
    },
    "recepcion": {
        "dashboard",
        "socios",
        "membresias",
        "finanzas",
        "checkin",
        "crm",
        "productos",
        "auditoria",
    },
}


def default_components(role: str) -> set[str]:
    return set(ROLE_DEFAULT_COMPONENTS.get(role, set()))


def get_overrides(db: Session, user_id: str) -> dict[str, bool]:
    """Devuelve {component: allowed} con los overrides del usuario."""
    rows = db.execute(
        select(UserComponentPermission.component, UserComponentPermission.allowed).where(
            UserComponentPermission.user_id == user_id
        )
    ).all()
    return {component: allowed for component, allowed in rows}


def effective_components(db: Session, user_id: str, role: str) -> set[str]:
    """Componentes efectivos = default del rol + overrides del usuario."""
    allowed = default_components(role)
    for component, value in get_overrides(db, user_id).items():
        if value:
            allowed.add(component)
        else:
            allowed.discard(component)
    return allowed


def has_component(db: Session, user_id: str, role: str, component: str) -> bool:
    return component in effective_components(db, user_id, role)


def component_catalog() -> list[dict]:
    return [
        {
            "slug": slug,
            "label": label,
            "description": COMPONENT_DESCRIPTIONS.get(slug, ""),
        }
        for slug, label in COMPONENTS.items()
    ]
