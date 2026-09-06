"""Client bootstrap: plan determinism, idempotency, and preserving owner edits."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.template_version import template_version
from app.instance.bootstrap import (
    InstanceConflictError,
    apply_profile,
    build_plan,
)
from app.instance.manifest import build_manifest
from app.instance.profile import load_profile, parse_profile
from app.models import (
    Coupon,
    DeliveryArea,
    InstanceMetadata,
    Order,
    Product,
    StaticPage,
    StoreSettings,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
MASRI_PROFILE = REPO_ROOT / "instance" / "masri-electronics.yaml"

PROFILE = {
    "profile_schema_version": 1,
    "template_version": template_version(),
    "client_slug": "acme-store",
    "store": {
        "name": "Acme Supplies",
        "tagline": "Everything for the workshop",
        "currency_code": "EUR",
        "currency_symbol": "€",
    },
    "contact": {"phone": "0591234567", "email": "hello@example.com"},
    "theme": {"primary_color": "#112233"},
    "features": {"packages": True, "silicone_molds": False, "coupons": True},
    "static_pages": [
        {"slug": "about", "title": "About us", "lead": "Who we are.", "content": "Founded 2019.\n\nStill here."},
        {"slug": "terms", "title": "Terms", "lead": "The rules."},
    ],
    "delivery_areas": [
        {
            "name": "City",
            "delivery_fee": 20,
            "free_delivery_threshold": 200,
            "estimated_days": "2 days",
            "sort_order": 1,
        },
        {"name": "Outskirts", "delivery_fee": 35, "is_active": False, "sort_order": 2},
    ],
}


@pytest.fixture()
def profile():
    return parse_profile(PROFILE)


# ── plan ─────────────────────────────────────────────────────────────────────
def test_plan_is_deterministic(db: Session, profile) -> None:
    first = [action.render() for action in build_plan(db, profile).actions]
    second = [action.render() for action in build_plan(db, profile).actions]
    assert first == second
    assert first, "the plan for an empty database must not be empty"


def test_plan_writes_nothing(db: Session, profile) -> None:
    plan = build_plan(db, profile)
    db.rollback()

    assert all(action.outcome == "create" for action in plan.actions)
    assert db.execute(select(InstanceMetadata)).scalars().all() == []
    assert db.execute(select(StoreSettings)).scalars().all() == []
    assert db.execute(select(StaticPage)).scalars().all() == []
    assert db.execute(select(DeliveryArea)).scalars().all() == []


# ── first apply ──────────────────────────────────────────────────────────────
def test_first_apply_initializes_the_instance(db: Session, profile) -> None:
    apply_profile(db, profile)

    metadata = db.execute(select(InstanceMetadata)).scalar_one()
    assert metadata.instance_slug == "acme-store"
    assert metadata.profile_schema_version == 1
    assert metadata.profile_hash == profile.profile_hash()
    assert metadata.enabled_features == ["packages", "coupons"]

    settings_row = db.execute(select(StoreSettings)).scalar_one()
    assert settings_row.store_name == "Acme Supplies"
    assert settings_row.currency_code == "EUR"
    assert settings_row.primary_color == "#112233"
    assert settings_row.phone == "0591234567"

    pages = {row.slug for row in db.execute(select(StaticPage)).scalars()}
    assert pages == {"about", "terms"}


def test_first_apply_creates_the_delivery_table(db: Session, profile) -> None:
    apply_profile(db, profile)

    areas = db.execute(select(DeliveryArea).order_by(DeliveryArea.sort_order)).scalars().all()
    assert [area.name for area in areas] == ["City", "Outskirts"]

    city, outskirts = areas
    assert city.delivery_fee == Decimal("20")
    assert city.free_delivery_threshold == Decimal("200")
    assert city.estimated_days == "2 days"
    assert city.is_active is True
    # "no minimum" is the absence of a rule, never a zero that is always satisfied.
    assert city.min_order_amount is None
    assert outskirts.is_active is False
    assert outskirts.free_delivery_threshold is None


def test_first_apply_publishes_the_page_body_from_the_profile(db: Session, profile) -> None:
    apply_profile(db, profile)

    page = db.execute(select(StaticPage).where(StaticPage.slug == "about")).scalar_one()
    assert page.content == "Founded 2019.\n\nStill here."
    # A page the profile gives no body still exists, ready for Admin.
    terms = db.execute(select(StaticPage).where(StaticPage.slug == "terms")).scalar_one()
    assert terms.content == ""


def test_apply_fills_a_placeholder_page_left_over_from_an_earlier_bootstrap(
    db: Session, profile
) -> None:
    """The state every existing instance is in: pages created, bodies still blank."""
    db.add(StaticPage(slug="about", title="About us", lead="Who we are.", content=""))
    db.commit()

    apply_profile(db, profile)

    page = db.execute(select(StaticPage).where(StaticPage.slug == "about")).scalar_one()
    assert page.content == "Founded 2019.\n\nStill here."


def test_bootstrap_preserves_existing_return_policy(db: Session) -> None:
    profile = load_profile(MASRI_PROFILE)
    owner_content = "سياسة اعتمدها المالك"
    page = StaticPage(slug="return-policy", title="سياسة الاستبدال والاسترجاع", content=owner_content)
    db.add(page)
    db.commit()

    apply_profile(db, profile)

    assert page.content == owner_content


def test_bootstrap_creates_no_demo_products_orders_or_coupons(db: Session, profile) -> None:
    apply_profile(db, profile)

    assert db.execute(select(Product)).scalars().all() == []
    assert db.execute(select(Order)).scalars().all() == []
    assert db.execute(select(Coupon)).scalars().all() == []


def test_bootstrap_creates_no_admin_account(db: Session, profile) -> None:
    from app.models import AdminUser

    apply_profile(db, profile)
    assert db.execute(select(AdminUser)).scalars().all() == []


# ── idempotency and owner content ────────────────────────────────────────────
def test_repeated_apply_is_idempotent(db: Session, profile) -> None:
    apply_profile(db, profile)
    first = {
        "pages": sorted(r.slug for r in db.execute(select(StaticPage)).scalars()),
        "settings": db.execute(select(StoreSettings)).scalar_one().store_name,
        "metadata": db.execute(select(InstanceMetadata)).scalar_one().instance_slug,
    }

    plan = apply_profile(db, profile)

    second = {
        "pages": sorted(r.slug for r in db.execute(select(StaticPage)).scalars()),
        "settings": db.execute(select(StoreSettings)).scalar_one().store_name,
        "metadata": db.execute(select(InstanceMetadata)).scalar_one().instance_slug,
    }
    assert first == second
    assert db.execute(select(InstanceMetadata)).scalars().all().__len__() == 1
    # Nothing is created the second time round.
    assert not [a for a in plan.actions if a.outcome == "create"]


def test_repeated_apply_preserves_admin_edited_content(db: Session, profile) -> None:
    apply_profile(db, profile)

    # The owner edits through Admin.
    settings_row = db.execute(select(StoreSettings)).scalar_one()
    settings_row.store_name = "Acme — renamed by the owner"
    settings_row.primary_color = "#ABCDEF"
    settings_row.phone = "0599999999"

    page = db.execute(select(StaticPage).where(StaticPage.slug == "about")).scalar_one()
    page.title = "Our story"
    page.content = "Written by the owner."
    db.commit()

    apply_profile(db, profile)

    settings_row = db.execute(select(StoreSettings)).scalar_one()
    assert settings_row.store_name == "Acme — renamed by the owner"
    assert settings_row.primary_color == "#ABCDEF"
    assert settings_row.phone == "0599999999"

    page = db.execute(select(StaticPage).where(StaticPage.slug == "about")).scalar_one()
    assert page.title == "Our story"
    assert page.content == "Written by the owner."


def test_repeated_apply_preserves_owner_edited_delivery_areas(db: Session, profile) -> None:
    apply_profile(db, profile)

    area = db.execute(select(DeliveryArea).where(DeliveryArea.name == "City")).scalar_one()
    area.delivery_fee = Decimal("28")
    area.free_delivery_threshold = None
    db.commit()

    apply_profile(db, profile)

    area = db.execute(select(DeliveryArea).where(DeliveryArea.name == "City")).scalar_one()
    assert area.delivery_fee == Decimal("28")
    assert area.free_delivery_threshold is None
    assert len(db.execute(select(DeliveryArea)).scalars().all()) == 2


def test_apply_fills_a_field_the_owner_left_at_its_default(db: Session, profile) -> None:
    """The counterpart to the test above: untouched fields are still initialized."""
    apply_profile(db, profile)
    settings_row = db.execute(select(StoreSettings)).scalar_one()
    assert settings_row.store_tagline == "Everything for the workshop"


# ── conflict ─────────────────────────────────────────────────────────────────
def test_a_conflicting_instance_slug_is_refused(db: Session, profile) -> None:
    apply_profile(db, profile)

    other = parse_profile({**PROFILE, "client_slug": "different-store"})

    plan = build_plan(db, other)
    assert plan.has_conflict

    with pytest.raises(InstanceConflictError, match="acme-store"):
        apply_profile(db, other)

    # The original instance is untouched.
    assert db.execute(select(InstanceMetadata)).scalar_one().instance_slug == "acme-store"
    assert db.execute(select(StoreSettings)).scalar_one().store_name == "Acme Supplies"


# ── manifest ─────────────────────────────────────────────────────────────────
REQUIRED_MANIFEST_KEYS = {
    "instance_slug",
    "template_version",
    "profile_schema_version",
    "alembic_revision",
    "enabled_features",
    "initialized_at",
    "last_bootstrap_at",
    "initialized",
}


def test_manifest_contains_the_required_metadata(db: Session, profile) -> None:
    apply_profile(db, profile)
    manifest = build_manifest(db)

    assert REQUIRED_MANIFEST_KEYS <= set(manifest)
    assert manifest["instance_slug"] == "acme-store"
    assert manifest["profile_schema_version"] == 1
    assert manifest["enabled_features"] == ["packages", "coupons"]
    assert manifest["initialized"] is True
    assert manifest["template_version"]


def test_manifest_on_an_uninitialized_database_is_honest(db: Session) -> None:
    manifest = build_manifest(db)
    assert manifest["initialized"] is False
    assert manifest["instance_slug"] is None


def test_manifest_contains_no_secrets(db: Session, profile) -> None:
    import json

    from app.core.config import settings

    apply_profile(db, profile)
    document = json.dumps(build_manifest(db)).lower()

    for fragment in ("password", "secret", "token", "credential", "database_url", "dsn"):
        assert fragment not in document, f"manifest leaked {fragment!r}"

    # And no actual configured value leaks either.
    assert settings.SECRET_KEY.lower() not in document
    assert settings.DATABASE_URL.lower() not in document


def test_a_fresh_instance_uses_the_masri_profile_without_a_manual_edit(db: Session) -> None:
    """End to end over the real shipped profile, not the synthetic one above.

    This is the gap the branding pass left: the frontend tokens, the column
    defaults and the ThemeProfile defaults were all moved to Masri Electronics, but a fresh
    bootstrap reads `instance/masri-electronics.yaml`, which still stated the source
    project's teal outright — so the settings row it created came back from
    `/store/settings`, StoreProvider wrote it over the stylesheet's fallback, and
    the storefront rendered in the old brand. Nothing on the frontend could have
    corrected that, and only a hand-edit of the row hid it.
    """
    apply_profile(db, load_profile(MASRI_PROFILE))

    row = db.execute(select(StoreSettings)).scalar_one()
    assert (row.primary_color, row.secondary_color, row.accent_color) == (
        "#1B2F52",
        "#D9232E",
        "#D9232E",
    )
    assert "#1F4E4A" not in (row.primary_color, row.secondary_color, row.accent_color)


def test_the_shipped_profile_carries_the_clients_confirmed_store_data(db: Session) -> None:
    """The client data phase, checked against the file the instance is bootstrapped from."""
    apply_profile(db, load_profile(MASRI_PROFILE))

    row = db.execute(select(StoreSettings)).scalar_one()
    # The brand is latin and stays latin; only the copy around it is Arabic.
    assert row.store_name == "Masri Electronics"
    assert row.store_name_ar == "المصري للأدوات الكهربائية"
    assert row.currency_code == "ILS"
    assert row.currency_symbol == "₪"
    assert row.phone == "+970 597 344 680"
    assert row.whatsapp == "+970 597 449 106"
    # Nothing was invented for what the client has not supplied.
    assert row.email is None
    assert row.address == "نابلس، أول شارع القدس، فلسطين"
    assert row.working_hours == "مفتوح 24 ساعة / مفتوح دائماً"
    assert row.currency_code == "ILS"
    assert row.currency_symbol == "₪"
    assert row.logo_url == "/branding/logo1.png"
    assert row.favicon_url == "/branding/logo-without-name.png"
    assert (row.instagram_url, row.facebook_url, row.tiktok_url, row.youtube_url) == (
        None,
        "https://www.facebook.com/people/%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D9%8A-%D9%84%D9%84%D8%A7%D8%AF%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A6%D9%8A%D8%A9/61584581612056/",
        None,
        None,
    )

    areas = db.execute(select(DeliveryArea).order_by(DeliveryArea.sort_order)).scalars().all()
    assert [
        (a.name, a.delivery_fee, a.free_delivery_threshold, a.min_order_amount, a.is_active)
        for a in areas
    ] == []

    pages = {row.slug: row for row in db.execute(select(StaticPage)).scalars()}
    assert set(pages) == {
        "about",
        "privacy-policy",
        "return-policy",
        "terms",
        "shipping-policy",
        "contact",
    }
    for page in pages.values():
        assert page.content in (None, "")
        assert page.is_published is True
