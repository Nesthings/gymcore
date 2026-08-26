"""Integración con WhatsApp Business (Meta Cloud API).

Permite enviar mensajes de texto y plantillas desde el gimnasio usando su
cuenta de WhatsApp Business. El access token NUNCA se expone en respuestas.
"""

import base64
import hashlib
import json
import logging
import urllib.error
import urllib.request

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Gym, OutboundNotification

logger = logging.getLogger("uvicorn.error")

# Código de país por defecto (México).
DEFAULT_COUNTRY_CODE = "52"


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.jwt_secret.encode()).digest())
    return Fernet(key)


def encrypt_token(token: str) -> str:
    return _fernet().encrypt(token.encode()).decode()


def decrypt_token(cipher: str | None) -> str | None:
    if not cipher:
        return None
    try:
        return _fernet().decrypt(cipher.encode()).decode()
    except (InvalidToken, ValueError):
        return None


def normalize_mx(phone: str | None) -> str | None:
    """Normaliza un teléfono a E.164 asumiendo México (52) si falta prefijo."""
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return None
    if len(digits) == 10:
        return f"+{DEFAULT_COUNTRY_CODE}{digits}"
    if len(digits) == 12 and digits.startswith(DEFAULT_COUNTRY_CODE):
        return f"+{digits}"
    if len(digits) == 13 and digits.startswith(DEFAULT_COUNTRY_CODE):
        return f"+{DEFAULT_COUNTRY_CODE}{digits[2:]}"
    return f"+{digits}"


def normalize_any(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return None
    if phone.strip().startswith("+") or len(digits) >= 12:
        return f"+{digits}"
    return normalize_mx(phone)


def gym_whatsapp(db: Session, gym_id) -> dict:
    gym = db.get(Gym, gym_id)
    if gym is None:
        return {
            "enabled": False,
            "phone_number": None,
            "phone_number_id": None,
            "business_account_id": None,
            "token_configured": False,
            "receipt_template": None,
            "renewal_template": None,
            "template_language": "es_MX",
        }
    return {
        "enabled": gym.whatsapp_enabled,
        "phone_number": gym.whatsapp_phone_number,
        "phone_number_id": gym.whatsapp_phone_number_id,
        "business_account_id": gym.whatsapp_business_account_id,
        "token_configured": bool(gym.whatsapp_access_token),
        "receipt_template": gym.whatsapp_receipt_template,
        "renewal_template": gym.whatsapp_renewal_template,
        "template_language": gym.whatsapp_template_language or "es_MX",
    }


def _post_message(db: Session, gym_id, to: str, payload: dict) -> dict:
    gym = db.get(Gym, gym_id)
    if gym is None or not gym.whatsapp_enabled or not gym.whatsapp_phone_number_id:
        return {"ok": False, "external_id": None, "error": "not_configured"}
    token = decrypt_token(gym.whatsapp_access_token)
    if not token:
        return {"ok": False, "external_id": None, "error": "invalid_token"}
    url = (
        f"{settings.whatsapp_graph_base}/{settings.whatsapp_api_version}/"
        f"{gym.whatsapp_phone_number_id}/messages"
    )
    full = {"messaging_product": "whatsapp", "to": to, **payload}
    req = urllib.request.Request(url, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data=json.dumps(full).encode(), timeout=20) as resp:
            body = json.loads(resp.read().decode())
        messages = body.get("messages") or []
        result = {
            "ok": True,
            "external_id": messages[0].get("id") if messages else None,
            "error": None,
        }
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        result = {"ok": False, "external_id": None, "error": f"HTTP {e.code}: {raw[:400]}"}
    except Exception as e:  # noqa: BLE001 - el proveedor falla por muchas razones
        result = {"ok": False, "external_id": None, "error": str(e)[:400]}
    logger.info(
        "whatsapp send gym=%s to=%s type=%s ok=%s error=%s",
        gym_id,
        to,
        payload.get("type"),
        result["ok"],
        (result["error"] or "")[:300],
    )
    return result


def send_text(db: Session, gym_id, to: str, message: str) -> dict:
    payload = {"type": "text", "text": {"preview_url": False, "body": message}}
    return _post_message(db, gym_id, to, payload)


def send_template(
    db: Session,
    gym_id,
    to: str,
    template_name: str,
    language: str = "es_MX",
    body_params: list[str] | None = None,
    header_document_url: str | None = None,
    header_document_filename: str | None = None,
) -> dict:
    template: dict = {"name": template_name, "language": {"code": language}}
    components: list[dict] = []
    if header_document_url:
        document: dict = {"link": header_document_url}
        if header_document_filename:
            document["filename"] = header_document_filename
        components.append(
            {"type": "header", "parameters": [{"type": "document", "document": document}]}
        )
    if body_params:
        components.append(
            {"type": "body", "parameters": [{"type": "text", "text": p} for p in body_params]}
        )
    if components:
        template["components"] = components
    payload = {"type": "template", "template": template}
    return _post_message(db, gym_id, to, payload)


def send_document(
    db: Session,
    gym_id,
    to: str,
    document_url: str,
    filename: str | None = None,
    caption: str | None = None,
) -> dict:
    document: dict = {"link": document_url, "caption": caption or ""}
    if filename:
        document["filename"] = filename
    payload = {"type": "document", "document": document}
    return _post_message(db, gym_id, to, payload)


AUTOMATION_TEMPLATE_FIELDS = {
    "receipt": "whatsapp_receipt_template",
    "renewal": "whatsapp_renewal_template",
}


def send_automation(
    db: Session,
    gym_id,
    to: str,
    kind: str,
    text: str,
    body_params: list[str] | None = None,
    document_url: str | None = None,
    document_filename: str | None = None,
    document_caption: str | None = None,
) -> dict:
    gym = db.get(Gym, gym_id)
    if document_url:
        return send_document(db, gym_id, to, document_url, document_filename, document_caption)
    field = AUTOMATION_TEMPLATE_FIELDS.get(kind)
    template = getattr(gym, field, None) if gym and field else None
    if template:
        language = (gym.whatsapp_template_language if gym else None) or "es_MX"
        return send_template(db, gym_id, to, template, language, body_params)
    return send_text(db, gym_id, to, text)


def record_outbound(
    db: Session,
    gym_id,
    channel: str,
    template: str,
    status: str,
    member_id=None,
    recipient=None,
    external_id=None,
    error=None,
) -> OutboundNotification:
    row = OutboundNotification(
        gym_id=gym_id,
        member_id=member_id,
        channel=channel,
        template=template,
        recipient=recipient,
        external_id=external_id,
        error=error,
        status=status,
    )
    db.add(row)
    return row
