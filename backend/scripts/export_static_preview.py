"""Generate the committed Vite preview payload and placeholder artwork from the preview YAML."""

from __future__ import annotations

import json
from pathlib import Path

from app.preview.dataset import load_dataset
from app.services.placeholder_image import hex_to_rgb, masri_preview_png


ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "instance" / "preview" / "masri-demo.yaml"
OUTPUT = ROOT / "frontend" / "src" / "preview" / "demoData.js"
MEDIA_DIR = ROOT / "frontend" / "public" / "preview"


def main() -> None:
    dataset = load_dataset(DATASET)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    media_urls: dict[str, str] = {}
    for media in dataset.media:
        filename = f"{media.key}.png"
        (MEDIA_DIR / filename).write_bytes(
            masri_preview_png(
                1600 if media.shape == "wide" else 900,
                720 if media.shape == "wide" else 900,
                hex_to_rgb(media.start_color),
                hex_to_rgb(media.end_color),
                media.key,
            )
        )
        media_urls[media.key] = f"/preview/{filename}"

    categories = [
        {
            "id": index + 1,
            "slug": item.slug,
            "name": item.name,
            "description": item.description,
            "image_url": media_urls.get(item.image),
            "is_featured": item.is_featured,
            "product_count": sum(product.category == item.slug for product in dataset.products),
            "children": [],
        }
        for index, item in enumerate(dataset.categories)
    ]
    category_by_slug = {item["slug"]: item for item in categories}
    products = []
    for index, item in enumerate(dataset.products):
        category = category_by_slug[item.category]
        image_url = media_urls[item.gallery[0]] if item.gallery else None
        products.append(
            {
                "id": index + 1,
                "slug": item.slug,
                "name": item.name,
                "category_id": category["id"],
                "category_name": category["name"],
                "category_slug": category["slug"],
                "sku": item.sku,
                "product_type": item.product_type,
                "price": float(item.price),
                "compare_at_price": float(item.compare_at_price) if item.compare_at_price else None,
                "stock_quantity": item.stock_quantity,
                "track_inventory": item.track_inventory,
                "in_stock": item.stock_quantity > 0,
                "is_active": item.is_active,
                "is_featured": item.is_featured,
                "is_new": item.is_new,
                "is_bestseller": item.is_bestseller,
                "short_description": item.short_description,
                "description": item.description,
                "primary_image_url": image_url,
                "secondary_image_url": None,
                "images": [{"url": media_urls[key], "alt_text": ""} for key in item.gallery],
                "specifications": [item.model_dump() for item in item.specifications],
                "options": [],
                "variants": [],
                "has_options": False,
                "package_item_count": 0,
                "package_items": [],
                "sort_order": item.sort_order,
            }
        )
    document = {
        "settings": {"store_name": "Masri Electronics", "store_name_ar": "المصري للأدوات الكهربائية", "currency_symbol": "₪", "currency_code": "ILS", "announcement": dataset.notice or ""},
        "categories": categories,
        "products": products,
        "heroSlides": [
            {"id": index + 1, "image_url": item.image_url or media_urls.get(item.image)}
            for index, item in enumerate(dataset.hero_slides)
        ],
        "homeSections": [
            {"id": index + 1, "section_key": item.key, "section_type": item.section_type, "title": item.title, "description": item.description, "sort_order": item.sort_order, "config": {}}
            for index, item in enumerate(dataset.home_sections)
        ],
        "deliveryAreas": [],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("// Generated from instance/preview/masri-demo.yaml; do not edit manually.\nexport const previewData = " + json.dumps(document, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")


if __name__ == "__main__":
    main()
