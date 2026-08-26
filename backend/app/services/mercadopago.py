"""Integración con Mercado Pago (checkout Preferences + webhook).

MVP: al registrar un pago con method=mercadopago se crea una preferencia de
checkout; el socio paga en el checkout de Mercado Pago y el webhook
`/api/v1/payments/webhook/mercadopago` confirma el pago.

Sin SDK: llamadas HTTP directas a la API de Mercado Pago (con urllib para no
agregar dependencias).
"""

import json
import logging
import urllib.error
import urllib.request

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

MP_API_BASE = "https://api.mercadopago.com"


def _request(method: str, path: str, body: dict | None = None) -> dict:
    token = settings.mercadopago_access_token
    if not token:
        return {"ok": False, "error": "not_configured"}
    url = f"{MP_API_BASE}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        data = json.dumps(body).encode() if body is not None else None
        with urllib.request.urlopen(req, data=data, timeout=20) as resp:
            parsed = json.loads(resp.read().decode())
        return {"ok": True, **parsed}
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        logger.error("mercado pago %s %s -> HTTP %s: %s", method, path, e.code, raw[:400])
        return {"ok": False, "error": f"HTTP {e.code}: {raw[:300]}"}
    except Exception as e:  # noqa: BLE001
        logger.error("mercado pago %s %s error: %s", method, path, e)
        return {"ok": False, "error": str(e)[:300]}


def create_preference(
    *,
    title: str,
    amount: float,
    external_reference: str,
    gym_name: str,
) -> dict:
    """Crea una preferencia de checkout. Devuelve {ok, id, init_point}."""
    body = {
        "items": [
            {
                "title": title,
                "quantity": 1,
                "unit_price": round(float(amount), 2),
                "currency_id": "MXN",
            }
        ],
        "external_reference": external_reference,
        "payer": {"name": gym_name},
        "back_urls": {
            "success": "/",
            "pending": "/",
            "failure": "/",
        },
        "auto_return": "approved",
        "notification_url": "/api/v1/payments/webhook/mercadopago",
    }
    res = _request("POST", "/checkout/preferences", body)
    if not res["ok"]:
        return res
    return {"ok": True, "id": res.get("id"), "init_point": res.get("init_point")}


def get_payment(payment_id: str) -> dict:
    """Consulta el estado de un pago en Mercado Pago."""
    res = _request("GET", f"/v1/payments/{payment_id}")
    return res
