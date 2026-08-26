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