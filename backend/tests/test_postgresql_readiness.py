"""Focused unit coverage for PostgreSQL-specific deployment behaviour."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.pool import NullPool


@pytest.fixture()
def migration():
    return ScriptDirectory.from_config(Config("alembic.ini")).get_revision(
        "0008_order_activity_triggers"
    ).module


def test_order_activity_revision_installs_postgresql_immutability_triggers(migration, monkeypatch) -> None:
    statements: list[str] = []
    bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
    monkeypatch.setattr(migration, "op", SimpleNamespace(get_bind=lambda: bind, execute=statements.append))

    migration.upgrade()

    assert any("CREATE FUNCTION prevent_order_activity_mutation" in sql for sql in statements)
    assert any("trg_order_activities_no_update" in sql and "UPDATE" in sql for sql in statements)
    assert any("trg_order_activities_no_delete" in sql and "DELETE" in sql for sql in statements)


def test_order_activity_revision_removes_postgresql_function_after_triggers(migration, monkeypatch) -> None:
    statements: list[str] = []
    bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
    monkeypatch.setattr(migration, "op", SimpleNamespace(get_bind=lambda: bind, execute=statements.append))
    monkeypatch.setattr(migration, "_blocks_legacy_downgrade", lambda: False)

    migration.downgrade()

    assert statements[-1] == "DROP FUNCTION IF EXISTS prevent_order_activity_mutation()"


def test_serverless_postgresql_engine_uses_null_pool(monkeypatch) -> None:
    import app.db.session as session_module

    captured: dict[str, object] = {}
    monkeypatch.setattr(session_module.settings, "DATABASE_USE_NULL_POOL", True)
    monkeypatch.setattr(
        session_module,
        "create_engine",
        lambda url, **kwargs: captured.update(url=url, **kwargs),
    )

    session_module.build_engine("postgresql+psycopg://example")

    assert captured["poolclass"] is NullPool
    assert captured["pool_pre_ping"] is True
