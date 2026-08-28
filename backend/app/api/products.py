"""Catálogo de productos de venta (módulo "Productos").

El gimnasio vende productos retail (suplementos, ropa, accesorios, snacks,
equipo de entrenamiento, etc.). El admin registra el producto con nombre,
categoría, precio opcional y foto opcional, con existencia simple.
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentGym, get_current_gym, require_component, require_gym_roles
from app.core.events import record_audit
from app.core.storage import (
    ALLOWED_IMAGE_EXTENSIONS,
    public_url,
    save_media,
    validate_extension,
)
from app.db.session import get_db
from app.models import SaleProduct
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate

router = APIRouter(
    prefix="/products",
    tags=["products"],
    dependencies=[Depends(require_component("productos"))],
)

PRODUCT_MUTATORS = ("admin",)
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _get_product_or_404(db: Session, gym_id: str, product_id: str) -> SaleProduct:
    product = db.scalar(
        select(SaleProduct).where(
            SaleProduct.id == product_id,
            SaleProduct.gym_id == gym_id,
        )
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return product


@router.get("", response_model=list[ProductRead])
def list_products(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
    category: str | None = Query(default=None),
    active_only: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[SaleProduct]:
    stmt = select(SaleProduct).where(SaleProduct.gym_id == ctx.gym["id"])
    if category:
        stmt = stmt.where(SaleProduct.category == category)
    if active_only:
        stmt = stmt.where(SaleProduct.active.is_(True))
    stmt = stmt.order_by(SaleProduct.name).limit(limit)
    return list(db.scalars(stmt))


@router.get("/categories", response_model=list[str])
def list_categories(
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> list[str]:
    rows = db.execute(
        select(SaleProduct.category)
        .where(SaleProduct.gym_id == ctx.gym["id"])
        .distinct()
        .order_by(SaleProduct.category)
    ).scalars()
    return list(rows)


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: str,
    ctx: CurrentGym = Depends(get_current_gym),
    db: Session = Depends(get_db),
) -> SaleProduct:
    return _get_product_or_404(db, str(ctx.gym["id"]), product_id)


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    ctx: CurrentGym = Depends(require_gym_roles(*PRODUCT_MUTATORS)),
    db: Session = Depends(get_db),
) -> SaleProduct:
    product = SaleProduct(
        gym_id=ctx.gym["id"],
        name=body.name,
        category=body.category,
        price=body.price,
        stock_quantity=body.stock_quantity,
        active=body.active,
    )
    db.add(product)
    db.flush()
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="product_created",
        entity_type="product",
        entity_id=product.id,
    )
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: str,
    body: ProductUpdate,
    ctx: CurrentGym = Depends(require_gym_roles(*PRODUCT_MUTATORS)),
    db: Session = Depends(get_db),
) -> SaleProduct:
    product = _get_product_or_404(db, str(ctx.gym["id"]), product_id)
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(product, field, value)
    db.flush()
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="product_updated",
        entity_type="product",
        entity_id=product.id,
        metadata={"fields": list(data.keys())},
    )
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    ctx: CurrentGym = Depends(require_gym_roles(*PRODUCT_MUTATORS)),
    db: Session = Depends(get_db),
) -> None:
    product = _get_product_or_404(db, str(ctx.gym["id"]), product_id)
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="product_deleted",
        entity_type="product",
        entity_id=product.id,
    )
    db.delete(product)
    db.commit()


@router.post(
    "/{product_id}/photo",
    response_model=ProductRead,
    summary="Sube la foto del producto (opcional)",
)
def upload_product_photo(
    product_id: str,
    file: UploadFile = File(...),
    ctx: CurrentGym = Depends(require_gym_roles(*PRODUCT_MUTATORS)),
    db: Session = Depends(get_db),
) -> SaleProduct:
    product = _get_product_or_404(db, str(ctx.gym["id"]), product_id)

    validate_extension(file.filename or "", ALLOWED_IMAGE_EXTENSIONS)
    content = file.file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen supera el límite de 5 MB",
        )

    rel = save_media(f"products/{product_id}", file.filename or "photo.jpg", content)
    product.photo_url = public_url(rel)
    record_audit(
        db,
        gym_id=ctx.gym["id"],
        actor_type="user",
        actor_id=ctx.user.sub,
        action="product_photo_updated",
        entity_type="product",
        entity_id=product.id,
    )
    db.commit()
    db.refresh(product)
    return product
