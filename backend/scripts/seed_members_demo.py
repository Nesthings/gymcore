"""Seed de socios de demostración (35 registros completos).

Crea 35 socios con TODOS los campos poblados, membresía activa (plan + pago) y
fotos descargadas de un servicio de avatares de uso libre (randomuser.me),
guardadas en el almacenamiento local (`media/members/<id>/profile.jpg`).
Además agrega check-ins históricos y algunos socios "dentro" (sesión abierta).

Uso:  .venv/bin/python -m scripts.seed_members_demo
"""

import random
import urllib.request
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Checkin, Gym, GymBranch, Member, MemberMembership, MembershipPlan, Payment

random.seed(20260921)

MEDIA_ROOT = Path("media")

MALE_NAMES = [
    "Carlos", "Luis", "Miguel", "José", "Juan", "Diego", "Fernando", "Ricardo",
    "Alejandro", "Sergio", "Raúl", "Héctor", "Óscar", "Manuel", "Javier",
    "Roberto", "Eduardo", "Andrés", "Marco", "Pablo", "Adrián", "Iván",
    "Rodrigo", "Emilio", "Gustavo", "Felipe", "Salvador", "Alberto", "Ernesto",
    "Rafael",
]
FEMALE_NAMES = [
    "María", "Ana", "Laura", "Sofía", "Fernanda", "Gabriela", "Paola", "Diana",
    "Claudia", "Alejandra", "Verónica", "Karla", "Mónica", "Lucía", "Valeria",
    "Daniela", "Andrea", "Mariana", "Regina", "Ximena", "Brenda", "Carolina",
    "Elena", "Renata", "Isabella", "Patricia", "Adriana", "Natalia", "Rosa",
    "Silvia",
]
LAST_NAMES = [
    "García", "Hernández", "Martínez", "López", "González", "Pérez", "Rodríguez",
    "Sánchez", "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez",
    "Jiménez", "Reyes", "Torres", "Ramos", "Mendoza", "Ortiz", "Castillo",
    "Aguilar", "Méndez", "Guzmán", "Rojas", "Silva", "Contreras", "Ríos",
    "Cortés", "Núñez",
]

NOTES_POOL = [
    "Entrena por la mañana, prefiere área de pesas.",
    "Objetivo: bajar de peso y mejorar condición.",
    "Lesión previa de rodilla; evitar sentadilla profunda.",
    "Interesado en rutinas de fuerza.",
    "Asiste de lunes a viernes por la tarde.",
    "Pidió asesoría nutricional.",
    "Principiante, requiere inducción de equipos.",
    "Entrena para maratón (cardio).",
    None,
    None,
]


def _slug(text: str) -> str:
    return (
        text.lower()
        .replace("á", "a").replace("é", "e").replace("í", "i")
        .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
        .replace(" ", "")
    )


def _phone() -> str:
    return f"8{random.randint(10, 99)}{random.randint(1000000, 9999999)}"


def _download_photo(gender: str, index: int, dest: Path) -> str | None:
    kind = "men" if gender == "hombre" else "women"
    url = f"https://randomuser.me/api/portraits/{kind}/{index}.jpg"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "GymCoreSeeder/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        return f"/media/members/{dest.parent.name}/profile.jpg"
    except Exception as exc:  # noqa: BLE001
        print(f"  ! no se pudo descargar foto {url}: {exc}")
        return None


def _status_for(expires_at: datetime) -> str:
    return "expiring" if (expires_at - datetime.now(UTC)).days <= 7 else "active"


