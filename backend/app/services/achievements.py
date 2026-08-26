"""Sistema de logros del socio — reglas deterministas sobre su actividad.

Cada logro tiene `unlocked` (bool), `progress` (0-1) y una etiqueta de
progreso legible. Los logros se calculan en vivo desde check-ins, pesos y
rachas (sin persistencia, siempre consistentes con los datos reales).
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.engagement import engagement

CATALOG = [
    ("primer_entrenamiento", "🥇", "Primer entrenamiento", "Completa tu primer check-in"),
    ("racha_7d", "🔥", "7 días consecutivos", "Entrena 7 días seguidos"),
    ("racha_30d", "🔥", "30 días consecutivos", "Entrena 30 días seguidos"),
    ("visitas_50", "💯", "50 visitas", "Acumula 50 entrenamientos"),
    ("visitas_100", "🏆", "100 visitas", "Acumula 100 entrenamientos"),
    ("manana_10", "🌅", "10 entrenamientos antes de las 8 AM", "Entrena 10 veces temprano"),
    ("noche_10", "🌙", "10 entrenamientos después de las 8 PM", "Entrena 10 veces de noche"),
    ("peso_10", "⚖️", "Registrar peso 10 veces", "Registra tu peso 10 veces"),
    ("record_personal", "📈", "Nuevo récord personal", "Supera tu mejor racha o tu mayor semana"),
    ("4_semana", "🎯", "Entrenar 4 veces en una semana", "Entrena 4 días en la semana actual"),
    ("semana_completa", "🗓️", "Entrenar todos los días una semana", "Completa 7 días en una semana"),
]

KEY_TO_META = {key: (emoji, title, desc) for key, emoji, title, desc in CATALOG}


def _metrics(db: Session, gym_id: str, member_id: str) -> dict:
    gid = str(gym_id)
    mid = str(member_id)
    eng = engagement(db, gid, mid)

    total = (
        db.execute(
            text("SELECT COUNT(*) FROM checkins WHERE member_id = :mid"), {"mid": mid}
        ).scalar()
        or 0
    )
    antes8 = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM checkins WHERE member_id = :mid "
                "AND checked_at::time < '08:00'"
            ),
            {"mid": mid},
        ).scalar()
        or 0
    )
    despues20 = (
        db.execute(
            text(
                "SELECT COUNT(*) FROM checkins WHERE member_id = :mid "
                "AND checked_at::time >= '20:00'"
            ),
            {"mid": mid},
        ).scalar()
        or 0
    )
    pesos = (
        db.execute(
            text("SELECT COUNT(*) FROM member_weight_records WHERE member_id = :mid"),
            {"mid": mid},
        ).scalar()
        or 0
    )

    dias_semana = (
        db.execute(
            text(
                "SELECT COUNT(DISTINCT checked_at::date) FROM checkins "
                "WHERE member_id = :mid AND checked_at >= date_trunc('week', now())"
            ),
            {"mid": mid},
        ).scalar()
        or 0
    )

    max_semanal = (
        db.execute(
            text(
                "SELECT COALESCE(MAX(cnt), 0) FROM ("
                "  SELECT COUNT(DISTINCT checked_at::date) AS cnt FROM checkins "
                "  WHERE member_id = :mid GROUP BY date_trunc('week', checked_at)"
                ") t"
            ),
            {"mid": mid},
        ).scalar()
        or 0
    )

    return {
        "total": total,
        "current_streak": eng["current_streak"],
        "best_streak": eng["best_streak"],
        "antes8": antes8,
        "despues20": despues20,
        "pesos": pesos,
        "dias_semana": dias_semana,
        "max_semanal": max_semanal,
    }


def _progress(key: str, m: dict) -> tuple[float, str]:
    def pct(value: int, target: int) -> tuple[float, str]:
        return min(1.0, value / target), f"{min(value, target)}/{target}"

    if key == "primer_entrenamiento":
        return (1.0, "Completado") if m["total"] >= 1 else (0.0, "0/1")
    if key == "racha_7d":
        return pct(m["current_streak"], 7)
    if key == "racha_30d":
        return pct(m["current_streak"], 30)
    if key == "visitas_50":
        return pct(m["total"], 50)
    if key == "visitas_100":
        return pct(m["total"], 100)
    if key == "manana_10":
        return pct(m["antes8"], 10)
    if key == "noche_10":
        return pct(m["despues20"], 10)
    if key == "peso_10":
        return pct(m["pesos"], 10)
    if key == "4_semana":
        return pct(m["dias_semana"], 4)
    if key == "semana_completa":
        return pct(m["dias_semana"], 7)
    # record_personal
    record_streak = m["current_streak"] >= 3 and m["current_streak"] == m["best_streak"]
    record_semana = m["dias_semana"] >= 5 and m["dias_semana"] == m["max_semanal"]
    unlocked = record_streak or record_semana
    return (1.0 if unlocked else 0.0, "¡Récord!" if unlocked else "Persigue tu récord")


def achievements_for(db: Session, gym_id: str, member_id: str) -> dict:
    m = _metrics(db, gym_id, member_id)
    items = []
    unlocked = 0
    for key, emoji, title, desc in CATALOG:
        progress, label = _progress(key, m)
        is_unlocked = key in (
            "primer_entrenamiento",
            "racha_7d",
            "racha_30d",
            "visitas_50",
            "visitas_100",
            "manana_10",
            "noche_10",
            "peso_10",
            "4_semana",
            "semana_completa",
        ) and (
            (key == "primer_entrenamiento" and m["total"] >= 1)
            or (key == "racha_7d" and m["current_streak"] >= 7)
            or (key == "racha_30d" and m["current_streak"] >= 30)
            or (key == "visitas_50" and m["total"] >= 50)
            or (key == "visitas_100" and m["total"] >= 100)
            or (key == "manana_10" and m["antes8"] >= 10)
            or (key == "noche_10" and m["despues20"] >= 10)
            or (key == "peso_10" and m["pesos"] >= 10)
            or (key == "4_semana" and m["dias_semana"] >= 4)
            or (key == "semana_completa" and m["dias_semana"] >= 7)
        )
        if key == "record_personal":
            is_unlocked = progress >= 1.0
        if is_unlocked:
            unlocked += 1
        items.append(
            {
                "key": key,
                "emoji": emoji,
                "title": title,
                "description": desc,
                "unlocked": is_unlocked,
                "progress": round(progress, 2),
                "progress_label": label,
            }
        )
    return {
        "summary": {"unlocked": unlocked, "locked": len(items) - unlocked, "total": len(items)},
        "items": items,
    }
