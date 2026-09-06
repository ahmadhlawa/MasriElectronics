from __future__ import annotations

from datetime import datetime

from pydantic import Field, model_validator

from app.schemas.common import APIModel, UTCDateTime


class HeroSlideBase(APIModel):
    title: str = Field(default="", max_length=250)
    subtitle: str | None = Field(default=None, max_length=250)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    button_label: str | None = Field(default=None, max_length=100)
    button_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True
    sort_order: int = 0
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @model_validator(mode="after")
    def _window_is_ordered(self):
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
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
    is_active: bool | None = None
    sort_order: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class HeroSlideOut(APIModel):
    id: int
    title: str
    subtitle: str | None = None
    description: str | None = None
    image_url: str | None = None
    button_label: str | None = None
    button_url: str | None = None
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
