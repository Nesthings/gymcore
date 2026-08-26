"""Servicio de almacenamiento de media.

MVP: guarda archivos en disco local (`MEDIA_ROOT`) y los expone por la URL
pública `/media/...`.

Producción (Cloudflare R2): cuando existen credenciales R2 configuradas, guarda
los archivos en el bucket R2 (API compatible con S3 vía boto3) y expone URLs
públicas absolutas (`r2_public_base_url`).

La interfaz (`save_media`/`public_url`/`read_media_bytes`) no cambia para los
endpoints: basta con configurar las variables R2 para migrar de disco local a
almacenamiento permanente.
"""

import uuid
from functools import lru_cache
from pathlib import Path

from app.core.config import settings

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_PDF_EXTENSIONS = {".pdf"}

R2_PREFIX = "media"


def r2_enabled() -> bool:
    """True cuando hay un bucket R2 completamente configurado."""
    return bool(
        settings.r2_bucket_name
        and settings.r2_endpoint
        and settings.r2_access_key_id
        and settings.r2_secret_access_key
        and settings.r2_public_base_url
    )


@lru_cache(maxsize=1)
def _r2_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def _r2_public_base() -> str:
    return settings.r2_public_base_url.rstrip("/")


def _r2_key(relative_path: str) -> str:
    return f"{R2_PREFIX}/{relative_path}"


def media_root_path() -> Path:
    root = Path(settings.media_root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_media(relative_dir: str, filename: str, content: bytes) -> str:
    """Guarda un archivo y devuelve su ruta relativa (ej. `summaries/xxx.pdf`).

    `relative_dir` es un segmento como `pets`, `summaries` o `consultations`.
    Evita colisiones renombrando con un sufijo UUID. En producción el archivo
    se sube al bucket R2; en desarrollo se escribe en disco local.
    """
    suffix = Path(filename).suffix.lower()
    safe_name = f"{uuid.uuid4().hex[:12]}_{Path(filename).stem[:40]}{suffix}"
    relative_path = f"{relative_dir}/{safe_name}"

    if r2_enabled():
        _r2_client().put_object(
            Bucket=settings.r2_bucket_name,
            Key=_r2_key(relative_path),
            Body=content,
        )
    else:
        target_dir = media_root_path() / relative_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / safe_name).write_bytes(content)

    return relative_path


def public_url(relative_path: str) -> str:
    """URL pública de un archivo.

    Con R2 activo devuelve la URL absoluta del bucket (`r2_public_base_url` +
    prefijo `media/`, que coincide con la clave real en R2); en desarrollo, la
    ruta relativa servida por FastAPI (`/media/...`).
    """
    if r2_enabled():
        return f"{_r2_public_base()}/{R2_PREFIX}/{relative_path}"
    return f"/media/{relative_path}"


def media_path_from_url(url: str | None) -> Path | None:
    """Resuelve una URL pública `/media/...` al Path local, si existe."""
    if not url or not url.startswith("/media/"):
        return None
    p = media_root_path() / url[len("/media/") :]
    return p if p.is_file() else None


def read_media_bytes(url: str | None) -> bytes | None:
    """Lee el contenido binario de una URL de media.

    Soporta URLs absolutas de R2 (fetch desde el bucket) y rutas locales
    `/media/...` (disco, para retrocompatibilidad durante la transición).
    """
    if not url:
        return None
    if r2_enabled() and url.startswith(_r2_public_base()):
        key = url[len(_r2_public_base()) :].lstrip("/")
        try:
            resp = _r2_client().get_object(Bucket=settings.r2_bucket_name, Key=key)
            return resp["Body"].read()
        except Exception:
            return None
    p = media_path_from_url(url)
    if p is None:
        return None
    try:
        return p.read_bytes()
    except OSError:
        return None


def validate_extension(filename: str, allowed: set[str]) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in allowed:
        raise ValueError(
            f"Extensión no permitida: {suffix or '(sin extensión)'}. "
            f"Permitidas: {', '.join(sorted(allowed))}"
        )
