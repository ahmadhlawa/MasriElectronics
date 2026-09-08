from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Category, ProductVariant
from tests.conftest import auth, make_product


def test_public_stock_uses_active_variants_when_product_has_options(
    client: TestClient, db: Session, admin_token: str
) -> None:
    product = make_product(db, slug="variant-stock", stock=9)
    options = client.put(
        f"/api/v1/admin/products/{product.id}/options",
        headers=auth(admin_token),
        json=[{"name": "اللون", "values": [{"value": "أسود"}, {"value": "أبيض"}]}],
    ).json()
    value_ids = [row["id"] for row in options[0]["values"]]
    for index, (stock, active) in enumerate(((0, True), (3, False))):
        response = client.post(
            f"/api/v1/admin/products/{product.id}/variants",
            headers=auth(admin_token),
            json={"title": str(index), "stock_quantity": stock, "is_active": active,
                  "option_value_ids": [value_ids[index]]},
        )
        assert response.status_code == 201, response.text

    assert client.get(f"/api/v1/products/{product.slug}").json()["in_stock"] is False
    slugs = {row["slug"] for row in client.get("/api/v1/products", params={"in_stock": True}).json()["items"]}
    assert product.slug not in slugs

    variant = db.query(ProductVariant).filter_by(product_id=product.id, is_active=True).one()
    variant.stock_quantity = 1
    db.commit()
    assert client.get(f"/api/v1/products/{product.slug}").json()["in_stock"] is True
    slugs = {row["slug"] for row in client.get("/api/v1/products", params={"in_stock": True}).json()["items"]}
    assert product.slug in slugs


def test_product_category_and_sku_validation(
    client: TestClient, db: Session, admin_token: str
) -> None:
    category = Category(name="أجهزة", slug="validation-category")
    db.add(category)
    db.commit()
    payload = {"name": "أول", "price": 10, "category_id": category.id, "sku": "TAKEN-P"}
    assert client.post("/api/v1/admin/products", headers=auth(admin_token), json=payload).status_code == 201
    duplicate = client.post("/api/v1/admin/products", headers=auth(admin_token), json={**payload, "name": "ثان"})
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "product_sku_taken"
    missing = client.post("/api/v1/admin/products", headers=auth(admin_token), json={**payload, "sku": "NEW", "category_id": 999999})
    assert missing.status_code == 404
    product_id = client.get("/api/v1/admin/products", headers=auth(admin_token)).json()["items"][0]["id"]
    missing_update = client.patch(
        f"/api/v1/admin/products/{product_id}", headers=auth(admin_token),
        json={"category_id": 999999},
    )
    assert missing_update.status_code == 404


def test_variant_validation_and_combination_integrity(
    client: TestClient, db: Session, admin_token: str
) -> None:
    product = make_product(db, slug="variant-rules")
    options = client.put(
        f"/api/v1/admin/products/{product.id}/options", headers=auth(admin_token),
        json=[{"name": "اللون", "values": [{"value": "أسود"}]},
              {"name": "الحجم", "values": [{"value": "كبير"}]}],
    ).json()
    ids = [option["values"][0]["id"] for option in options]
    url = f"/api/v1/admin/products/{product.id}/variants"
    incomplete = client.post(url, headers=auth(admin_token), json={"title": "ناقص", "option_value_ids": ids[:1]})
    assert incomplete.status_code == 400
    assert incomplete.json()["error"]["code"] == "variant_option_values_incomplete"
    negative = client.post(url, headers=auth(admin_token), json={"title": "سالب", "price_override": -1, "option_value_ids": ids})
    assert negative.status_code == 422
    created = client.post(url, headers=auth(admin_token), json={"title": "كامل", "sku": "TAKEN-V", "option_value_ids": ids})
    assert created.status_code == 201, created.text
    duplicate = client.post(url, headers=auth(admin_token), json={"title": "مكرر", "option_value_ids": list(reversed(ids))})
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "variant_combination_taken"
    sku = client.patch(f"{url}/{created.json()['id']}", headers=auth(admin_token), json={"title": "كامل", "sku": "TAKEN-V", "option_value_ids": ids})
    assert sku.status_code == 200


def test_free_form_variant_without_options_is_preserved(
    client: TestClient, db: Session, admin_token: str
) -> None:
    product = make_product(db, slug="free-form")
    response = client.post(
        f"/api/v1/admin/products/{product.id}/variants", headers=auth(admin_token),
        json={"title": "نسخة حرة", "stock_quantity": 2},
    )
    assert response.status_code == 201, response.text
    second = make_product(db, slug="free-form-second")
    duplicate_sku = client.post(
        f"/api/v1/admin/products/{second.id}/variants", headers=auth(admin_token),
        json={"title": "نسخة أخرى", "sku": response.json().get("sku") or "UNUSED"},
    )
    assert duplicate_sku.status_code == 201
    taken = client.patch(
        f"/api/v1/admin/products/{product.id}/variants/{response.json()['id']}",
        headers=auth(admin_token),
        json={"title": "نسخة حرة", "sku": duplicate_sku.json()["sku"]},
    )
    assert taken.status_code == 409
    assert taken.json()["error"]["code"] == "variant_sku_taken"
