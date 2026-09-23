"""Category-scoped appliance attributes and compatible public listings."""

from fastapi.testclient import TestClient

from tests.conftest import auth


def _definition(client, headers, category_id, key, kind, **extra):
    response = client.post(
        f"/api/v1/admin/categories/{category_id}/attributes",
        headers=headers,
        json={"key": key, "label": key, "type": kind, **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _product(client, headers, category_id, name, brand_id=None, model_number=None):
    response = client.post(
        "/api/v1/admin/products",
        headers=headers,
        json={"name": name, "price": 100, "category_id": category_id,
              "brand_id": brand_id, "model_number": model_number},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_model_number_brand_and_existing_list_fields(client: TestClient, admin_token, category):
    headers = auth(admin_token)
    brand = client.post("/api/v1/admin/brands", headers=headers, json={"name": "Brand A"}).json()
    first = _product(client, headers, category.id, "Fridge A", brand["id"], "RF-300")
    second = _product(client, headers, category.id, "Fridge B")

    result = client.get("/api/v1/products", params={"brand_id": brand["id"]})
    assert result.status_code == 200
    assert result.json()["total"] == 1
    item = result.json()["items"][0]
    assert item["id"] == first["id"] and item["model_number"] == "RF-300"
    assert item["sku"] == first["sku"] and "price" in item and "in_stock" in item
    assert item["card_attributes"] == []
    assert client.get("/api/v1/products").json()["total"] == 2
    assert client.get(f"/api/v1/products/{second['slug']}").json()["model_number"] is None
    changed = client.patch(f"/api/v1/admin/products/{first['id']}", headers=headers,
                           json={"model_number": "RF-301"})
    assert changed.status_code == 200 and changed.json()["model_number"] == "RF-301"
    assert changed.json()["sku"] == first["sku"]


def test_typed_filters_card_order_and_pagination(client: TestClient, admin_token, category):
    headers = auth(admin_token)
    category_id = category.id
    capacity = _definition(client, headers, category_id, "capacity_liters", "number",
                           unit="L", filterable=True, comparable=True, show_on_card=True, sort_order=2)
    no_frost = _definition(client, headers, category_id, "no_frost", "boolean",
                           filterable=True, show_on_card=True, sort_order=1)
    door = _definition(client, headers, category_id, "door_type", "enum",
                       choices=[{"code": "french", "label": "French"},
                                {"code": "side", "label": "Side"}],
                       filterable=True, show_on_card=True, sort_order=3)
    a = _product(client, headers, category_id, "Fridge A")
    b = _product(client, headers, category_id, "Fridge B")
    for product, liters, frost, door_code in [(a, "350", True, "french"),
                                               (b, "250", False, "side")]:
        response = client.put(
            f"/api/v1/admin/products/{product['id']}/attributes", headers=headers,
            json=[{"attribute_definition_id": capacity["id"], "number_value": liters},
                  {"attribute_definition_id": no_frost["id"], "boolean_value": frost},
                  {"attribute_definition_id": door["id"], "enum_value": door_code}],
        )
        assert response.status_code == 200, response.text

    def ids(*filters):
        result = client.get("/api/v1/products", params=[("category", category.slug),
                    *(("attribute", value) for value in filters)])
        assert result.status_code == 200, result.text
        return result.json()

    assert ids("capacity_liters:gte:300")["total"] == 1
    assert ids("door_type:eq:side")["items"][0]["id"] == b["id"]
    assert ids("no_frost:eq:true")["items"][0]["id"] == a["id"]
    combined = ids("capacity_liters:gte:300", "capacity_liters:lte:400",
                   "door_type:eq:french", "no_frost:eq:true")
    assert combined["total"] == 1 and combined["items"][0]["id"] == a["id"]
    assert [row["key"] for row in combined["items"][0]["card_attributes"]] == ["no_frost", "capacity_liters"]
    assert combined["items"][0]["card_attributes"][0]["value"] is True
    assert combined["items"][0]["card_attributes"][1]["value"] == 350.0
    detail = client.get(f"/api/v1/products/{a['slug']}")
    assert detail.status_code == 200
    attributes = detail.json()["attributes"]
    assert [row["key"] for row in attributes] == ["no_frost", "capacity_liters", "door_type"]
    assert attributes[0]["value"] is True and attributes[0]["show_on_card"] is True
    assert attributes[1]["value"] == 350.0 and attributes[1]["unit"] == "L"
    assert attributes[1]["comparable"] is True
    assert attributes[2]["option_label"] == "French" and attributes[2]["sort_order"] == 3
    client.patch(f"/api/v1/admin/categories/{category_id}/attributes/{capacity['id']}",
                 headers=headers, json={"show_on_card": False})
    shown = ids("door_type:eq:french")["items"][0]["card_attributes"]
    assert [row["key"] for row in shown] == ["no_frost", "door_type"]
    assert shown[1]["value"] == "french" and shown[1]["option_label"] == "French"
    assert client.get(f"/api/v1/categories/{category.slug}/attributes").json()[0]["key"] == "no_frost"
    assert ids("capacity_liters:gte:100")["total"] == 2
    paged = client.get("/api/v1/products", params=[("category", category.slug),
                       ("attribute", "capacity_liters:gte:100"), ("page_size", 1)])
    assert paged.json()["total"] == 2 and paged.json()["pages"] == 2


def test_invalid_filters_and_value_validation(client: TestClient, admin_token, category):
    headers = auth(admin_token)
    definition = _definition(client, headers, category.id, "door_type", "enum",
                             choices=[{"code": "side", "label": "Side"}], filterable=True)
    product = _product(client, headers, category.id, "Fridge")
    path = f"/api/v1/admin/products/{product['id']}/attributes"
    for value in [{"number_value": 2}, {"enum_value": "unknown"},
                  {"enum_value": "side", "text_value": "side"}]:
        response = client.put(path, headers=headers,
                              json=[{"attribute_definition_id": definition["id"], **value}])
        assert response.status_code == 400, response.text

    for params in [[("attribute", "door_type:eq:side")],
                   [("category", category.slug), ("attribute", "door_type:gte:side")],
                   [("category", category.slug), ("attribute", "unknown:eq:x")],
                   [("category", category.slug), ("attribute", "door_type:eq:unknown")]]:
        response = client.get("/api/v1/products", params=params)
        assert response.status_code == 400, response.text


def test_category_mismatch_and_definition_crud(client: TestClient, admin_token, category):
    headers = auth(admin_token)
    other = client.post("/api/v1/admin/categories", headers=headers,
                        json={"name": "Washers"}).json()
    definition = _definition(client, headers, category.id, "inverter", "boolean")
    product = _product(client, headers, other["id"], "Washer")
    response = client.put(f"/api/v1/admin/products/{product['id']}/attributes", headers=headers,
                          json=[{"attribute_definition_id": definition["id"], "boolean_value": True}])
    assert response.status_code == 400
    assert client.get(f"/api/v1/admin/categories/{category.id}/attributes", headers=headers).json()[0]["key"] == "inverter"
    edited = client.patch(f"/api/v1/admin/categories/{category.id}/attributes/{definition['id']}",
                          headers=headers, json={"label": "Inverter", "show_on_card": True})
    assert edited.status_code == 200 and edited.json()["label"] == "Inverter"
    assert client.delete(f"/api/v1/admin/categories/{category.id}/attributes/{definition['id']}",
                         headers=headers).status_code == 200


def test_stored_values_protect_definition_and_category(client: TestClient, admin_token, category):
    headers = auth(admin_token)
    other = client.post("/api/v1/admin/categories", headers=headers,
                        json={"name": "Washers"}).json()
    definition = _definition(client, headers, category.id, "inverter", "boolean")
    product = _product(client, headers, category.id, "Fridge")
    values_path = f"/api/v1/admin/products/{product['id']}/attributes"
    assert client.put(values_path, headers=headers,
                      json=[{"attribute_definition_id": definition["id"], "boolean_value": True}]).status_code == 200
    assert client.get(values_path, headers=headers).json()[0]["key"] == "inverter"
    definition_path = f"/api/v1/admin/categories/{category.id}/attributes/{definition['id']}"
    assert client.patch(definition_path, headers=headers, json={"type": "text"}).status_code == 409
    assert client.delete(definition_path, headers=headers).status_code == 409
    assert client.patch(f"/api/v1/admin/products/{product['id']}", headers=headers,
                        json={"category_id": other["id"]}).status_code == 409
    assert client.put(values_path, headers=headers, json=[]).status_code == 200
    assert client.patch(f"/api/v1/admin/products/{product['id']}", headers=headers,
                        json={"category_id": other["id"]}).status_code == 200
    assert client.delete(definition_path, headers=headers).status_code == 200
