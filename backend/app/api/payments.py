"""Pagos y cobranza — por-tenant.

Registro de pagos (cash/card/transfer/mercadopago), listado con filtros,
recibo PDF y webhook de confirmación de Mercado Pago.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.core.events import record_audit
from app.db.session import get_db
from app.models import Member, Payment
from app.schemas.payment import PaymentCreate, PaymentRead
from app.services import mercadopago

router = APIRouter(tags=["payments"])


def _to_payment_read(db: Session, p: Payment) -> dict:
    member = db.get(Member, p.member_id)
    return {
        "id": p.id,
        "member_id": p.member_id,
        "member_name": member.full_name if member else "—",
        "amount": float(p.amount),
        "method": p.method,
        "status": p.status,
        "concept": p.concept,
        "notes": p.notes,
        "mp_checkout_url": p.mp_checkout_url,
        "external_ref": p.external_ref,
        "paid_at": p.paid_at,
        "created_at": p.created_at,
    }


@router.get("/payments", response_model=list[PaymentRead])
def list_payments(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    method: str | None = Query(default=None, pattern="^(cash|card|transfer|mercadopago)$"),
    status_: str | None = Query(
        default=None, alias="status", pattern="^(paid|pending|failed|refunded)$"
    ),
    member_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    sql = "SELECT * FROM payments WHERE gym_id = :gid"
    params: dict = {"gid": str(ctx.gym["id"])}
    if from_:
        sql += " AND paid_at >= :from_"
        params["from_"] = from_
    if to:
        sql += " AND paid_at <= :to"
        params["to"] = to
    if method:
        sql += " AND method = :method"
        params["method"] = method
    if status_:
        sql += " AND status = :status"
        params["status"] = status_
    if member_id:
        sql += " AND member_id = :mid"
        params["mid"] = member_id
    sql += " ORDER BY paid_at DESC LIMIT :limit"
    params["limit"] = limit
    rows = db.execute(text(sql), params).mappings().all()
    payments = [Payment(**{k: v for k, v in r.items()}) for r in rows]
    return [_to_payment_read(db, p) for p in payments]


@router.post("/payments", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def create_payment(
    body: PaymentCreate,
    ctx: CurrentGym = Depends(require_component("finanzas")),
    db: Session = Depends(get_db),
) -> dict:
    member = db.scalar(
        select(Member).where(Member.id == body.member_id, Member.gym_id == ctx.gym["id"])
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Socio no encontrado")

    if body.method == "mercadopago":
        return _init_mercadopago(db, ctx, body, member)

    payment = Payment(
        gym_id=ctx.gym["id"],
        member_id=member.id,
        amount=body.amount,
        method=body.method,
        status="paid",
        concept=body.concept,
        notes=body.notes,
        paid_at=body.paid_at or datetime.now(UTC),
        created_by=ctx.user.sub,
    )
    db.add(payment)
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="payment_created",
        entity_type="member",
        entity_id=member.id,
        metadata={"amount": float(body.amount), "method": body.method},
    )
    db.commit()
    db.refresh(payment)
    return _to_payment_read(db, payment)


def _init_mercadopago(
    db: Session,
    ctx: CurrentGym,
    body: PaymentCreate,
    member: Member,
) -> dict:
    """Crea una preferencia de checkout en Mercado Pago (pago pendiente)."""
    gym_name = ctx.gym["name"]
    payment = Payment(
        gym_id=ctx.gym["id"],
        member_id=member.id,
        amount=body.amount,
        method="mercadopago",
        status="pending",
        concept=body.concept,
        notes=body.notes,
        paid_at=body.paid_at or datetime.now(UTC),
        created_by=ctx.user.sub,
    )
    db.add(payment)
    db.flush()
    external_ref = str(payment.id)
    payment.external_ref = external_ref
    title = body.concept or f"Membresía {member.full_name}"
    res = mercadopago.create_preference(
        title=title,
        amount=float(body.amount),
        external_reference=external_ref,
        gym_name=gym_name,
    )
    if not res["ok"]:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo iniciar el pago con Mercado Pago: {res.get('error')}",
        )
    payment.mp_preference_id = res["id"]
    payment.mp_checkout_url = res["init_point"]
    db.commit()
    db.refresh(payment)
    return _to_payment_read(db, payment)


@router.get("/payments/{payment_id}/receipt", summary="Recibo del pago en PDF")
def payment_receipt(
    payment_id: str,
    ctx: CurrentGym = Depends(require_component("finanzas")),
    db: Session = Depends(get_db),
):
    """Genera un recibo simple en PDF (ReportLab)."""
    from io import BytesIO

    from fastapi.responses import Response
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    payment = db.scalar(
        select(Payment).where(Payment.id == payment_id, Payment.gym_id == ctx.gym["id"])
    )
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    member = db.get(Member, payment.member_id)

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=LETTER, title=f"Recibo {payment.id}")
    styles = getSampleStyleSheet()
    flow = [
        Paragraph(f"<b>{ctx.gym['name']}</b>", styles["Title"]),
        Spacer(1, 6),
        Paragraph("Comprobante de pago", styles["Heading2"]),
        Spacer(1, 12),
        Table(
            [
                ["Socio", member.full_name if member else "—"],
                ["Concepto", payment.concept or "—"],
                ["Método", payment.method],
                ["Monto", f"$ {float(payment.amount):,.2f} MXN"],
                ["Fecha", payment.paid_at.strftime("%d/%m/%Y %H:%M")],
                ["Folio", str(payment.id)],
            ],
            colWidths=[110, 340],
        ).setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        ),
        Spacer(1, 12),
        Paragraph(
            "Este comprobante se generó automáticamente. No constituye factura fiscal.",
            styles["Italic"],
        ),
    ]
    doc.build(flow)
    data = buf.getvalue()
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="recibo-{payment.id}.pdf"'},
    )


@router.post(
    "/payments/webhook/mercadopago",
    summary="Webhook de confirmación de pago (Mercado Pago)",
    include_in_schema=False,
)
async def mercadopago_webhook(body: dict, db: Session = Depends(get_db)) -> dict:
    """Recibe la notificación de Mercado Pago y confirma el pago."""
    try:
        mp_id = str(body.get("data", {}).get("id", ""))
        if not mp_id:
            return {"ok": True}
        res = mercadopago.get_payment(mp_id)
        if not res["ok"]:
            return {"ok": False, "error": res.get("error")}
        status_ = res.get("status")
        external_ref = res.get("external_reference")
        if not external_ref:
            return {"ok": True}
        payment = db.get(Payment, uuid.UUID(external_ref))
        if payment is None:
            return {"ok": True}
        payment.mp_payment_id = mp_id
        if status_ == "approved":
            payment.status = "paid"
        elif status_ in ("rejected", "cancelled", "refunded"):
            payment.status = "failed" if status_ != "refunded" else "refunded"
        db.commit()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001 - no romper la notificación
        db.rollback()
        return {"ok": False, "error": str(exc)[:300]}
