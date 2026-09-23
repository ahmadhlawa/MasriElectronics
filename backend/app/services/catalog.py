"""Catalog querying and product serialisation shared by the public and admin APIs."""

from __future__ import annotations

import re
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import Select, and_, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import ProductType
from app.models import (
    AttributeDefinition, Brand, Category, PackageItem, Product, ProductAttributeValue,
    ProductOption, ProductVariant,
)
from app.services.errors import DomainError

_TASHKEEL = re.compile(r"[ً-ْـ]")
_ALEF = re.compile(r"[أإآ]")
_IDENTIFIER_SEPARATORS = re.compile(r"[-_\s./]+")


def normalize_arabic(text: str) -> str:
    """Fold Arabic orthographic variants so search matches how people actually type."""
    value = unicodedata.normalize("NFKC", text or "").strip().lower()
    value = _TASHKEEL.sub("", value)
    value = _ALEF.sub("ا", value)
    value = value.replace("ى", "ي").replace("ؤ", "و")
    value = value.replace("ئ", "ي").replace("ة", "ه")
    return re.sub(r"\s+", " ", value)


def refresh_search_text(product: Product) -> None:
    """Keep `Product.search_text` in step with the fields users search by."""
    parts = [product.name or "", product.sku or "", product.model_number or "", product.short_description or ""]
    product.search_text = normalize_arabic(" ".join(parts))[:800]


def matching_brand_ids(db: Session, query: str) -> list[int]:
    """Resolve normalized brand names in one query; brand renames need no reindex."""
    needle = normalize_arabic(query)
    return [brand_id for brand_id, name in db.execute(select(Brand.id, Brand.name))
            if needle in normalize_arabic(name)]


def _contains_pattern(value: str) -> str:
    return f"%{value.replace('!', '!!').replace('%', '!%').replace('_', '!_')}%"


def _compact_identifier_column(column):
    result = func.lower(column)
    for separator in ("-", "_", " ", "/", "."):
        result = func.replace(result, separator, "")
    return result


def product_loaders():
    return (
        selectinload(Product.images),
        selectinload(Product.specifications),
        selectinload(Product.attribute_values).selectinload(ProductAttributeValue.definition),
        selectinload(Product.options),
        selectinload(Product.variants),
        selectinload(Product.package_items).selectinload(PackageItem.included_product),
        selectinload(Product.category),
        selectinload(Product.brand),
    )


def base_product_query(*, active_only: bool) -> Select:
    stmt = select(Product).options(*product_loaders())
    if active_only:
        stmt = stmt.where(Product.is_active.is_(True))
    return stmt


