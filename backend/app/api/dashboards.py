"""Builders de datos para los dashboards del gimnasio.

`GET /dashboards/data?slugs=...&period=day|week|month&branch_id=...` devuelve
un dict `{slug: data}` con la forma que espera `DashboardChart` del frontend.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, require_component
from app.db.session import get_db
from app.services.risk_engine import risk_for_gym

router = APIRouter(prefix="/dashboards", tags=["dashboards"])

# Resumen operativo de las tarjetas del Dashboard (lo consume /dashboard/summary)
summary_router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@summary_router.get("/summary")
def dashboard_summary(
    ctx: CurrentGym = Depends(require_component("dashboard")),
    db: Session = Depends(get_db),
    period: str = Query(default="week", pattern="^(day|week|month)$"),
) -> dict:
    from app.api.gyms import gym_summary_data

    return gym_summary_data(db, str(ctx.gym["id"]))


PERIODS = ("day", "week", "month")


def _months_labels(n: int = 6) -> list[str]:
    now = datetime.now(UTC)
    out = []
    for i in range(n - 1, -1, -1):
        d = (now.replace(day=1) - timedelta(days=i * 31)).replace(day=1)
        out.append(d.strftime("%b"))
    return out


def _ingresos(db: Session, gid: str) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT to_char(date_trunc('month', paid_at), 'Mon') AS label, "
                "COALESCE(SUM(amount), 0) AS value "
                "FROM payments WHERE gym_id = :gid AND status = 'paid' "
                "AND paid_at >= date_trunc('month', now()) - interval '5 months' "
                "GROUP BY 1 ORDER BY MIN(date_trunc('month', paid_at))"
            ),
            {"gid": gid},
        )
        .mappings()
        .all()
    )
    by_label = {r["label"]: float(r["value"]) for r in rows}
    return [{"label": m, "value": by_label.get(m, 0)} for m in _months_labels()]


def _nuevas_membresias(db: Session, gid: str) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT to_char(date_trunc('month', starts_at), 'Mon') AS label, COUNT(*) AS value "
                "FROM member_memberships WHERE gym_id = :gid "
                "AND starts_at >= date_trunc('month', now()) - interval '5 months' "
                "GROUP BY 1 ORDER BY MIN(date_trunc('month', starts_at))"
            ),
            {"gid": gid},
        )
        .mappings()
        .all()
    )
    by_label = {r["label"]: int(r["value"]) for r in rows}
    return [{"label": m, "value": by_label.get(m, 0)} for m in _months_labels()]


def _cancelaciones(db: Session, gid: str) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT COALESCE(cancel_reason, 'Sin motivo') AS name, COUNT(*) AS value "
                "FROM member_memberships WHERE gym_id = :gid AND status = 'cancelled' "
                "AND cancel_reason != 'sustituida' AND cancel_reason != 'baja socio' "
                "GROUP BY 1 ORDER BY value DESC LIMIT 6"
            ),
            {"gid": gid},
        )
        .mappings()
        .all()
    )
    return [{"name": r["name"], "value": int(r["value"])} for r in rows]


def _checkins_semana(db: Session, gid: str) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT to_char(checked_at, 'Dy') AS name, COUNT(*) AS value "
                "FROM checkins WHERE gym_id = :gid AND checked_at >= now() - interval '7 days' "
                "GROUP BY 1 ORDER BY MIN(checked_at)"
            ),
            {"gid": gid},
        )
        .mappings()
        .all()
    )
    return [{"name": r["name"], "value": int(r["value"])} for r in rows]


def _morosidad(db: Session, gid: str) -> list[dict]:
    """Socios activos sin membresía vigente, agrupados por antigüedad del adeudo."""
    buckets = [
        ("< 30 días", "now() - interval '30 days'"),
        ("30-60 días", "now() - interval '60 days'"),
        ("> 60 días", "now() - interval '180 days'"),
    ]
    out = []
    for label, cutoff in buckets:
        count = db.execute(
            text(
                "SELECT COUNT(*) FROM members m WHERE m.gym_id = :gid AND m.status = 'active' "
                "AND NOT EXISTS (SELECT 1 FROM member_memberships mm WHERE mm.member_id = m.id "
                "AND mm.status IN ('active', 'expiring')) "
                f"AND m.joined_at < {cutoff}"
            ),
            {"gid": gid},
        ).scalar()
        out.append({"name": label, "value": int(count or 0)})
    return out


def _conversion_leads(db: Session, gid: str) -> list[dict]:
    rows = (
        db.execute(
            text(
                "SELECT to_char(date_trunc('month', created_at), 'Mon') AS label, "
                "COUNT(*) AS total, "
                "COUNT(*) FILTER (WHERE status = 'ganado') AS won "
                "FROM leads WHERE gym_id = :gid "
                "AND created_at >= date_trunc('month', now()) - interval '5 months' "
                "GROUP BY 1 ORDER BY MIN(date_trunc('month', created_at))"
            ),
            {"gid": gid},
        )
        .mappings()
        .all()
    )
    by_label = {r["label"]: (int(r["total"]), int(r["won"])) for r in rows}
    return [
        {"label": m, "a": by_label.get(m, (0, 0))[0], "b": by_label.get(m, (0, 0))[1]}
        for m in _months_labels()
    ]


def _riesgo(db: Session, gid: str) -> dict:
    members = risk_for_gym(db, gid, limit=30)
    summary = {"critical": 0, "warning": 0, "info": 0, "success": 0}
    items = []
    for m in members:
        summary[m["risk_level"]] = summary.get(m["risk_level"], 0) + 1
        if m["risk_level"] == "info":
            continue
        items.append(
            {
                "id": str(m["id"]),
                "rule_key": "risk_critical" if m["risk_level"] == "critical" else "risk_warning",
                "severity": m["risk_level"],
                "title": f"Riesgo {m['risk_level']} · {m['risk_score']}/100",
                "description": m["suggested_action"],
                "member_name": m["full_name"],
                "member_id": str(m["id"]),
                "triggered_at": datetime.now(UTC).isoformat(),
                "link": f"/socios/{m['id']}",
            }
        )
    summary["total"] = len(items)
    return {"summary": summary, "items": items[:20]}


BUILDERS = {
    "ingresos_mensuales": _ingresos,
    "nuevas_membresias": _nuevas_membresias,
    "cancelaciones": _cancelaciones,
    "checkins_semana": _checkins_semana,
    "morosidad": _morosidad,
    "conversion_leads": _conversion_leads,
    "riesgo_abandono": _riesgo,
}


@router.get("/data")
def dashboard_data(
    ctx: CurrentGym = Depends(require_component("dashboard")),
    db: Session = Depends(get_db),
    slugs: str = Query(...),
    period: str = Query(default="week", pattern="^(day|week|month)$"),
    branch_id: str | None = None,
) -> dict:
    gid = str(ctx.gym["id"])
    requested = [s.strip() for s in slugs.split(",") if s.strip()]
    result: dict = {}
    for slug in requested:
        builder = BUILDERS.get(slug)
        if builder is None:
            result[slug] = []
            continue
        try:
            result[slug] = builder(db, gid)
        except Exception:  # noqa: BLE001 - un dashboard no debe romper el resto
            result[slug] = []
    return result
