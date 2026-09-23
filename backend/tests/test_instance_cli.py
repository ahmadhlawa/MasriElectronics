"""The instance CLI surface, the demo seed separation, and the offline MySQL check."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.template_version import template_version
from app.models import Coupon, InstanceMetadata, Order, Product, StoreSettings
from scripts import instance_cli, mysql_compat

REPO_ROOT = Path(__file__).resolve().parents[2]
# The fork ships Masri Electronics's profile where the template shipped a demo one.
MASRI_PROFILE = REPO_ROOT / "instance" / "masri-electronics.yaml"


def test_masri_review_profile_has_demo_business_content() -> None:
    from app.instance.profile import load_profile

    profile = load_profile(MASRI_PROFILE)
    assert profile.demo_business_content is True
    assert [(area.name, area.delivery_fee) for area in profile.delivery_areas] == [
        ("نابلس", 15), ("رام الله والبيرة", 25), ("طولكرم", 20),
    ]
    assert all(page.content for page in profile.static_pages)


def test_production_rejects_demo_business_content(monkeypatch) -> None:
    from app.core.config import settings
    from app.main import create_app

    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "STORAGE_PROVIDER", "r2")
    with pytest.raises(RuntimeError, match="demo business content"):
        create_app()


def test_public_api_marks_demo_content_and_hides_molds(client: TestClient, db: Session) -> None:
    from app.instance.bootstrap import apply_profile
    from app.instance.profile import load_profile

    apply_profile(db, load_profile(MASRI_PROFILE))
    settings_response = client.get("/api/v1/store/settings")
    assert settings_response.status_code == 200
    assert settings_response.json()["demo_business_content"] is True
    assert client.get("/api/v1/products/molds").status_code == 404
    assert [(area["name"], area["delivery_fee"]) for area in client.get("/api/v1/delivery-areas").json()] == [
        ("نابلس", 15), ("رام الله والبيرة", 25), ("طولكرم", 20),
    ]


@pytest.fixture()
def cli_env(session_factory: sessionmaker, monkeypatch):
    """Point the CLI's session helper at the per-test database."""
    monkeypatch.setattr(instance_cli, "_session", lambda: session_factory())
    return session_factory


@pytest.fixture()
def profile_path(tmp_path: Path) -> Path:
    document = {
        "profile_schema_version": 1,
        "template_version": template_version(),
        "client_slug": "cli-store",
        "store": {"name": "CLI Store"},
        "static_pages": [{"slug": "about", "title": "About"}],
    }
    path = tmp_path / "profile.yaml"
    path.write_text(yaml.safe_dump(document, allow_unicode=True), encoding="utf-8")
    return path


# ── validate ─────────────────────────────────────────────────────────────────
def test_validate_accepts_a_good_profile(profile_path: Path, capsys) -> None:
    assert instance_cli.main(["validate", "--profile", str(profile_path)]) == 0
    assert "cli-store" in capsys.readouterr().out


def test_validate_rejects_a_bad_profile(tmp_path: Path, capsys) -> None:
    bad = tmp_path / "bad.yaml"
    bad.write_text("profile_schema_version: 1\nclient_slug: 'BAD SLUG'\n", encoding="utf-8")

    assert instance_cli.main(["validate", "--profile", str(bad)]) == instance_cli.EXIT_INVALID
    assert "Invalid profile" in capsys.readouterr().err


def test_validate_needs_no_database(profile_path: Path, monkeypatch) -> None:
    """A profile check must work before DATABASE_URL points anywhere useful."""

    def explode():
        raise AssertionError("validate must not open a database session")

    monkeypatch.setattr(instance_cli, "_session", explode)
    assert instance_cli.main(["validate", "--profile", str(profile_path)]) == 0


# ── plan / apply / manifest ──────────────────────────────────────────────────
def test_plan_reports_actions_and_writes_nothing(cli_env, profile_path: Path, capsys) -> None:
    assert instance_cli.main(["plan", "--profile", str(profile_path)]) == 0
    out = capsys.readouterr().out
    assert "create" in out and "instance_metadata" in out

    with cli_env() as db:
        assert db.execute(select(InstanceMetadata)).scalars().all() == []


