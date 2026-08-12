from django.shortcuts import get_object_or_404
from django.db import models
import os
from apps.catalog.models import Product, Category

def list_products_by_category(category_slug: str) -> list:
    """Retrieve all products in a given category or its subcategories."""
    category = get_object_or_404(Category, slug=category_slug)
    subcategories = Category.objects.filter(parent=category)
    category_ids = [category.id] + [sub.id for sub in subcategories]
    return list(Product.objects.filter(categories__id__in=category_ids, is_active=True).exclude(categories__is_active=False).distinct().prefetch_related('variants', 'images'))

def get_product_details(slug: str = None, product: Product = None) -> dict:
    """Retrieve full product information with nested variants, brands, templates, and gallery."""
    if not product:
        product = get_object_or_404(Product.objects.prefetch_related('variants', 'images', 'categories'), slug=slug)
    
    variants_data = []
    for variant in product.variants.all():
        variants_data.append({
            "id": variant.id,
            "sku": variant.sku,
            "price": float(variant.price),
            "selling_price": float(variant.selling_price),
            "purchase_price": float(variant.purchase_price) if variant.purchase_price else None,
            "is_active": variant.is_active,
            "image_id": variant.image_id,
            "attributes": variant.attributes
        })
        
    images_data = []
    for img in product.images.all():
        url = img.image.url if img.image else ""
        if url and not (url.startswith("http://") or url.startswith("https://")):
            base_url = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
            url = f"{base_url.rstrip('/')}{url}"
        images_data.append({
            "id": img.id,
            "url": url,
            "alt_text": img.alt_text,
            "is_main": img.is_main,
            "color_tag": img.color_tag,
            "order": img.order
        })

    categories_data = [{
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug
    } for cat in product.categories.all()]
    
    # Resolve Size Guide
    size_guide = None
    if product.size_guide_template:
        size_guide = {
            "headers": product.size_guide_template.headers,
            "rows": product.size_guide_template.rows
        }
    elif hasattr(product, 'size_guide') and product.size_guide: # Fallback if direct guide dict
        size_guide = product.size_guide

    # Resolve Care Instructions
    care_instructions = ""
    if product.care_instructions_template:
        care_instructions = product.care_instructions_template.instructions
    elif hasattr(product, 'care_instructions') and product.care_instructions:
        care_instructions = product.care_instructions

    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "sku": product.sku,
        "product_type": product.product_type,
        "short_description": product.short_description or "",
        "description": product.description or "",
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "listing_order": product.listing_order,
        "base_price": float(product.base_price) if product.base_price else None,
        "price": float(product.base_price) if product.base_price else None,
        "brand": {
            "id": product.brand.id,
            "name": product.brand.name,
            "slug": product.brand.slug
        } if product.brand else None,
        "categories": categories_data,
        "category": {
            "id": product.category.id,
            "name": product.category.name,
            "slug": product.category.slug
        } if product.category else (categories_data[0] if categories_data else None),
        "size_guide": size_guide,
        "care_instructions": care_instructions,
        "size_guide_template_id": product.size_guide_template_id,
        "care_instructions_template_id": product.care_instructions_template_id,
        "youtube_video_url": product.youtube_video_url or "",
        "video_autoplay": product.video_autoplay,
        "video_mute": product.video_mute,
        "images": images_data,
        "variants": variants_data,
        "rating_average": round(float(product.reviews.filter(is_approved=True).aggregate(models.Avg('rating'))['rating__avg'] or 0.0), 1),
        "rating_count": product.reviews.filter(is_approved=True).count()
    }
