"""Tests de seguridad, multi-tenancy y lógica crítica.

Cubren los huecos detectados en la auditoría:
- Aislamiento cross-tenant (IDOR) en miembros, equipos y pagos.
- Autorización por rol (solo admin muta usuarios/sucursales).
- Check-in sin duplicados (sesión única).
- Notificaciones "marcar todas" scoped al usuario.
- Reset de contraseña (flujo dev con token).
- Pase/invitación de un solo uso.
- Mantenimiento: completar recalcula próxima fecha.
- Clamp de posición de equipos al plano.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text


@pytest.fixture(scope="module")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


def _make_user(db, gym, role="admin", email=None):
    from app.core.security import hash_password
    from app.models import User

    email = email or f"staff-{uuid.uuid4().hex[:8]}@test.dev"
    user = User(
        gym_id=gym.id,
        role=role,
        full_name="Staff Test",
        email=email,
        password_hash=hash_password("TestGym123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _token(client, email, password="TestGym123"):
    r = client.post("/api/v1/auth/login", json={"identifier": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _staff_token(client, db, gym, role="admin"):
    user = _make_user(db, gym, role=role)
    return _token(client, user.email), user


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Multi-tenancy / IDOR
# ---------------------------------------------------------------------------


def test_cross_tenant_member_idor(client, db_session, make_gym, make_member):
    gym_a, _ = make_gym("Gimnasio A")
    gym_b, _ = make_gym("Gimnasio B")
    member_b = make_member(gym_b, "Miembro de B")

    token_a, _ = _staff_token(client, db_session, gym_a)
    r = client.get(f"/api/v1/members/{member_b.id}", headers=_headers(token_a))
    assert r.status_code == 404, r.text

    r = client.patch(
        f"/api/v1/members/{member_b.id}",
        headers=_headers(token_a),
        json={"notes": "hack"},
    )
    assert r.status_code == 404, r.text


def test_cross_tenant_equipment_idor(client, db_session, make_gym):
    gym_a, _ = make_gym("Gimnasio A")
    gym_b, _ = make_gym("Gimnasio B")

    from app.models import EquipmentAsset

    asset_b = EquipmentAsset(
        gym_id=gym_b.id,
        custom_name="Prensa de B",
        position_x=2,
        position_y=2,
    )
    db_session.add(asset_b)
    db_session.commit()

    token_a, _ = _staff_token(client, db_session, gym_a)
    r = client.get(f"/api/v1/equipment/{asset_b.id}", headers=_headers(token_a))
    assert r.status_code == 404, r.text

    r = client.patch(
        f"/api/v1/equipment/{asset_b.id}/position",
        headers=_headers(token_a),
        json={"position_x": 5, "position_y": 5, "rotation": 0},
    )
    assert r.status_code == 404, r.text


def test_cross_tenant_receipt_idor(client, db_session, make_gym, make_member, make_plan, make_membership):
    gym_a, _ = make_gym("Gimnasio A")
    gym_b, _ = make_gym("Gimnasio B")
    member_b = make_member(gym_b)
    plan_b = make_plan(gym_b)
    mm = make_membership(gym_b, member_b, plan_b)

    from app.models import Payment

    pay = Payment(gym_id=gym_b.id, member_id=member_b.id, amount=100, method="cash", status="paid")
    db_session.add(pay)
    db_session.commit()

    token_a, _ = _staff_token(client, db_session, gym_a)
    r = client.get(f"/api/v1/payments/{pay.id}/receipt", headers=_headers(token_a))
    assert r.status_code == 404, r.text


def test_user_mutations_require_admin(client, db_session, make_gym):
    gym, _ = make_gym()
    token_rec, _ = _staff_token(client, db_session, gym, role="recepcion")
    admin = _make_user(db_session, gym, role="admin", email="boss@test.dev")

    r = client.patch(f"/api/v1/users/{admin.id}", headers=_headers(token_rec), json={"job_title": "x"})
    assert r.status_code == 403, r.text

    r = client.post(
        "/api/v1/users",
        headers=_headers(token_rec),
        json={"full_name": "Otro", "email": "other@test.dev", "password": "TestGym123", "role": "recepcion"},
    )
    assert r.status_code == 403, r.text


def test_branch_mutations_require_admin(client, db_session, make_gym):
    gym, _ = make_gym()
    token_rec, _ = _staff_token(client, db_session, gym, role="recepcion")
    r = client.post("/api/v1/branches", headers=_headers(token_rec), json={"name": "Suc"})
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------------------
# Check-in duplicado (sesión única)
# ---------------------------------------------------------------------------


def test_checkin_no_duplicate_session(client, db_session, make_gym, make_member, make_plan, make_membership):
    gym, _ = make_gym()
    member = make_member(gym)
    plan = make_plan(gym)
    make_membership(gym, member, plan)

    token, _ = _staff_token(client, db_session, gym)
    first = client.post("/api/v1/checkin", headers=_headers(token), json={"member_id": str(member.id)})
    assert first.status_code == 200 and first.json()["action"] == "checkin", first.text

    second = client.post("/api/v1/checkin", headers=_headers(token), json={"member_id": str(member.id)})
    assert second.status_code == 200
    assert second.json()["action"] == "already_in", second.text


# ---------------------------------------------------------------------------
# Notificaciones: "marcar todas" scoped al usuario
# ---------------------------------------------------------------------------


def test_read_all_only_marks_own(client, db_session, make_gym):
    gym, _ = make_gym()
    u1 = _make_user(db_session, gym, role="admin", email="u1@test.dev")
    u2 = _make_user(db_session, gym, role="admin", email="u2@test.dev")

    from app.models import InternalNotification

    db_session.add_all(
        [
            InternalNotification(gym_id=gym.id, user_id=u1.id, type="risk", message="m1"),
            InternalNotification(gym_id=gym.id, user_id=u2.id, type="risk", message="m2"),
        ]
    )
    db_session.commit()

    token1 = _token(client, u1.email)
    r = client.post("/api/v1/notifications/read-all", headers=_headers(token1))
    assert r.status_code == 204

    from sqlalchemy import select

    u2_unread = db_session.scalar(
        select(InternalNotification)
        .where(InternalNotification.user_id == u2.id, InternalNotification.read_at.is_(None))
        .limit(1)
    )
    assert u2_unread is not None, "El read-all del usuario 1 no debe marcar leídas las del usuario 2"


# ---------------------------------------------------------------------------
# Reset de contraseña (dev: token en la respuesta)
# ---------------------------------------------------------------------------


def test_forgot_reset_password(client, db_session, make_gym):
    gym, _ = make_gym()
    user = _make_user(db_session, gym, role="admin", email="reset@test.dev")

    r = client.post("/api/v1/auth/forgot-password", json={"email": user.email})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("reset_token"), "En dev se debe devolver el reset_token"

    r = client.post(
        "/api/v1/auth/reset-password",
        json={"token": body["reset_token"], "password": "NuevaClave123"},
    )
    assert r.status_code == 204, r.text

    ok = client.post("/api/v1/auth/login", json={"identifier": user.email, "password": "NuevaClave123"})
    assert ok.status_code == 200, ok.text


# ---------------------------------------------------------------------------
# Invitación de gimnasio: un solo uso
# ---------------------------------------------------------------------------


def test_gym_invite_single_use(client, db_session):
    from app.models import GymInvite

    inv = GymInvite(
        token="inv-single-use-0001",
        expires_at=datetime.now(UTC) + timedelta(days=30),
        status="pending",
    )
    db_session.add(inv)
    db_session.commit()

    payload = {
        "invite_token": inv.token,
        "name": "Gym Nuevo",
        "admin_name": "Admin",
        "admin_email": "nuevo@test.dev",
        "admin_password": "TestGym123",
    }
    r = client.post("/api/v1/create-gym", json=payload)
    assert r.status_code == 200, r.text

    r2 = client.post("/api/v1/create-gym", json=payload)
    assert r2.status_code in (400, 409), r2.text


# ---------------------------------------------------------------------------
# Mantenimiento: completar recalcula la próxima fecha
# ---------------------------------------------------------------------------


def test_maintenance_complete_recalculates(client, db_session, make_gym):
    gym, _ = make_gym()

    from app.models import EquipmentAsset, MaintenanceTask

    asset = EquipmentAsset(gym_id=gym.id, custom_name="Cinta", position_x=1, position_y=1)
    db_session.add(asset)
    db_session.commit()

    token, _ = _staff_token(client, db_session, gym)
    created = client.post(
        f"/api/v1/equipment/{asset.id}/maintenance",
        headers=_headers(token),
        json={"name": "Lubricación", "task_type": "lubrication", "interval_days": 30, "frequency": "monthly"},
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]

    done = client.post(
        f"/api/v1/equipment/{asset.id}/maintenance/{task_id}/complete",
        headers=_headers(token),
        json={"notes": "ok"},
    )
    assert done.status_code == 200, done.text
    next_due = datetime.fromisoformat(done.json()["next_due_at"].replace("Z", "+00:00"))
    delta = (next_due - datetime.now(UTC)).total_seconds() / 86400
    assert 29 <= delta <= 31, f"next_due debe estar ~30 días después, delta={delta}"


# ---------------------------------------------------------------------------
# Layout: clamp de posición al plano
# ---------------------------------------------------------------------------


def test_equipment_position_clamped(client, db_session, make_gym):
    gym, _ = make_gym()

    from app.models import EquipmentAsset

    asset = EquipmentAsset(gym_id=gym.id, custom_name="Prensa", position_x=1, position_y=1)
    db_session.add(asset)
    db_session.commit()

    token, _ = _staff_token(client, db_session, gym)
    r = client.patch(
        f"/api/v1/equipment/{asset.id}/position",
        headers=_headers(token),
        json={"position_x": 100, "position_y": 200, "rotation": 0},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["position_x"] <= 29.9, data
    assert data["position_y"] <= 17.9, data


# ---------------------------------------------------------------------------
# Soporte: el autor solo ve sus tickets
# ---------------------------------------------------------------------------


def test_support_ticket_visibility(client, db_session, make_gym):
    gym, _ = make_gym()
    u1 = _make_user(db_session, gym, role="admin", email="sop1@test.dev")
    u2 = _make_user(db_session, gym, role="recepcion", email="sop2@test.dev")

    from app.models import SupportTicket

    t1 = SupportTicket(
        reporter_user_id=u1.id, reporter_role="staff", reporter_name="U1",
        reporter_email=u1.email, gym_id=gym.id, subject="S1", description="d", status="open",
    )
    db_session.add(t1)
    db_session.commit()

    token2 = _token(client, u2.email)
    r = client.get(f"/api/v1/support-tickets/{t1.id}", headers=_headers(token2))
    assert r.status_code == 403, r.text  # otro staff no puede ver el ticket ajeno