"""Webhooks de WhatsApp Business (Meta Cloud API).

Meta verifica el endpoint con una petición GET (`hub.mode`, `hub.verify_token`,
`hub.challenge`) y luego envía los eventos (mensajes entrantes y actualizaciones
de estado) por POST. El endpoint es público (no requiere auth de la app).

El verify token se configura en `settings.whatsapp_webhook_verify_token`.
"""

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
    """Acepta los eventos de Meta. Meta exige un 200 inmediato."""
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
