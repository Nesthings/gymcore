"""Envío de correos por SMTP (recibos, recordatorios y automatizaciones).

Requiere credenciales SMTP en el entorno (host, puerto, usuario, contraseña,
remitente). Registra cada envío en `outbound_notifications` (channel email).
"""

import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.whatsapp import record_outbound

logger = logging.getLogger("uvicorn.error")


def smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def send_email(
    db: Session,
    gym_id,
    to: str,
    subject: str,
    body: str,
    gym_name: str | None = None,
    template: str | None = None,
    member_id=None,
) -> dict:
    """Envía un correo por SMTP y registra el resultado."""
    if not smtp_configured():
        return {"ok": False, "external_id": None, "error": "not_configured"}
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            if settings.smtp_starttls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        result = {"ok": True, "external_id": None, "error": None}
    except Exception as e:  # noqa: BLE001 - el proveedor falla por muchas razones
        result = {"ok": False, "external_id": None, "error": str(e)[:400]}
    record_outbound(
        db,
        gym_id,
        "email",
        template or f"email:{to[:20]}",
        "sent" if result["ok"] else "failed",
        member_id=member_id,
        recipient=to,
        external_id=result["external_id"],
        error=result["error"],
    )
    logger.info(
        "email send gym=%s to=%s ok=%s error=%s",
        gym_id,
        to,
        result["ok"],
        (result["error"] or "")[:300],
    )
    return result
