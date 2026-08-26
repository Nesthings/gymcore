"""Cola de mensajes salientes (Amazon SQS).

Patrón async orientado a eventos:
- Productor (FastAPI): `dispatch()` encola el trabajo en SQS (o lo envía de
  forma síncrona en dev si no hay SQS configurado).
- Worker (AWS Lambda con trigger SQS): `process_message()` recibe el job,
  resuelve el gimnasio, envía por WhatsApp Business y actualiza
  `outbound_notifications`.

Modo dual: si `SQS_QUEUE_URL` está configurada se encola; si no, se envía
síncrono (dev sin AWS).
"""

import json
import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Gym, OutboundNotification
from app.services.whatsapp import record_outbound, send_automation

logger = logging.getLogger("uvicorn.error")


def sqs_configured() -> bool:
    return bool(settings.sqs_queue_url)


def _sqs():
    import boto3

    return boto3.client(
        "sqs",
        region_name=settings.sqs_region or None,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
    )


def enqueue_message(payload: dict) -> dict:
    """Encola un job de mensaje en SQS. Retorna {ok, message_id, error}."""
    if not sqs_configured():
        return {"ok": False, "message_id": None, "error": "not_configured"}
    try:
        resp = _sqs().send_message(
            QueueUrl=settings.sqs_queue_url,
            MessageBody=json.dumps(payload, ensure_ascii=False),
        )
        return {"ok": True, "message_id": resp.get("MessageId"), "error": None}
    except Exception as e:  # noqa: BLE001 - fallos del proveedor de cola
        logger.error("sqs enqueue error: %s", e)
        return {"ok": False, "message_id": None, "error": str(e)[:400]}


def dispatch(
    db: Session,
    gym_id,
    kind: str,
    to: str,
    text: str,
    body_params: list[str] | None,
    template: str,
    member_id=None,
    document_url: str | None = None,
    document_filename: str | None = None,
    document_caption: str | None = None,
) -> dict:
    """Encola el mensaje (si SQS configurado) o lo envía síncrono (dev)."""
    if sqs_configured():
        record_outbound(
            db,
            gym_id,
            "whatsapp",
            template,
            "queued",
            member_id=member_id,
            recipient=to,
        )
        job = {
            "gym_id": str(gym_id),
            "kind": kind,
            "to": to,
            "text": text,
            "body_params": body_params or [],
            "member_id": str(member_id) if member_id else None,
            "template": template,
            "document_url": document_url,
            "document_filename": document_filename,
            "document_caption": document_caption,
        }
        res = enqueue_message(job)
        if not res["ok"]:
            row = (
                db.query(OutboundNotification)
                .filter(
                    OutboundNotification.gym_id == gym_id,
                    OutboundNotification.template == template,
                )
                .order_by(OutboundNotification.sent_at.desc())
                .first()
            )
            if row:
                row.status = "failed"
                row.error = res["error"]
        return res
    res = send_automation(
        db,
        gym_id,
        to,
        kind,
        text,
        body_params,
        document_url,
        document_filename,
        document_caption,
    )
    status = (
        "sent"
        if res["ok"]
        else ("not_configured" if res["error"] == "not_configured" else "failed")
    )
    record_outbound(
        db,
        gym_id,
        "whatsapp",
        template,
        status,
        member_id=member_id,
        recipient=to,
        external_id=res["external_id"],
        error=res["error"],
    )
    return res


def process_message(job: dict) -> dict:
    """Procesa un job de SQS (usado por la Lambda worker). Envía y registra."""
    db = SessionLocal()
    try:
        gym_id = job.get("gym_id")
        to = job.get("to", "")
        kind = job.get("kind", "")
        text = job.get("text", "")
        body_params = job.get("body_params") or None
        template = job.get("template")
        member_id = job.get("member_id")
        res = send_automation(
            db,
            gym_id,
            to,
            kind,
            text,
            body_params,
            document_url=job.get("document_url"),
            document_filename=job.get("document_filename"),
            document_caption=job.get("document_caption"),
        )
        status = (
            "sent"
            if res["ok"]
            else ("not_configured" if res["error"] == "not_configured" else "failed")
        )
        row = (
            db.query(OutboundNotification)
            .filter(
                OutboundNotification.gym_id == gym_id,
                OutboundNotification.template == template,
            )
            .order_by(OutboundNotification.sent_at.desc())
            .first()
        )
        if row is not None:
            row.status = status
            row.recipient = to
            row.external_id = res["external_id"]
            row.error = res["error"]
        else:
            record_outbound(
                db,
                gym_id,
                "whatsapp",
                template,
                status,
                member_id=member_id,
                recipient=to,
                external_id=res["external_id"],
                error=res["error"],
            )
        db.commit()
        return res
    except Exception as e:  # noqa: BLE001 - nunca romper el batch de SQS
        logger.error("sqs process_message error: %s", e)
        db.rollback()
        raise
    finally:
        db.close()


def gym_exists(db: Session, gym_id) -> bool:
    return db.get(Gym, gym_id) is not None
