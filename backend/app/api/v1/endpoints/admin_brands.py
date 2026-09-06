"""Admin brand management."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select

from app.api.crud import get_or_404
from app.api.deps import CurrentAdmin, DbSession, PageParams
from app.models import Brand, Product
from app.schemas.catalog import BrandAdminOut, BrandCreate, BrandUpdate
from app.schemas.common import MessageResponse, Page
from app.services import audit as audit_service
from app.services.catalog import paginate
from app.services.errors import ConflictError

router = APIRouter(prefix="/admin", tags=["admin-brands"])


def _ensure_name_available(db: DbSession, name: str, *, exclude_id: int | None = None) -> str:
    normalized = name.strip()
    stmt = select(Brand.id).where(func.lower(Brand.name) == normalized.lower())
    if exclude_id is not None:
        stmt = stmt.where(Brand.id != exclude_id)
    if db.execute(stmt).first():
        raise ConflictError("اسم العلامة التجارية مستخدم مسبقاً.", code="brand_name_taken")
    return normalized


@router.get("/brands", response_model=Page[BrandAdminOut])
def list_brands(
    db: DbSession,
    admin: CurrentAdmin,
    pagination: PageParams,
    q: Annotated[str | None, Query(max_length=120)] = None,
) -> Page[BrandAdminOut]:
    stmt = select(Brand).order_by(Brand.name.asc(), Brand.id.asc())
    if q:
        stmt = stmt.where(Brand.name.like(f"%{q}%"))
    rows, total = paginate(db, stmt, offset=pagination.offset, limit=pagination.page_size)
    return Page.build(rows, total, pagination.page, pagination.page_size)


@router.post("/brands", response_model=BrandAdminOut, status_code=status.HTTP_201_CREATED)
def create_brand(payload: BrandCreate, db: DbSession, admin: CurrentAdmin) -> Brand:
    brand = Brand(name=_ensure_name_available(db, payload.name), logo_url=payload.logo_url)
    db.add(brand)
    db.flush()
    audit_service.record(
        db, admin=admin, action="brand.created", entity_type="brand", entity_id=brand.id,
        meta={"name": brand.name},
    )
    db.commit()
    db.refresh(brand)
    return brand


@router.patch("/brands/{brand_id}", response_model=BrandAdminOut)
def update_brand(brand_id: int, payload: BrandUpdate, db: DbSession, admin: CurrentAdmin) -> Brand:
    brand = get_or_404(db, Brand, brand_id, "العلامة التجارية غير موجودة.")
    changed: list[str] = []
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "name" and value is not None:
            value = _ensure_name_available(db, value, exclude_id=brand.id)
        if getattr(brand, field) != value:
            setattr(brand, field, value)
            changed.append(field)
    audit_service.record(
        db, admin=admin, action="brand.updated", entity_type="brand", entity_id=brand.id,
        meta={"fields": changed},
    )
    db.commit()
    db.refresh(brand)
    return brand


@router.delete("/brands/{brand_id}", response_model=MessageResponse)
def delete_brand(brand_id: int, db: DbSession, admin: CurrentAdmin) -> MessageResponse:
    brand = get_or_404(db, Brand, brand_id, "العلامة التجارية غير موجودة.")
    if db.execute(select(Product.id).where(Product.brand_id == brand.id).limit(1)).first():
        raise ConflictError(
            "لا يمكن حذف علامة مرتبطة بمنتجات. انقل المنتجات أو أزل العلامة منها أولاً.",
            code="brand_has_products",
        )
    audit_service.record(
        db, admin=admin, action="brand.deleted", entity_type="brand", entity_id=brand.id,
        meta={"name": brand.name},
    )
    db.delete(brand)
    db.commit()
    return MessageResponse(message="تم حذف العلامة التجارية.")
