"""Admin management of store identity and editorial content."""

from __future__ import annotations

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.crud import apply_updates, get_or_404
from app.api.deps import CurrentAdmin, DbSession
from app.models import HeroSlide
from app.schemas.common import MessageResponse
from app.schemas.content import HeroSlideAdminOut, HeroSlideCreate, HeroSlideUpdate
from app.schemas.store import StoreSettingsAdmin, StoreSettingsUpdate
from app.services import audit as audit_service
from app.services import store_settings as settings_service

router = APIRouter(prefix="/admin", tags=["admin-content"])


@router.get("/settings", response_model=StoreSettingsAdmin)
def get_settings(db: DbSession, admin: CurrentAdmin):
    row = settings_service.get_or_create_settings(db)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/settings", response_model=StoreSettingsAdmin)
def update_settings(payload: StoreSettingsUpdate, db: DbSession, admin: CurrentAdmin):
    row = settings_service.get_or_create_settings(db)
    changed = apply_updates(row, payload)
    audit_service.record(db, admin=admin, action="settings.updated", entity_type="store_settings", entity_id=row.id, meta={"fields": changed})
    db.commit()
    db.refresh(row)
    return row


@router.get("/hero-slides", response_model=list[HeroSlideAdminOut])
def list_hero_slides(db: DbSession, admin: CurrentAdmin):
    return list(db.execute(select(HeroSlide).order_by(HeroSlide.sort_order.asc(), HeroSlide.id.asc())).scalars().all())


@router.post("/hero-slides", response_model=HeroSlideAdminOut, status_code=status.HTTP_201_CREATED)
def create_hero_slide(payload: HeroSlideCreate, db: DbSession, admin: CurrentAdmin):
    slide = HeroSlide(**payload.model_dump())
    db.add(slide)
    db.flush()
    audit_service.record(db, admin=admin, action="hero_slide.created", entity_type="hero_slide", entity_id=slide.id, meta={"title": slide.title})
    db.commit()
    db.refresh(slide)
    return slide


@router.patch("/hero-slides/{slide_id}", response_model=HeroSlideAdminOut)
def update_hero_slide(slide_id: int, payload: HeroSlideUpdate, db: DbSession, admin: CurrentAdmin):
    slide = get_or_404(db, HeroSlide, slide_id, "الشريحة غير موجودة.")
    changed = apply_updates(slide, payload)
    audit_service.record(db, admin=admin, action="hero_slide.updated", entity_type="hero_slide", entity_id=slide.id, meta={"fields": changed})
    db.commit()
    db.refresh(slide)
    return slide


@router.delete("/hero-slides/{slide_id}", response_model=MessageResponse)
def delete_hero_slide(slide_id: int, db: DbSession, admin: CurrentAdmin):
    slide = get_or_404(db, HeroSlide, slide_id, "الشريحة غير موجودة.")
    audit_service.record(db, admin=admin, action="hero_slide.deleted", entity_type="hero_slide", entity_id=slide.id, meta={"title": slide.title})
    db.delete(slide)
    db.commit()
    return MessageResponse(message="تم حذف الشريحة.")