def test_apply_then_manifest(cli_env, profile_path: Path, capsys) -> None:
    assert instance_cli.main(["apply", "--profile", str(profile_path)]) == 0
    capsys.readouterr()

    assert instance_cli.main(["manifest"]) == 0
    manifest = json.loads(capsys.readouterr().out)
    assert manifest["instance_slug"] == "cli-store"
    assert manifest["initialized"] is True
    assert manifest["template_version"]


def test_manifest_can_be_written_to_a_file(cli_env, profile_path: Path, tmp_path: Path) -> None:
    instance_cli.main(["apply", "--profile", str(profile_path)])
    target = tmp_path / "manifest.json"

    assert instance_cli.main(["manifest", "--output", str(target)]) == 0
    manifest = json.loads(target.read_text(encoding="utf-8"))
    assert manifest["instance_slug"] == "cli-store"


def test_apply_refuses_a_conflicting_slug(cli_env, profile_path: Path, tmp_path: Path, capsys) -> None:
    instance_cli.main(["apply", "--profile", str(profile_path)])
    capsys.readouterr()

    document = yaml.safe_load(profile_path.read_text(encoding="utf-8"))
    document["client_slug"] = "someone-else"
    other = tmp_path / "other.yaml"
    other.write_text(yaml.safe_dump(document, allow_unicode=True), encoding="utf-8")

    code = instance_cli.main(["apply", "--profile", str(other)])
    assert code == instance_cli.EXIT_CONFLICT
    assert "Conflict" in capsys.readouterr().err

    with cli_env() as db:
        assert db.execute(select(InstanceMetadata)).scalar_one().instance_slug == "cli-store"


def test_plan_reports_a_conflict_without_writing(cli_env, profile_path: Path, tmp_path: Path) -> None:
    instance_cli.main(["apply", "--profile", str(profile_path)])

    document = yaml.safe_load(profile_path.read_text(encoding="utf-8"))
    document["client_slug"] = "someone-else"
    other = tmp_path / "other.yaml"
    other.write_text(yaml.safe_dump(document, allow_unicode=True), encoding="utf-8")

    assert instance_cli.main(["plan", "--profile", str(other)]) == instance_cli.EXIT_CONFLICT


def test_the_shipped_masri_profile_applies(cli_env, capsys) -> None:
    assert instance_cli.main(["apply", "--profile", str(MASRI_PROFILE)]) == 0
    capsys.readouterr()

    with cli_env() as db:
        assert db.execute(select(InstanceMetadata)).scalar_one().instance_slug == "masri-electronics"
        # Through the CLI, which is how an instance is actually stood up: the
        # branding a fresh Masri Electronics store comes online with is whatever this writes.
        settings_row = db.execute(select(StoreSettings)).scalar_one()
        assert settings_row.primary_color == "#1B2F52"
        assert settings_row.secondary_color == "#D9232E"
        assert settings_row.accent_color == "#D9232E"
        # Identity only — the catalogue is the separate demo seed.
        assert db.execute(select(Product)).scalars().all() == []
        assert db.execute(select(Order)).scalars().all() == []
        assert db.execute(select(Coupon)).scalars().all() == []


# ── offline MySQL compatibility ──────────────────────────────────────────────
def test_offline_mysql_compatibility_check_passes(capsys) -> None:
    assert mysql_compat.main([]) == 0
    out = capsys.readouterr().out
    assert "no server was contacted" in out
    assert "0 failure(s)" in out


def test_mysql_check_covers_the_documented_areas() -> None:
    checks = {finding.check for finding in mysql_compat.run_checks()}
    assert {
        "table-compilation",
        "money-columns",
        "json-columns",
        "index-key-length",
        "foreign-keys",
        "unique-constraints",
        "enum-like",
        "alembic",
    } <= checks


def test_mysql_check_finds_no_failures() -> None:
    failures = [f for f in mysql_compat.run_checks() if f.level == "fail"]
    assert not failures, [f"{f.check}: {f.message}" for f in failures]
