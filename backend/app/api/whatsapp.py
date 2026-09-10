"""Webhooks de WhatsApp Business (Meta Cloud API).

Meta verifica el endpoint con una petición GET (`hub.mode`, `hub.verify_token`,
`hub.challenge`) y luego envía los eventos (mensajes entrantes y actualizaciones
de estado) por POST. El endpoint es público (no requiere auth de la app).

El verify token se configura en `settings.whatsapp_webhook_verify_token`.
"""

import hashlib
import hmac
import logging

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp-webhook"])


@router.get("/webhook", summary="Verificación del webhook de WhatsApp")
def webhook_verify(request: Request):
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    if mode == "subscribe" and token == settings.whatsapp_webhook_verify_token and challenge:
        return PlainTextResponse(content=challenge)
    return PlainTextResponse(content="Verification failed", status_code=403)


@router.post("/webhook", summary="Recibe eventos de WhatsApp (mensajes/estados)")
async def webhook_receive(request: Request) -> dict:
    """Acepta los eventos de Meta. Meta exige un 200 inmediato.

    Si `WHATSAPP_APP_SECRET` está configurado, se valida la firma
    `X-Hub-Signature-256` (HMAC-SHA256 del body con el app secret). Sin secreto
    configurado (dev) se acepta y se registra una advertencia.
    """
    raw = await request.body()
    if settings.whatsapp_app_secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(
            settings.whatsapp_app_secret.encode(), raw, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            logger.warning("WhatsApp webhook: firma inválida")
            return {"status": "ok"}  # no exponer el motivo; Meta espera 200
    else:
        logger.warning("WhatsApp webhook sin WHATSAPP_APP_SECRET: no se valida la firma")
    try:
        body = await request.json()
        # Registro básico de los mensajes entrantes y estados.
        for entry in body.get("entry") or []:
            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                phone_number_id = value.get("metadata", {}).get("phone_number_id")
                for msg in value.get("messages") or []:
                    logger.info(
                        "entrada phone=%s from=%s type=%s",
                        phone_number_id,
                        msg.get("from"),
                        msg.get("type"),
                    )
                for st in value.get("statuses") or []:
                    logger.info(
                        "estado id=%s status=%s msg_id=%s",
                        st.get("id"),
                        st.get("status"),
                        st.get("message_id"),
                    )
    except Exception:  # noqa: BLE001 - nunca fallar el ack a Meta
        pass
    return {"status": "ok"}
