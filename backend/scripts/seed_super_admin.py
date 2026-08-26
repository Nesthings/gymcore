"""Seed del super-admin inicial (dueño del producto).

Idempotente: si ya existe un super-admin con ese email, no se duplica.
Lee las credenciales de variables de entorno (SUPER_ADMIN_*).

Uso:
    .venv/bin/python -m scripts.seed_super_admin
"""

from sqlalchemy import text

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal


def seed() -> None:
    email = settings.super_admin_email
    password = settings.super_admin_password
    name = settings.super_admin_name

    if not password or password in ("change-me-in-production",):
        raise SystemExit(
            "SUPER_ADMIN_PASSWORD no configurada o es la default. "
            "Configúrala en .env antes de ejecutar el seed."
        )

    with SessionLocal() as db:
        existing = db.execute(
            text("SELECT id FROM super_admins WHERE email = :email"),
            {"email": email},
        ).scalar()
        if existing:
            print(f"Super-admin '{email}' ya existe. Nada que hacer.")
            return
        db.execute(
            text(
                "INSERT INTO super_admins (email, password_hash, full_name) "
                "VALUES (:email, :hash, :name)"
            ),
            {"email": email, "hash": hash_password(password), "name": name},
        )
        db.commit()
        print(f"Super-admin '{email}' creado.")


if __name__ == "__main__":
    seed()