def apply_product_filters(
    stmt: Select,
    *,
    q: str | None = None,
    search_brand_ids: list[int] | None = None,
    category_slug: str | None = None,
    category_id: int | None = None,
    brand_id: int | None = None,
    attribute_filters: list[tuple[AttributeDefinition, str, object]] | None = None,
    product_type: str | None = None,
    is_featured: bool | None = None,
    is_new: bool | None = None,
    is_bestseller: bool | None = None,
    on_sale: bool | None = None,
    in_stock: bool | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    is_active: bool | None = None,
) -> Select:
    if q:
        normalized = normalize_arabic(q)
        if search_brand_ids is None:
            stmt = stmt.where(Product.search_text.like(f"%{normalized}%"))
        else:
            compact = _IDENTIFIER_SEPARATORS.sub("", normalized)
            matches = [Product.search_text.like(_contains_pattern(normalized), escape="!")]
            if compact:
                identifier_pattern = _contains_pattern(compact)
                matches.extend((
                    _compact_identifier_column(Product.model_number).like(identifier_pattern, escape="!"),
                    _compact_identifier_column(Product.sku).like(identifier_pattern, escape="!"),
                ))
            if search_brand_ids:
                matches.append(Product.brand_id.in_(search_brand_ids))
            stmt = stmt.where(or_(*matches))
    if category_slug:
        stmt = stmt.join(Category, Product.category_id == Category.id).where(
            Category.slug == category_slug
        )
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if brand_id is not None:
        stmt = stmt.where(Product.brand_id == brand_id)
    for definition, operator, value in attribute_filters or []:
        column = getattr(ProductAttributeValue, f"{definition.type}_value")
        if operator == "eq":
            condition = column == value
        elif operator == "gte":
            condition = column >= value
        else:
            condition = column <= value
        stmt = stmt.where(
            select(ProductAttributeValue.id).where(
                ProductAttributeValue.product_id == Product.id,
                ProductAttributeValue.attribute_definition_id == definition.id,
                condition,
            ).exists()
        )
    if product_type:
        stmt = stmt.where(Product.product_type == product_type)
    if is_featured is not None:
        stmt = stmt.where(Product.is_featured.is_(is_featured))
    if is_new is not None:
        stmt = stmt.where(Product.is_new.is_(is_new))
    if is_bestseller is not None:
        stmt = stmt.where(Product.is_bestseller.is_(is_bestseller))
    if on_sale:
        stmt = stmt.where(
            Product.compare_at_price.is_not(None), Product.compare_at_price > Product.price
        )
    if in_stock:
        has_variants = exists().where(ProductVariant.product_id == Product.id)
        has_stocked_variant = exists().where(
            ProductVariant.product_id == Product.id,
            ProductVariant.is_active.is_(True),
            ProductVariant.stock_quantity > 0,
        )
        stmt = stmt.where(
            or_(
                Product.track_inventory.is_(False),
                and_(~has_variants, Product.stock_quantity > 0),
                and_(has_variants, has_stocked_variant),
            )
        )
    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)
    if is_active is not None:
        stmt = stmt.where(Product.is_active.is_(is_active))
    return stmt


_SORTS = {
    "featured": (Product.is_featured.desc(), Product.sort_order.asc(), Product.id.desc()),
    "newest": (Product.is_new.desc(), Product.created_at.desc(), Product.id.desc()),
    "price-asc": (Product.price.asc(), Product.id.asc()),
    "price-desc": (Product.price.desc(), Product.id.asc()),
    "name": (Product.name.asc(),),
    "sort_order": (Product.sort_order.asc(), Product.id.asc()),
}


def apply_product_sort(stmt: Select, sort: str) -> Select:
    return stmt.order_by(*_SORTS.get(sort, _SORTS["featured"]))


def count_query(stmt: Select) -> Select:
    return select(func.count()).select_from(stmt.order_by(None).subquery())


def paginate(db: Session, stmt: Select, *, offset: int, limit: int) -> tuple[list[Any], int]:
    total = int(db.execute(count_query(stmt)).scalar_one())
    rows = db.execute(stmt.offset(offset).limit(limit)).scalars().unique().all()
    return list(rows), total


def in_stock(product: Product) -> bool:
    if not product.track_inventory:
        return True
    if not product.variants:
        return product.stock_quantity > 0
    return any(variant.is_active and variant.stock_quantity > 0 for variant in product.variants)


def validate_attribute_value(definition: AttributeDefinition, values: dict) -> None:
    fields = ("number_value", "enum_value", "boolean_value", "text_value")
    filled = [field for field in fields if values.get(field) is not None]
    if filled != [f"{definition.type}_value"]:
        raise DomainError("Attribute value does not match its type.", code="invalid_attribute_value")
    if definition.type == "enum" and values["enum_value"] not in {
        choice["code"] for choice in definition.enum_choices
    }:
        raise DomainError("Unknown enum choice.", code="invalid_attribute_choice")
    if definition.type == "text" and not values["text_value"].strip():
        raise DomainError("Text attribute cannot be blank.", code="invalid_attribute_value")