def main() -> None:
    db = SessionLocal()
    try:
        gym = db.scalar(select(Gym).order_by(Gym.created_at).limit(1))
        if gym is None:
            raise SystemExit("No hay gimnasios. Crea uno primero.")
        branch = db.scalar(select(GymBranch).where(GymBranch.gym_id == gym.id))

        plans = list(db.scalars(select(MembershipPlan).where(MembershipPlan.gym_id == gym.id)))
        if not plans:
            plans = [
                MembershipPlan(gym_id=gym.id, name="Mensual", price=899, duration_days=30, is_active=True),
                MembershipPlan(gym_id=gym.id, name="Trimestral", price=2399, duration_days=90, is_active=True),
                MembershipPlan(gym_id=gym.id, name="Anual", price=7999, duration_days=365, is_active=True),
            ]
            db.add_all(plans)
            db.flush()

        men_idx = random.sample(range(1, 99), 18)
        women_idx = random.sample(range(1, 99), 17)
        photo_seq = {"hombre": iter(men_idx), "mujer": iter(women_idx)}
        used_emails: set[str] = {
            e for e in db.scalars(select(Member.email).where(Member.gym_id == gym.id)) if e
        }

        def next_photo_index(gender: str) -> int:
            try:
                return next(photo_seq[gender])
            except StopIteration:
                return random.randint(1, 98)

        created = 0
        inside_slots = 8  # socios con sesión abierta (aparecen "dentro")

        for i in range(35):
            gender = random.choice(["hombre", "mujer"])
            first = random.choice(MALE_NAMES if gender == "hombre" else FEMALE_NAMES)
            last1 = random.choice(LAST_NAMES)
            last2 = random.choice(LAST_NAMES)
            full_name = f"{first} {last1} {last2}"

            base_email = f"{_slug(first)}.{_slug(last1)}{i}@example.com"
            email = base_email
            while email in used_emails:
                email = f"{_slug(first)}.{_slug(last1)}.{uuid.uuid4().hex[:4]}@example.com"
            used_emails.add(email)

            birth = date(random.randint(1975, 2005), random.randint(1, 12), random.randint(1, 28))
            joined = datetime.now(UTC) - timedelta(days=random.randint(20, 400))

            member = Member(
                gym_id=gym.id,
                full_name=full_name,
                email=email,
                phone=_phone(),
                birth_date=birth,
                gender=gender,
                emergency_contact=f"{random.choice(LAST_NAMES)} {random.choice(LAST_NAMES)}",
                emergency_phone=_phone(),
                status="active",
                notes=random.choice(NOTES_POOL),
                joined_at=joined,
            )
            db.add(member)
            db.flush()

            # Foto de uso libre, guardada localmente.
            photo_url = _download_photo(
                gender,
                next_photo_index(gender),
                MEDIA_ROOT / "members" / str(member.id) / "profile.jpg",
            )
            if photo_url:
                member.photo_url = photo_url

            # Membresía activa + pago.
            plan = random.choice(plans)
            starts = datetime.now(UTC) - timedelta(days=random.randint(1, 25))
            expires = datetime.now(UTC) + timedelta(days=random.randint(10, plan.duration_days - 1))
            membership = MemberMembership(
                gym_id=gym.id,
                member_id=member.id,
                plan_id=plan.id,
                branch_id=branch.id if branch else None,
                starts_at=starts,
                expires_at=expires,
                status=_status_for(expires),
                checkins_used=random.randint(0, 12),
                paid_amount=plan.price,
            )
            db.add(membership)
            db.flush()

            db.add(
                Payment(
                    gym_id=gym.id,
                    member_id=member.id,
                    membership_id=membership.id,
                    branch_id=branch.id if branch else None,
                    amount=plan.price,
                    method=random.choice(["cash", "card", "transfer"]),
                    status="paid",
                    concept=f"Membresía {plan.name}",
                    paid_at=starts,
                )
            )

            # Historial de check-ins (para engagement y riesgo).
            for _ in range(random.randint(3, 12)):
                checked = datetime.now(UTC) - timedelta(
                    days=random.randint(1, 60), hours=random.randint(6, 21)
                )
                db.add(
                    Checkin(
                        gym_id=gym.id,
                        member_id=member.id,
                        membership_id=membership.id,
                        branch_id=branch.id if branch else None,
                        checked_at=checked,
                        checked_out_at=checked + timedelta(minutes=random.randint(35, 110)),
                        duration_min=random.randint(35, 110),
                    )
                )

            # Algunos socios con sesión abierta hoy (ocupación en vivo).
            if i < inside_slots:
                db.add(
                    Checkin(
                        gym_id=gym.id,
                        member_id=member.id,
                        membership_id=membership.id,
                        branch_id=branch.id if branch else None,
                        checked_at=datetime.now(UTC) - timedelta(minutes=random.randint(12, 180)),
                    )
                )

            created += 1

        db.commit()
        print(f"Listo: {created} socios creados en «{gym.name}» con membresía activa y foto.")
    finally:
        db.close()


if __name__ == "__main__":
    main()