from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import APIModel, UTCDateTime

HeroTargetType = Literal["none", "products", "offers", "packages", "categories", "category"]


class HeroSlideBase(APIModel):
    title: str = Field(default="", max_length=250)
    subtitle: str | None = Field(default=None, max_length=250)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    button_label: str | None = Field(default=None, max_length=100)
    button_url: str | None = Field(default=None, max_length=500)
    target_type: HeroTargetType | None = None
    target_slug: str | None = Field(default=None, max_length=160)
    is_active: bool = True
    sort_order: int = 0
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @model_validator(mode="after")
    def _window_is_ordered(self):
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self._normalize_target()

    def _normalize_target(self):
        if self.target_type == "category" and not (self.target_slug or "").strip():
            raise ValueError("target_slug is required for category targets")
        if self.target_type is None and self.target_slug is not None:
            raise ValueError("target_slug requires target_type=category")
        if self.target_type is not None:
            self.button_url = None
            self.target_slug = self.target_slug.strip() if self.target_type == "category" else None
        return self


class HeroSlideCreate(HeroSlideBase):
    image_url: str = Field(min_length=1, max_length=500)


class HeroSlideUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    subtitle: str | None = Field(default=None, max_length=250)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    button_label: str | None = Field(default=None, max_length=100)
    button_url: str | None = Field(default=None, max_length=500)
    target_type: HeroTargetType | None = None
    target_slug: str | None = Field(default=None, max_length=160)
    is_active: bool | None = None
    sort_order: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @model_validator(mode="after")
    def _normalize_target(self):
        fields = self.model_fields_set
        if "target_slug" in fields and "target_type" not in fields:
            raise ValueError("target_slug requires target_type")
        if "target_type" not in fields:
            return self
        if self.target_type == "category" and not (self.target_slug or "").strip():
            raise ValueError("target_slug is required for category targets")
        if self.target_type is not None:
            self.button_url = None
            self.target_slug = self.target_slug.strip() if self.target_type == "category" else None
        return self


class HeroSlideOut(APIModel):
    id: int
    title: str
    subtitle: str | None = None
    description: str | None = None
    image_url: str | None = None
    button_label: str | None = None
    button_url: str | None = None
    target_type: HeroTargetType | None = None
    target_slug: str | None = None
    sort_order: int


class HeroSlideAdminOut(HeroSlideOut):
    is_active: bool
    starts_at: UTCDateTime | None = None
    ends_at: UTCDateTime | None = None
    updated_at: UTCDateTime


class StaticPageOut(APIModel):
    id: int
    title: str
    slug: str
    lead: str | None = None
    content: str
    seo_title: str | None = None
    seo_description: str | None = None
