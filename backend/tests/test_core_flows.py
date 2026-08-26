"""Pruebas del motor de riesgo de abandono y de flujos core del gimnasio."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.services import risk_engine


def test_risk_engine_rewards_attending_member(
    db_session, make_gym, make_member, make_plan, make_membership
):
    gym, _ = make_gym()
    member = make_member(gym)
    plan = make_plan(gym)
    make_membership(gym, member, plan)
    db_session.execute(
        text(
            "INSERT INTO checkins (gym_id, member_id, checked_at) VALUES "
            "(:gid, :mid, now() - interval '1 day')"
        ),
        {"gid": gym.id, "mid": member.id},
    )
    db_session.commit()
    risk = risk_engine.member_risk(db_session, str(gym.id), str(member.id))
    assert risk is not None
    assert risk["risk_level"] == "info"
    assert risk["days_inactive"] <= 2


def test_risk_engine_flags_inactive_member(db_session, make_gym, make_member):
    gym, _ = make_gym()
    member = make_member(gym)
    # Sin check-ins ni membresía: debe ser crítico
    risk = risk_engine.member_risk(db_session, str(gym.id), str(member.id))
    assert risk is not None
    assert risk["risk_level"] == "critical"
    assert risk["risk_score"] >= 70


def test_risk_summary_counts(db_session, make_gym, make_member):
    gym, _ = make_gym()
    make_member(gym)
    summary = risk_engine.risk_summary(db_session, str(gym.id))
    assert summary["total"] == 1
    assert summary["critical"] == 1


def test_assign_and_renew_membership(db_session, make_gym, make_member, make_plan):
    gym, _ = make_gym()
    member = make_member(gym)
    plan = make_plan(gym, days=30)
    from app.models import MemberMembership

    mm = MemberMembership(
        gym_id=gym.id,
        member_id=member.id,
        plan_id=plan.id,
        starts_at=datetime.now(UTC),
        expires_at=datetime.now(UTC) + timedelta(days=30),
        status="active",
    )
    db_session.add(mm)
    db_session.commit()
    assert mm.status == "active"
    assert mm.checkins_used == 0
    # Simula la renovación (extensión de expiración)
    mm.expires_at = mm.expires_at + timedelta(days=30)
    db_session.commit()
    assert mm.expires_at > datetime.now(UTC) + timedelta(days=55)


def test_lead_conversion_creates_member(db_session, make_gym):
    gym, _ = make_gym()
    from app.models import Lead, Member

    lead = Lead(gym_id=gym.id, full_name="Lead Test", status="nuevo", value=899)
    db_session.add(lead)
    db_session.commit()
    lead.status = "ganado"
    member = Member(gym_id=gym.id, full_name=lead.full_name, email=lead.email)
    db_session.add(member)
    db_session.commit()
    assert lead.status == "ganado"
    assert member.id is not None


# --------------------------------------------------------------------------
# Portal del socio: token de acceso, rachas y pesos
# --------------------------------------------------------------------------


def test_share_token_resolution_and_expiry(db_session, make_gym, make_member):
    from datetime import UTC, datetime, timedelta

    from fastapi import HTTPException

    from app.api.member_share import _resolve_member

    gym, _ = make_gym()
    member = make_member(gym)
    member.share_token = "tok-vigente"
    member.share_expires_at = datetime.now(UTC) + timedelta(days=60)
    db_session.commit()

    resolved = _resolve_member(db_session, "tok-vigente")
    assert resolved.id == member.id

    member.share_expires_at = datetime.now(UTC) - timedelta(days=1)
    db_session.commit()
    try:
        _resolve_member(db_session, "tok-vigente")
        raise AssertionError("debería rechazar el token expirado")
    except HTTPException as exc:
        assert exc.status_code == 410


def test_streak_calculation(db_session, make_gym, make_member):
    from datetime import date, timedelta

    from app.services.engagement import compute_streaks

    today = date.today()
    # Visitas hoy y ayer -> racha actual 2; mejor racha 3 (mar-mar-mar)
    days = [
        today - timedelta(days=2),
        today - timedelta(days=1),
        today,
    ]
    current, best = compute_streaks(days)
    assert current == 3
    assert best == 3

    # Sin visita hoy pero sí ayer -> racha actual 1 (ancla ayer)
    days2 = [today - timedelta(days=1), today - timedelta(days=4)]
    current2, best2 = compute_streaks(days2)
    assert current2 == 1
    assert best2 == 1

    # Sin visitas
    assert compute_streaks([]) == (0, 0)


def test_engagement_counts_checkins(db_session, make_gym, make_member, make_plan, make_membership):

    from sqlalchemy import text

    from app.services.engagement import engagement

    gym, _ = make_gym()
    member = make_member(gym)
    plan = make_plan(gym)
    make_membership(gym, member, plan)

    db_session.execute(
        text(
            "INSERT INTO checkins (gym_id, member_id, checked_at, checked_out_at, duration_min) "
            "VALUES (:gid, :mid, now() - interval '1 hour', now() - interval '30 minutes', 30)"
        ),
        {"gid": gym.id, "mid": member.id},
    )
    db_session.execute(
        text(
            "INSERT INTO checkins (gym_id, member_id, checked_at) "
            "VALUES (:gid, :mid, now() - interval '1 day')"
        ),
        {"gid": gym.id, "mid": member.id},
    )
    db_session.commit()

    eng = engagement(db_session, str(gym.id), str(member.id))
    assert eng["checkin_count"] == 2
    assert eng["current_streak"] == 2
    assert eng["total_training_min"] == 30
    assert eng["weight_records"] == []


def test_weight_record_create_and_list(db_session, make_gym, make_member):
    from app.models import MemberWeightRecord

    gym, _ = make_gym()
    member = make_member(gym)
    db_session.add(
        MemberWeightRecord(gym_id=gym.id, member_id=member.id, weight_kg=80.5, notes="prueba")
    )
    db_session.commit()

    from app.services.engagement import engagement

    eng = engagement(db_session, str(gym.id), str(member.id))
    assert len(eng["weight_records"]) == 1
    assert eng["weight_records"][0]["weight_kg"] == 80.5
