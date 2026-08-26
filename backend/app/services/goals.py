"""Progreso de objetivos personales del socio."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.engagement import engagement


def _current_weight(db: Session, member_id: str) -> float | None:
    row = (
        db.execute(
            text(
                "SELECT weight_kg FROM member_weight_records WHERE member_id = :mid "
                "ORDER BY recorded_at ASC LIMIT 1"
            ),
            {"mid": member_id},
        )
        .mappings()
        .first()
    )
    last = (
        db.execute(
            text(
                "SELECT weight_kg FROM member_weight_records WHERE member_id = :mid "
                "ORDER BY recorded_at DESC LIMIT 1"
            ),
            {"mid": member_id},
        )
        .mappings()
        .first()
    )
    return (float(last["weight_kg"]) if last else None, float(row["weight_kg"]) if row else None)


def goal_progress(db: Session, gym_id: str, member_id: str, goal: dict) -> dict:
    """Calcula {current, target, progress(0-1), label} de un objetivo."""
    gtype = goal["goal_type"]
    target = float(goal["target_value"])
    mid = str(member_id)
    gid = str(gym_id)

    if gtype == "peso":
        current, start = _current_weight(db, mid)
        if current is None or start is None or target == start:
            return {
                "current": current,
                "target": target,
                "progress": 0.0,
                "label": "registra tu peso",
            }
        if target < start:  # bajar de peso
            progress = (start - current) / (start - target)
        else:  # subir de peso
            progress = (current - start) / (target - start)
        return {
            "current": current,
            "target": target,
            "progress": round(min(1.0, max(0.0, progress)), 2),
            "label": f"{current} / {target} kg",
        }

    if gtype == "entrenamientos_semana":
        dias = (
            db.execute(
                text(
                    "SELECT COUNT(DISTINCT checked_at::date) FROM checkins "
                    "WHERE member_id = :mid AND checked_at >= date_trunc('week', now())"
                ),
                {"mid": mid},
            ).scalar()
            or 0
        )
        return {
            "current": dias,
            "target": target,
            "progress": round(min(1.0, dias / target), 2),
            "label": f"{min(dias, int(target))}/{int(target)} esta semana",
        }

    if gtype == "visitas_mes":
        dias = (
            db.execute(
                text(
                    "SELECT COUNT(DISTINCT checked_at::date) FROM checkins "
                    "WHERE member_id = :mid AND checked_at >= date_trunc('month', now())"
                ),
                {"mid": mid},
            ).scalar()
            or 0
        )
        return {
            "current": dias,
            "target": target,
            "progress": round(min(1.0, dias / target), 2),
            "label": f"{min(dias, int(target))}/{int(target)} este mes",
        }

    if gtype == "tiempo_entrenado":
        minutos = (
            db.execute(
                text(
                    "SELECT COALESCE(SUM(duration_min), 0) FROM checkins "
                    "WHERE member_id = :mid AND checked_at >= date_trunc('month', now()) "
                    "AND duration_min IS NOT NULL"
                ),
                {"mid": mid},
            ).scalar()
            or 0
        )
        return {
            "current": minutos,
            "target": target,
            "progress": round(min(1.0, minutos / target), 2),
            "label": f"{min(minutos, int(target))}/{int(target)} min",
        }

    if gtype == "consistencia":
        eng = engagement(db, gid, mid)
        return {
            "current": eng["current_streak"],
            "target": target,
            "progress": round(min(1.0, eng["current_streak"] / target), 2),
            "label": f"racha {min(eng['current_streak'], int(target))}/{int(target)}",
        }

    # personalizado: por defecto usa las visitas del mes
    dias = (
        db.execute(
            text(
                "SELECT COUNT(DISTINCT checked_at::date) FROM checkins "
                "WHERE member_id = :mid AND checked_at >= date_trunc('month', now())"
            ),
            {"mid": mid},
        ).scalar()
        or 0
    )
    return {
        "current": dias,
        "target": target,
        "progress": round(min(1.0, dias / target), 2),
        "label": f"{min(dias, int(target))}/{int(target)}",
    }
