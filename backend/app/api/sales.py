"""Ventas de mostrador (módulo "Ventas").

Registra la venta de productos del catálogo, descuenta el stock real de
`sale_products` y alimenta las estadísticas de ingresos del módulo.
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, selectinload

from app.api.deps import CurrentGym, get_current_gym, require_component, require_gym_roles
from app.core.events import record_audit
from app.db.session import get_db
from app.models import Sale, SaleItem, SaleProduct
from app.schemas.sale import SaleCreate, SaleRead, SaleResult

router = APIRouter(
    prefix="/sales",
    tags=["sales"],
    dependencies=[Depends(require_component("ventas"))],
)

SALE_MUTATORS = ("admin", "recepcion")


@router.get("", response_model=list[SaleRead], summary="Historial de ventas")
def list_sales(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Sale]:
    stmt = (
        select(Sale)
        .where(Sale.gym_id == ctx.gym["id"])
        .options(selectinload(Sale.items))
        .order_by(Sale.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


@router.get("/stats", summary="Estadísticas de ventas e ingresos")
def sales_stats(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365),
) -> dict:
    gid = ctx.gym["id"]
    since = text(f"now() - interval '{days} days'")

    # Totales del periodo
    totals = db.execute(
        text(
            "SELECT COUNT(*) AS total, COALESCE(SUM(total), 0) AS ingresos, "
            "COALESCE(AVG(total), 0) AS ticket_promedio "
            "FROM sales WHERE gym_id = :gid AND created_at >= " + str(since)
        ),
        {"gid": gid},
    ).mappings().first()

    # Serie de ingresos por día
    daily = db.execute(
        text(
            "SELECT date_trunc('day', created_at)::date AS fecha, "
            "COUNT(*) AS ventas, COALESCE(SUM(total), 0) AS ingresos "
            "FROM sales WHERE gym_id = :gid AND created_at >= " + str(since)
            + " GROUP BY fecha ORDER BY fecha"
        ),
        {"gid": gid},
    ).mappings().all()

    # Top productos vendidos
    top = db.execute(
        text(
            "SELECT si.name, SUM(si.quantity) AS unidades, SUM(si.line_total) AS ingresos "
            "FROM sale_items si JOIN sales s ON s.id = si.sale_id "
            "WHERE s.gym_id = :gid AND s.created_at >= " + str(since)
            + " GROUP BY si.name ORDER BY ingresos DESC LIMIT 10"
        ),
        {"gid": gid},
    ).mappings().all()

    # Por método de pago
    methods = db.execute(
        text(
            "SELECT COALESCE(NULLIF(payment_method, ''), 'otro') AS metodo, "
            "COUNT(*) AS ventas, COALESCE(SUM(total), 0) AS ingresos "
            "FROM sales WHERE gym_id = :gid AND created_at >= " + str(since)
            + " GROUP BY metodo ORDER BY ingresos DESC"
        ),
        {"gid": gid},
    ).mappings().all()

    return {
        "periodo_dias": days,
        "totales": {
            "ventas": totals["total"] if totals else 0,
            "ingresos": float(totals["ingresos"]) if totals else 0.0,
            "ticket_promedio": float(totals["ticket_promedio"]) if totals else 0.0,
        },
        "serie_diaria": [
            {"fecha": r["fecha"].isoformat(), "ventas": r["ventas"], "ingresos": float(r["ingresos"])}
            for r in daily
        ],
        "top_productos": [
            {"name": r["name"], "unidades": r["unidades"], "ingresos": float(r["ingresos"])}
            for r in top
        ],
        "por_metodo": [
            {"metodo": r["metodo"], "ventas": r["ventas"], "ingresos": float(r["ingresos"])}
            for r in methods
        ],
    }


@router.post("", response_model=SaleResult, status_code=status.HTTP_201_CREATED)
def create_sale(
    body: SaleCreate,
    ctx: CurrentGym = Depends(require_gym_roles(*SALE_MUTATORS)),
    db: Session = Depends(get_db),
) -> SaleResult:
    gym_id = ctx.gym["id"]

    if body.branch_id:
        branch_exists = db.scalar(
            text("SELECT 1 FROM gym_branches WHERE id = :bid AND gym_id = :gid"),
            {"bid": body.branch_id, "gid": gym_id},
        )
        if not branch_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada"
            )

    if body.payment_method not in (None, "cash", "card", "transfer", "mercadopago"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Método de pago inválido"
        )

    total = Decimal("0")
    items: list[SaleItem] = []
    for p in body.items:
        product = db.scalar(
            select(SaleProduct).where(
                SaleProduct.id == p.product_id, SaleProduct.gym_id == gym_id
            )
        )
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado"
            )
        if not product.active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El producto «{product.name}» está inactivo",
            )
        if product.price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El producto «{product.name}» no tiene precio",
            )
        if p.quantity > product.stock_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente para «{product.name}» "
                f"(disponible: {product.stock_quantity})",
            )
        product.stock_quantity -= p.quantity
        line = Decimal(str(p.quantity)) * Decimal(str(product.price))
        total += line
        items.append(
            SaleItem(
                product_id=product.id,
                name=product.name,
                quantity=p.quantity,
                unit_price=product.price,
                line_total=line,
            )
        )

    sale = Sale(
        gym_id=gym_id,
        branch_id=body.branch_id,
        total=total.quantize(Decimal("0.01")),
        status="paid",
        payment_method=body.payment_method,
        notes=body.notes,
        created_by=ctx.user.sub,
        items=items,
    )
    db.add(sale)
    db.flush()
    record_audit(
        db,
        gym_id=gym_id,
        actor_type="user",
        actor_id=ctx.user.sub,
        action="sale_created",
        entity_type="sale",
        entity_id=sale.id,
        metadata={"total": float(sale.total), "items": len(items)},
    )
    db.commit()
    return SaleResult(id=sale.id, total=float(sale.total), item_count=len(items))