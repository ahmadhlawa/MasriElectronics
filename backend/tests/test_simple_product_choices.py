from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Invoice, Order, Product, ProductOption, ProductOptionValue, ProductVariant
from tests.conftest import auth, make_product


def _options(db: Session, product: Product):
    color = ProductOption(product_id=product.id, name="اللون", sort_order=0)
    color.values = [ProductOptionValue(value="أسود"), ProductOptionValue(value="أبيض")]
    capacity = ProductOption(product_id=product.id, name="السعة", sort_order=1, affects_price=True)
    capacity.values = [
        ProductOptionValue(value="1.5 لتر", price_override=Decimal("125.00")),
        ProductOptionValue(value="2 لتر", price_override=Decimal("150.00")),
    ]
    db.add_all([color, capacity])
    db.commit()
    return color, capacity


def _line(product, ids, quantity=1):
    return {"product_id": product.id, "quantity": quantity, "selected_option_value_ids": ids}


def _order(product, ids, reference="simple-choice-order", quantity=1):
    return {
        "client_reference": reference,
        "customer_name": "سارة أحمد",
        "customer_phone": "0591234567",
        "address": "",
        "delivery_method": "pickup",
        "items": [_line(product, ids, quantity)],
    }


def test_option_metadata_persists_and_validation_is_enforced(client: TestClient, db: Session, admin_token: str):
    product = make_product(db)
    url = f"/api/v1/admin/products/{product.id}/options"
    payload = [
        {"name": "اللون", "affects_price": False, "values": [{"value": "أسود", "price_override": 99}]},
        {"name": "السعة", "affects_price": True, "values": [{"value": "2 لتر", "price_override": 125}]},
    ]
    saved = client.put(url, headers=auth(admin_token), json=payload)
    assert saved.status_code == 200, saved.text
    assert saved.json()[0]["values"][0]["price_override"] is None
    assert saved.json()[1]["affects_price"] is True
    assert saved.json()[1]["values"][0]["price_override"] == 125
    ids = [[value["id"] for value in option["values"]] for option in saved.json()]
    renamed = client.put(url, headers=auth(admin_token), json=[
        {**option, "name": f"{option['name']} محدث"} for option in saved.json()
    ])
    assert [[value["id"] for value in option["values"]] for option in renamed.json()] == ids

    multiple = client.put(url, headers=auth(admin_token), json=[
        {"name": "أ", "affects_price": True, "values": []},
        {"name": "ب", "affects_price": True, "values": []},
    ])
    assert multiple.status_code == 400
    assert multiple.json()["error"]["code"] == "multiple_price_options"
    negative = client.put(url, headers=auth(admin_token), json=[
        {"name": "أ", "affects_price": True, "values": [{"value": "س", "price_override": -1}]},
    ])
    assert negative.status_code == 422


def test_simple_choice_pricing_and_tamper_validation(client: TestClient, db: Session):
    product = make_product(db, price="100.00")
    color, capacity = _options(db, product)
    black, priced = color.values[0], capacity.values[0]
    url = "/api/v1/cart/price"
    browser_line = {**_line(product, [black.id, priced.id]), "unit_price": 1}
    valid = client.post(url, json={"delivery_method": "pickup", "items": [browser_line]})
    assert valid.status_code == 200, valid.text
    assert valid.json()["lines"][0]["unit_price"] == 125

    cases = [
        ([black.id], "options_required"),
        ([black.id, black.id], "duplicate_option_value"),
        ([black.id, color.values[1].id], "options_required"),
    ]
    other = make_product(db, slug="other")
    foreign, _ = _options(db, other)
    cases.append(([black.id, foreign.values[0].id], "option_value_mismatch"))
    for ids, code in cases:
        response = client.post(url, json={"delivery_method": "pickup", "items": [_line(product, ids)]})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == code


def test_simple_choice_snapshot_stock_cancel_and_invoice(client: TestClient, db: Session, admin_token: str):
    product = make_product(db, stock=2)
    color, capacity = _options(db, product)
    ids = [color.values[0].id, capacity.values[1].id]
    created = client.post("/api/v1/orders", json=_order(product, ids))
    assert created.status_code == 201, created.text
    assert created.json()["items"][0]["variant_description"] == "اللون: أسود، السعة: 2 لتر"
    order = db.get(Order, created.json()["id"])
    assert order.items[0].original_variant_description == "اللون: أسود، السعة: 2 لتر"
    db.expire_all()
    assert db.get(Product, product.id).stock_quantity == 1

    completed = client.post(
        f"/api/v1/admin/orders/{order.id}/complete",
        headers=auth(admin_token), json={"payment_method": "cash_on_delivery"},
    )
    assert completed.status_code == 200, completed.text
    invoice = db.query(Invoice).filter_by(order_id=order.id).one()
    assert invoice.items[0].variant_description == "اللون: أسود، السعة: 2 لتر"

    second = make_product(db, slug="cancel-simple", stock=2)
    second_color, second_capacity = _options(db, second)
    second_ids = [second_color.values[0].id, second_capacity.values[0].id]
    response = client.post("/api/v1/orders", json=_order(second, second_ids, "cancel-simple-order"))
    for _ in range(2):
        cancelled = client.post(
            f"/api/v1/admin/orders/{response.json()['id']}/status",
            headers=auth(admin_token), json={"status": "cancelled"},
        )
        assert cancelled.status_code == 200
    db.expire_all()
    assert db.get(Product, second.id).stock_quantity == 2


def test_variant_stock_remains_the_only_variant_inventory_source(client: TestClient, db: Session):
    product = make_product(db, slug="variant-choice", stock=9)
    variant = ProductVariant(product_id=product.id, title="أسود", stock_quantity=2)
    db.add(variant)
    db.commit()
    response = client.post("/api/v1/orders", json={
        **_order(product, [], "variant-choice-order"),
        "items": [{"product_id": product.id, "variant_id": variant.id, "quantity": 1}],
    })
    assert response.status_code == 201, response.text
    db.expire_all()
    assert db.get(Product, product.id).stock_quantity == 9
    assert db.get(ProductVariant, variant.id).stock_quantity == 1


def test_simple_and_variant_availability_and_filtering(client: TestClient, db: Session):
    available = make_product(db, slug="simple-available", stock=1)
    unavailable = make_product(db, slug="simple-empty", stock=0)
    _options(db, available)
    _options(db, unavailable)
    variant_product = make_product(db, slug="variant-availability", stock=10)
    db.add(ProductVariant(product_id=variant_product.id, title="نفد", stock_quantity=0, is_active=True))
    db.commit()

    assert client.get(f"/api/v1/products/{available.slug}").json()["in_stock"] is True
    assert client.get(f"/api/v1/products/{unavailable.slug}").json()["in_stock"] is False
    assert client.get(f"/api/v1/products/{variant_product.slug}").json()["in_stock"] is False
    slugs = {row["slug"] for row in client.get("/api/v1/products", params={"in_stock": True}).json()["items"]}
    assert available.slug in slugs
    assert unavailable.slug not in slugs
    assert variant_product.slug not in slugs
