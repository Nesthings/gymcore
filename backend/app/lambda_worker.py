"""AWS Lambda handler: worker de mensajes disparado por SQS.

La cola `gymcore-whatsapp` dispara esta función. Procesa cada mensaje (envía
por el proveedor activo y actualiza `outbound_notifications`) y la Lambda se
apaga (escala a cero).
"""

import json
import logging

from app.services.queue import process_message

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    records = event.get("Records", [])
    for record in records:
        try:
            job = json.loads(record.get("body", "{}"))
            res = process_message(job)
            logger.info(
                "whatsapp job gym=%s kind=%s to=%s ok=%s",
                job.get("gym_id"),
                job.get("kind"),
                job.get("to"),
                res.get("ok"),
            )
        except Exception:  # noqa: BLE001 - un mensaje malo no debe abortar el batch
            logger.exception("mensaje SQS inválido, se eliminará tras maxReceive")
    return {"statusCode": 200}
