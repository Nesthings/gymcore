"""Configuración de pruebas: crea una BD Postgres de prueba y aplica migraciones."""

import os
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, text

ADMIN_URL = os.environ.get(
    "GYMCORE_TEST_ADMIN_URL",
    "postgresql+psycopg://gymcore:gymcore_dev@localhost:5434/postgres",
)
TEST_DB = os.environ.get("GYMCORE_TEST_DB", "gymcore_test")
TEST_URL = f"postgresql+psycopg://gymcore:gymcore_dev@localhost:5434/{TEST_DB}"

os.environ["DATABASE_URL"] = TEST_URL


@pytest.fixture(scope="session", autouse=True)
def _database():
    admin = create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_DB}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{TEST_DB}"'))
    admin.dispose()

    from alembic.config import Config

    from alembic import command

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", TEST_URL)
    command.upgrade(cfg, "head")
    yield


@pytest.fixture
def db_session(_database):
    from app.db.session import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def clean_tables(_database):
    from app.db.session import SessionLocal

    session = SessionLocal()
    try:
        session.execute(
            text(
                "TRUNCATE audit_log, internal_notifications, outbound_notifications, "
                "smart_alerts, smart_alert_rules, checkins, payments, "
                "member_memberships, leads, members, membership_plans, "
                "user_component_permissions, users, gym_subscription_events, "
                "gym_invites, gym_branches, gyms RESTART IDENTITY CASCADE"
            )
        )
        session.commit()
    finally:
        session.close()


@pytest.fixture
def make_gym(db_session):
    from app.models import Gym, GymBranch

    def _make(name: str = "Gimnasio Test") -> tuple[Gym, GymBranch]:
        gym = Gym(name=name, subscription_status="active", currency="MXN")
        db_session.add(gym)
        db_session.flush()
        branch = GymBranch(gym_id=gym.id, name="Sucursal 1")
        db_session.add(branch)
        db_session.flush()
        db_session.commit()
        return gym, branch

    return _make


@pytest.fixture
def make_member(db_session):
    from app.models import Member

    def _make(gym, name: str = "Socio Test") -> Member:
        member = Member(gym_id=gym.id, full_name=name, status="active")
        db_session.add(member)
        db_session.flush()
        db_session.commit()
        return member

    return _make


@pytest.fixture
def make_plan(db_session):
    from app.models import MembershipPlan

    def _make(gym, name: str = "Mensual", price: float = 899, days: int = 30) -> MembershipPlan:
        plan = MembershipPlan(
            gym_id=gym.id, name=name, price=price, duration_days=days, is_active=True
        )
        db_session.add(plan)
        db_session.flush()
        db_session.commit()
        return plan

    return _make


@pytest.fixture
def make_membership(db_session):
    from datetime import UTC, datetime

    from app.models import MemberMembership

    def _make(
        gym,
        member,
        plan,
        starts_at=None,
        expires_at=None,
        status: str = "active",
    ) -> MemberMembership:
        now = datetime.now(UTC)
        row = MemberMembership(
            gym_id=gym.id,
            member_id=member.id,
            plan_id=plan.id,
            starts_at=starts_at or now,
            expires_at=expires_at or (now + timedelta(days=plan.duration_days)),
            status=status,
        )
        db_session.add(row)
        db_session.commit()
        return row

    return _make


def now_utc() -> datetime:
    return datetime.now(UTC)
