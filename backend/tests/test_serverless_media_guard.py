from __future__ import annotations

import pytest


def test_vercel_refuses_ephemeral_local_media(monkeypatch) -> None:
    import app.main as main_module

    monkeypatch.setattr(main_module.settings, "VERCEL", True)
    monkeypatch.setattr(main_module.settings, "STORAGE_PROVIDER", "local")

    with pytest.raises(RuntimeError, match="STORAGE_PROVIDER=r2"):
        main_module.create_app()


def test_production_refuses_ephemeral_local_media(monkeypatch) -> None:
    import app.main as main_module

    monkeypatch.setattr(main_module.settings, "VERCEL", False)
    monkeypatch.setattr(main_module.settings, "APP_ENV", "production")
    monkeypatch.setattr(main_module.settings, "STORAGE_PROVIDER", "local")

    with pytest.raises(RuntimeError, match="STORAGE_PROVIDER=r2"):
        main_module.create_app()
