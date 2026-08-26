"""Utilidades de seguridad: hashing de contraseñas y tokens JWT."""

from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(
    subject: str,
    role: str,
    gym_id: str | None = None,
    branch_id: str | None = None,
) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": subject,
        "role": role,
        "exp": expire,
        "iat": datetime.now(UTC),
    }
    if gym_id is not None:
        payload["gym_id"] = gym_id
    if branch_id is not None:
        payload["branch_id"] = branch_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


class InvalidTokenError(ValueError):
    pass


def get_token_payload(token: str) -> dict:
    try:
        return decode_token(token)
    except JWTError as exc:
        raise InvalidTokenError("Token inválido o expirado") from exc


def create_reset_token() -> tuple[str, datetime]:
    """Token de recuperación de contraseña del staff (devuelto en dev)."""
    import secrets

    expire = datetime.now(UTC) + timedelta(minutes=30)
    return secrets.token_urlsafe(32), expire
