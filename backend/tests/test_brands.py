from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import auth, category


def test_brand_crud_product_link_and_public_projection(
    client: TestClient, admin_token: str, category
) -> None:
    headers = auth(admin_token)
    created = client.post(
        "/api/v1/admin/brands",
        headers=headers,
        json={"name": "Philips", "logo_url": "/media/philips.png"},
    )
    assert created.status_code == 201, created.text
    brand = created.json()
    assert brand["name"] == "Philips"

    duplicate = client.post("/api/v1/admin/brands", headers=headers, json={"name": "PHILIPS"})
    assert duplicate.status_code == 409
    assert "brand_name_taken" in duplicate.text

    edited = client.patch(
        f"/api/v1/admin/brands/{brand['id']}",
        headers=headers,
        json={"name": "Philips Arabia", "logo_url": "/media/philips-ar.png"},
    )
    assert edited.status_code == 200
    assert edited.json()["logo_url"] == "/media/philips-ar.png"

    product = client.post(
        "/api/v1/admin/products",
        headers=headers,
        json={"name": "غلاية", "price": 100, "category_id": category.id, "brand_id": brand["id"]},
    )
    assert product.status_code == 201, product.text
    assert product.json()["brand_id"] == brand["id"]
    assert product.json()["brand_name"] == "Philips Arabia"

    public_product = client.get(f"/api/v1/products/{product.json()['slug']}")
    assert public_product.status_code == 200
    assert public_product.json()["brand_logo_url"] == "/media/philips-ar.png"
    assert client.get("/api/v1/brands").json() == [
        {"id": brand["id"], "name": "Philips Arabia", "logo_url": "/media/philips-ar.png"}
    ]

    blocked = client.delete(f"/api/v1/admin/brands/{brand['id']}", headers=headers)
    assert blocked.status_code == 409
    assert "brand_has_products" in blocked.text

    removed = client.patch(
        f"/api/v1/admin/products/{product.json()['id']}", headers=headers, json={"brand_id": None}
    )
    assert removed.status_code == 200
    assert removed.json()["brand_id"] is None
    assert client.delete(f"/api/v1/admin/brands/{brand['id']}", headers=headers).status_code == 200