def parse_attribute_filters(db: Session, category_slug: str | None, raw_filters: list[str]) -> list[tuple[AttributeDefinition, str, object]]:
    if not raw_filters:
        return []
    if not category_slug or len(raw_filters) > 12:
        raise DomainError("Attribute filters require one category and at most 12 conditions.", code="invalid_attribute_filter")
    category = db.scalar(select(Category).where(Category.slug == category_slug, Category.is_active.is_(True)))
    if category is None:
        raise DomainError("Unknown attribute category.", code="invalid_attribute_filter")
    definitions = {
        row.key: row for row in db.scalars(
            select(AttributeDefinition).where(AttributeDefinition.category_id == category.id)
        )
    }
    parsed = []
    for raw in raw_filters:
        parts = raw.split(":", 2)
        if len(parts) != 3 or not parts[2] or len(raw) > 350:
            raise DomainError("Invalid attribute filter format.", code="invalid_attribute_filter")
        key, operator, literal = parts
        definition = definitions.get(key)
        if definition is None or not definition.filterable:
            raise DomainError("Attribute is not filterable for this category.", code="invalid_attribute_filter")
        if operator not in ({"eq", "gte", "lte"} if definition.type == "number" else {"eq"}):
            raise DomainError("Invalid attribute filter operator.", code="invalid_attribute_filter")
        if definition.type == "number":
            try:
                value = Decimal(literal)
            except InvalidOperation as exc:
                raise DomainError("Invalid numeric attribute filter.", code="invalid_attribute_filter") from exc
            if not value.is_finite():
                raise DomainError("Invalid numeric attribute filter.", code="invalid_attribute_filter")
        elif definition.type == "boolean":
            if literal not in {"true", "false"}:
                raise DomainError("Invalid boolean attribute filter.", code="invalid_attribute_filter")
            value = literal == "true"
        elif definition.type == "enum":
            if literal not in {choice["code"] for choice in definition.enum_choices}:
                raise DomainError("Invalid enum attribute filter.", code="invalid_attribute_filter")
            value = literal
        else:
            value = literal
        parsed.append((definition, operator, value))
    return parsed


def attribute_value_payload(row: ProductAttributeValue) -> dict[str, Any]:
    definition = row.definition
    return {
        "id": row.id,
        "attribute_definition_id": row.attribute_definition_id,
        "key": definition.key,
        "label": definition.label,
        "type": definition.type,
        "unit": definition.unit,
        "number_value": row.number_value,
        "enum_value": row.enum_value,
        "boolean_value": row.boolean_value,
        "text_value": row.text_value,
    }


def public_attribute_payload(row: ProductAttributeValue) -> dict[str, Any]:
    definition = row.definition
    return {
        "key": definition.key,
        "label": definition.label,
        "type": definition.type,
        "unit": definition.unit,
        "value": getattr(row, f"{definition.type}_value"),
        "option_label": next((choice["label"] for choice in definition.enum_choices
                              if choice["code"] == row.enum_value), None)
        if definition.type == "enum" else None,
        "comparable": definition.comparable,
        "show_on_card": definition.show_on_card,
        "sort_order": definition.sort_order,
    }


