from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import DeliveryArea, Order, StoreSettings
from tests.conftest import make_product


def _payload(product, **overrides):
    payload = {
        "client_reference": f"delivery-checkout-{product.id}",
        "customer_name": "عميل اختبار",
        "customer_phone": "0591234567",
        "address": "رام الله، شارع الإرسال، بناية 5",
        "delivery_method": "delivery",
        "payment_method": "cash_on_delivery",
        "items": [{"product_id": product.id, "quantity": 1}],
    }
    payload.update(overrides)
    return payload


def _area(db: Session, name: str, fee: str, **kwargs) -> DeliveryArea:
    area = DeliveryArea(name=name, delivery_fee=Decimal(fee), **kwargs)
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


def _settings(db: Session, threshold: str | None) -> StoreSettings:
    row = StoreSettings(store_name="Test", free_delivery_threshold=Decimal(threshold) if threshold else None)
    db.add(row)
    db.commit()
    return row


def test_city_fee_and_global_threshold_are_server_calculated(client: TestClient, db: Session) -> None:
    product = make_product(db, price="100.00", stock=10)
    ramallah = _area(db, "رام الله", "20.00", min_order_amount=Decimal("999.00"))
    nablus = _area(db, "نابلس", "35.00")
    _settings(db, "300.00")

    low = client.post("/api/v1/cart/price", json={"items": [{"product_id": product.id, "quantity": 1}], "delivery_area_id": ramallah.id})
    other = client.post("/api/v1/cart/price", json={"items": [{"product_id": product.id, "quantity": 1}], "delivery_area_id": nablus.id})
    reached = client.post("/api/v1/cart/price", json={"items": [{"product_id": product.id, "quantity": 3}], "delivery_area_id": ramallah.id})

    assert low.status_code == other.status_code == reached.status_code == 200
    assert low.json()["delivery_fee"] == 20.0  # no delivery minimum is enforced
    assert other.json()["delivery_fee"] == 35.0
    assert reached.json()["delivery_fee"] == 0.0
    assert reached.json()["free_delivery_applied"] is True


def test_disabled_threshold_and_inactive_city(client: TestClient, db: Session) -> None:
    product = make_product(db, price="100.00", stock=10)
    active = _area(db, "الخليل", "18.00")
    inactive = _area(db, "أريحا", "12.00", is_active=False)
    _settings(db, None)

    normal = client.post("/api/v1/cart/price", json={"items": [{"product_id": product.id, "quantity": 5}], "delivery_area_id": active.id})
    unavailable = client.post("/api/v1/cart/price", json={"items": [{"product_id": product.id, "quantity": 1}], "delivery_area_id": inactive.id})

    assert normal.status_code == 200
    assert normal.json()["delivery_fee"] == 18.0
    assert normal.json()["free_delivery_applied"] is False
    assert unavailable.status_code == 400


def test_pickup_is_free_and_persists_without_delivery_address(client: TestClient, db: Session) -> None:
    product = make_product(db, price="100.00", stock=10)
    response = client.post("/api/v1/orders", json=_payload(product, delivery_method="pickup", address="", shipping_price=0))

    assert response.status_code == 201, response.text
    order = db.get(Order, response.json()["id"])
    assert order.delivery_method == "pickup"
    assert order.delivery_area_id is None
    assert order.delivery_fee == Decimal("0.00")
    assert order.total == Decimal("100.00")


def test_delivery_order_uses_city_fee_and_cod_only(client: TestClient, db: Session) -> None:
    product = make_product(db, price="100.00", stock=10)
    area = _area(db, "بيت لحم", "22.00")
    created = client.post("/api/v1/orders", json=_payload(product, delivery_area_id=area.id, shipping_price=0))
    electronic = client.post("/api/v1/orders", json=_payload(product, client_reference="electronic-payment-1", delivery_area_id=area.id, payment_method="electronic"))

    assert created.status_code == 201, created.text
    assert created.json()["payment_method"] == "cash_on_delivery"
    assert created.json()["delivery_fee"] == 22.0
    assert db.get(Order, created.json()["id"]).delivery_method == "delivery"
    assert electronic.status_code == 422
