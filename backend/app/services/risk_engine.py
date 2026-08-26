"""Motor de riesgo de abandono (reglas de negocio, sin ML).

Combina señales de asistencia, tendencia, estatus de membresía y cercanía de
renovación para clasificar a cada socio en bajo/medio/alto riesgo con una
acción sugerida. Score 0-100:

- Días sin visitar (mayor peso)
- Tendencia de asistencia (últimos 28 días vs. anteriores 28)
- Membresía vencida o por vencer
"""

from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.orm import Session


def score_to_level(score: int) -> str:
    if score >= 70:
        return "critical"
    if score >= 40:
        return "warning"
    return "info"


def suggested_action(level: str, membership_active: bool, renewal_due_days: int | None) -> str:
    if level == "critical":
        if not membership_active:
            return "Contactar ya con plan de reactivación y oferta especial"
        return "Contactar ya: renovación próxima y plan de retención"
    if level == "warning":
        return "Enviar recordatorio de asistencia y oferta de reactivación"
    return "Mantener engagement: clase de prueba o encuesta rápida"


def _member_risk(db: Session, gym_id: str, row: dict) -> dict:
    """Calcula el score de riesgo de un socio dado su row base."""
    member_id = str(row["id"])
    now = datetime.now(UTC)

    # Último check-in
    last = (
        db.execute(
            text(
                "SELECT MAX(checked_at) AS last_checkin, "
                "COUNT(*) FILTER (WHERE checked_at >= now() - interval '28 days') AS last28, "
                "COUNT(*) FILTER (WHERE checked_at >= now() - interval '56 days' "
                "  AND checked_at < now() - interval '28 days') AS prev28 "
                "FROM checkins WHERE member_id = :mid"
            ),
            {"mid": member_id},
        )
        .mappings()
        .first()
    )

    last_checkin = last["last_checkin"] if last else None
    last28 = last["last28"] or 0
    prev28 = last["prev28"] or 0
    days_inactive = (now - last_checkin).days if last_checkin else 999

    # Membresía vigente
    membership = (
        db.execute(
            text(
                "SELECT mm.id, mm.status, mm.expires_at, p.name AS plan_name "
                "FROM member_memberships mm "
                "JOIN membership_plans p ON p.id = mm.plan_id "
                "WHERE mm.member_id = :mid AND mm.status IN ('active', 'expiring') "
                "ORDER BY mm.expires_at DESC LIMIT 1"
            ),
            {"mid": member_id},
        )
        .mappings()
        .first()
    )

    membership_active = membership is not None
    renewal_due_days: int | None = None
    if membership and membership["expires_at"]:
        renewal_due_days = max(0, (membership["expires_at"] - now).days)
    if not membership_active:
        renewal_due_days = 0

    score = 0
    if days_inactive >= 999 or days_inactive >= 30:
        score += 65
    elif days_inactive >= 22:
        score += 50
    elif days_inactive >= 15:
        score += 35
    elif days_inactive >= 8:
        score += 20

    if not membership_active:
        score += 40
    elif renewal_due_days is not None and renewal_due_days <= 5:
        score += 20
    elif renewal_due_days is not None and renewal_due_days <= 15:
        score += 10

    if last28 == 0 and prev28 > 0:
        score += 25
    elif prev28 > 0 and last28 / prev28 < 0.5:
        score += 20

    score = min(100, score)
    if last28 > prev28 and membership_active:
        score = max(0, score - 10)

    level = score_to_level(score)
    if days_inactive >= 999:
        attendance_trend = "sin registro"
    elif last28 == 0:
        attendance_trend = "inactivo"
    elif prev28 == 0:
        attendance_trend = "nuevo"
    elif last28 < prev28 * 0.5:
        attendance_trend = "bajando"
    else:
        attendance_trend = "estable"

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "phone": row["phone"],
        "status": row["status"],
        "membership_name": membership["plan_name"] if membership else None,
        "last_checkin": last_checkin,
        "days_inactive": 0 if last_checkin is None else days_inactive,
        "risk_score": score,
        "risk_level": level,
        "attendance_trend": attendance_trend,
        "renewal_due_days": renewal_due_days,
        "suggested_action": suggested_action(level, membership_active, renewal_due_days),
    }


def risk_for_gym(db: Session, gym_id: str, limit: int = 100) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT id, full_name, email, phone, status FROM members "
                "WHERE gym_id = :gid AND status != 'cancelled' ORDER BY joined_at DESC LIMIT 500"
            ),
            {"gid": gym_id},
        )
        .mappings()
        .all()
    )
    results = [_member_risk(db, gym_id, row) for row in rows]
    results.sort(key=lambda r: r["risk_score"], reverse=True)
    return results[:limit]


def risk_summary(db: Session, gym_id: str) -> dict:
    members = risk_for_gym(db, gym_id, limit=10000)
    return {
        "total": len(members),
        "critical": sum(1 for m in members if m["risk_level"] == "critical"),
        "warning": sum(1 for m in members if m["risk_level"] == "warning"),
        "info": sum(1 for m in members if m["risk_level"] == "info"),
    }


def member_risk(db: Session, gym_id: str, member_id: str) -> dict | None:
    row = (
        db.execute(
            text(
                "SELECT id, full_name, email, phone, status FROM members "
                "WHERE id = :mid AND gym_id = :gid"
            ),
            {"mid": member_id, "gid": gym_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        return None
    return _member_risk(db, gym_id, row)


def sweep_risk_alerts(db: Session) -> int:
    """Barrido periódico: crea avisos de riesgo crítico (deduplicados).

    Reutiliza el patrón de `smart_alerts`: un socio con riesgo crítico genera
    UNA alerta activa; al dejar de ser crítico se resuelve. Notifica a los
    admins vía campanita interna.
    """
    from sqlalchemy import text as _text

    from app.models import InternalNotification, SmartAlert

    gyms = db.execute(_text("SELECT id FROM gyms")).mappings().all()
    created = 0
    for gym_row in gyms:
        gid = str(gym_row["id"])
        for m in risk_for_gym(db, gid, limit=50):
            if m["risk_level"] != "critical":
                continue
            existing = db.execute(
                _text(
                    "SELECT id FROM smart_alerts WHERE gym_id = :gid "
                    "AND rule_key = 'risk_critical' AND entity_type = 'member' "
                    "AND entity_id = :mid AND status = 'active' LIMIT 1"
                ),
                {"gid": gid, "mid": str(m["id"])},
            ).first()
            if existing:
                continue
            db.add(
                SmartAlert(
                    gym_id=gym_row["id"],
                    rule_key="risk_critical",
                    entity_type="member",
                    entity_id=m["id"],
                    status="active",
                    metadata_json={
                        "risk_score": m["risk_score"],
                        "days_inactive": m["days_inactive"],
                        "membership_name": m["membership_name"],
                    },
                    message=f"{m['full_name']} en riesgo crítico de abandono",
                    link=f"/socios/{m['id']}",
                )
            )
            admins = (
                db.execute(
                    _text(
                        "SELECT id FROM users WHERE gym_id = :gid AND role = 'admin' "
                        "AND is_active = true"
                    ),
                    {"gid": gid},
                )
                .mappings()
                .all()
            )
            for a in admins:
                db.add(
                    InternalNotification(
                        gym_id=gym_row["id"],
                        user_id=a["id"],
                        type="risk",
                        message=(
                            f"Riesgo crítico: {m['full_name']} lleva "
                            f"{m['days_inactive']} días sin asistir"
                        ),
                        link=f"/socios/{m['id']}",
                    )
                )
            created += 1
    db.commit()
    return created