def product_payload(product: Product, *, include_relations: bool) -> dict[str, Any]:
    """Flatten a Product into the shape the API schemas expect."""
    attributes = [public_attribute_payload(row) for row in sorted(
        product.attribute_values, key=lambda row: (row.definition.sort_order, row.definition.id)
    )]
    payload: dict[str, Any] = {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "short_description": product.short_description,
        "sku": product.sku,
        "model_number": product.model_number,
        "card_attributes": [row for row in attributes if row["show_on_card"]][:2],
        "product_type": product.product_type,
        "category_id": product.category_id,
        "category_name": product.category.name if product.category else None,
        "category_slug": product.category.slug if product.category else None,
        "brand_id": product.brand_id,
        "brand_name": product.brand.name if product.brand else None,
        "brand_logo_url": product.brand.logo_url if product.brand else None,
        "price": product.price,
        "compare_at_price": product.compare_at_price,
        "stock_quantity": product.stock_quantity,
        "track_inventory": product.track_inventory,
        "in_stock": in_stock(product),
        "is_featured": product.is_featured,
        "is_new": product.is_new,
        "is_bestseller": product.is_bestseller,
        "primary_image_url": product.primary_image_url,
        "secondary_image_url": product.secondary_image_url,
        "has_options": bool(product.options),
        "package_item_count": len(product.package_items),
    }
    if not include_relations:
        return payload

    payload.update(
        {
            "description": product.description,
            "seo_title": product.seo_title,
            "seo_description": product.seo_description,
            "images": product.images,
            "specifications": product.specifications,
            "attributes": attributes,
            "options": product.options,
            "variants": product.variants,
            "package_items": [
                {
                    "id": item.id,
                    "included_product_id": item.included_product_id,
                    "included_product_name": item.included_product.name
                    if item.included_product
                    else None,
                    "included_product_slug": item.included_product.slug
                    if item.included_product
                    else None,
                    "included_product_image_url": item.included_product.primary_image_url
                    if item.included_product
                    else None,
                    "quantity": item.quantity,
                    "display_note": item.display_note,
                    "sort_order": item.sort_order,
                }
                for item in product.package_items
            ],
        }
    )
    return payload


def admin_product_payload(product: Product) -> dict[str, Any]:
    payload = product_payload(product, include_relations=True)
    payload.update(
        {
            "cost_price": product.cost_price,
            "is_active": product.is_active,
            "low_stock_threshold": product.low_stock_threshold,
            "sort_order": product.sort_order,
            "created_at": product.created_at,
            "updated_at": product.updated_at,
        }
    )
    return payload


def admin_product_list_payload(product: Product) -> dict[str, Any]:
    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "sku": product.sku,
        "model_number": product.model_number,
        "product_type": product.product_type,
        "category_id": product.category_id,
        "category_name": product.category.name if product.category else None,
        "brand_id": product.brand_id,
        "brand_name": product.brand.name if product.brand else None,
        "price": product.price,
        "compare_at_price": product.compare_at_price,
        "cost_price": product.cost_price,
        "stock_quantity": product.stock_quantity,
        "track_inventory": product.track_inventory,
        "low_stock_threshold": product.low_stock_threshold,
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_new": product.is_new,
        "is_bestseller": product.is_bestseller,
        "sort_order": product.sort_order,
        "primary_image_url": product.primary_image_url,
        "updated_at": product.updated_at,
    }


def category_payload(category: Category, product_count: int = 0) -> dict[str, Any]:
    return {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "image_url": category.image_url,
        "parent_id": category.parent_id,
        "is_active": category.is_active,
        "is_featured": category.is_featured,
        "sort_order": category.sort_order,
        "product_count": product_count,
    }


def product_counts_by_category(db: Session, *, active_only: bool) -> dict[int, int]:
    stmt = select(Product.category_id, func.count(Product.id)).group_by(Product.category_id)
    if active_only:
        stmt = stmt.where(Product.is_active.is_(True))
    return {row[0]: row[1] for row in db.execute(stmt) if row[0] is not None}


def assert_package_is_valid(db: Session, package: Product, included_product_id: int) -> Product:
    """A package cannot contain itself, and cannot contain another package."""
    from app.services.errors import DomainError, NotFoundError

    if package.product_type != ProductType.PACKAGE.value:
        raise DomainError(
            "يمكن إضافة محتويات للبكجات فقط.", code="not_a_package"
        )
    if included_product_id == package.id:
        raise DomainError("لا يمكن أن يحتوي البكج على نفسه.", code="package_self_reference")
    included = db.get(Product, included_product_id)
    if included is None:
        raise NotFoundError("المنتج المضاف غير موجود.", code="product_not_found")
    if included.product_type == ProductType.PACKAGE.value:
        raise DomainError(
            "لا يمكن أن يحتوي البكج على بكج آخر.", code="package_nested"
        )
    return included
