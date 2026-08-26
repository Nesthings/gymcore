"""Métricas de engagement del socio: rachas, visitas y progreso.

Cálculo por reglas sobre los check-ins (sin ML):
- Racha actual: días consecutivos con visita terminando hoy (o ayer si hoy
  aún no hay check-in).
- Mejor racha: corrida consecutiva más larga histórica.
- Visitas: total, últimos 30 días y promedio semanal (rolling 28 días).
"""

from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session


def _distinct_days(db: Session, member_id: str) -> list[date]:
    rows = (
        db.execute(
            text(
                "SELECT DISTINCT checked_at::date AS d FROM checkins "
                "WHERE member_id = :mid ORDER BY d"
            ),
            {"mid": member_id},
        )
        .mappings()
        .all()
    )
    return [r["d"] for r in rows]


def compute_streaks(
    days: list[date],
    today: date | None = None,
    grace_days: int = 0,
) -> tuple[int, int]:
    """Devuelve (racha_actual, mejor_racha) en días.

    `grace_days`: N días de descanso consecutivos no rompen la racha
    (protección de racha configurable por el gimnasio).
    `today` debe venir de la misma fuente de tiempo que los check-ins (la BD).
    """
    if not days:
        return 0, 0
    days = sorted(set(days))
    day_set = set(days)
    today = today or date.today()
    anchor = today if today in day_set else today - timedelta(days=1)
    current = 0
    missed = 0
    d = anchor
    while d in day_set or missed <= grace_days:
        if d in day_set:
            current += 1
            missed = 0
        else:
            missed += 1
        d -= timedelta(days=1)

    best = 0
    run_days: list[date] = []
    for d in days:
        if run_days and (d - run_days[-1]).days <= grace_days + 1:
            run_days.append(d)
        else:
            run_days = [d]
        best = max(best, len(run_days))
    return current, best


def engagement(db: Session, gym_id: str, member_id: str, grace_days: int = 0) -> dict:
    days = _distinct_days(db, member_id)
    db_today = db.execute(text("SELECT current_date")).scalar()
    current_streak, best_streak = compute_streaks(days, today=db_today, grace_days=grace_days)

    total = db.execute(
        text("SELECT COUNT(*) FROM checkins WHERE member_id = :mid"),
        {"mid": member_id},
    ).scalar()
    visits_30d = db.execute(
        text(
            "SELECT COUNT(DISTINCT checked_at::date) FROM checkins "
            "WHERE member_id = :mid AND checked_at >= now() - interval '30 days'"
        ),
        {"mid": member_id},
    ).scalar()
    visits_28d = db.execute(
        text(
            "SELECT COUNT(DISTINCT checked_at::date) FROM checkins "
            "WHERE member_id = :mid AND checked_at >= now() - interval '28 days'"
        ),
        {"mid": member_id},
    ).scalar()
    total_min = db.execute(
        text(
            "SELECT COALESCE(SUM(duration_min), 0) FROM checkins "
            "WHERE member_id = :mid AND duration_min IS NOT NULL"
        ),
        {"mid": member_id},
    ).scalar()

    weights = (
        db.execute(
            text(
                "SELECT id, weight_kg, notes, recorded_at FROM member_weight_records "
                "WHERE member_id = :mid ORDER BY recorded_at ASC"
            ),
            {"mid": member_id},
        )
        .mappings()
        .all()
    )
    weight_records = [
        {
            "id": str(w["id"]),
            "weight_kg": float(w["weight_kg"]),
            "notes": w["notes"],
            "recorded_at": w["recorded_at"],
        }
        for w in weights
    ]

    last_checkins = (
        db.execute(
            text(
                "SELECT checked_at, checked_out_at, duration_min FROM checkins "
                "WHERE member_id = :mid ORDER BY checked_at DESC LIMIT 30"
            ),
            {"mid": member_id},
        )
        .mappings()
        .all()
    )

    return {
        "checkin_count": total or 0,
        "current_streak": current_streak,
        "best_streak": best_streak,
        "visits_30d": visits_30d or 0,
        "avg_visits_per_week": round((visits_28d or 0) / 4, 1),
        "total_training_min": total_min or 0,
        "weight_records": weight_records,
        "last_checkins": [
            {
                "checked_at": c["checked_at"],
                "checked_out_at": c["checked_out_at"],
                "duration_min": c["duration_min"],
            }
            for c in last_checkins
        ],
    }
