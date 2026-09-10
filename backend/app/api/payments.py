"""Pagos y cobranza — por-tenant.

Registro de pagos (cash/card/transfer), listado con filtros y recibo PDF.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component
from app.core.events import record_audit
from app.db.session import get_db
from app.models import Member, Payment
from app.schemas.payment import PaymentCreate, PaymentRead

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
    method: str | None = Query(default=None, pattern="^(cash|card|transfer)$"),
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
