import html
import re
from xml.sax.saxutils import escape
from django.http import HttpResponse
from django.core.cache import cache
from django.conf import settings
from .models import Product


def clean_text(text: str) -> str:
    """Strip HTML tags and normalize whitespace for XML feed descriptions."""
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', '', text)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def meta_catalog_feed(request):
    """
    Generates a standard RSS 2.0 / Google Merchant & Meta Catalog XML feed.
    Fully compatible with Facebook Commerce Manager scheduled data feeds.
    Cached for 1 hour to ensure zero performance overhead on the live database.
    """
    cache_key = "meta_catalog_feed_xml"
    cached_xml = cache.get(cache_key)
    if cached_xml:
        return HttpResponse(cached_xml, content_type="application/xml; charset=utf-8")

    store_base_url = "https://store.poshplexbd.com"
    api_base_url = "https://media.poshplexbd.com"
    if settings.DEBUG:
        store_base_url = "http://localhost:3000"
        api_base_url = "http://localhost:8000"

    products = (
        Product.objects.filter(is_active=True)
        .select_related("brand", "category")
        .prefetch_related("images", "variants")
        .order_by("-id")
    )

    items_xml = []
    for product in products:
        sku = product.sku or f"PROD-{product.id}"
        title = product.name or "Poshplex Product"
        description = clean_text(product.description or product.short_description or product.name)
        link = f"{store_base_url}/product/{product.slug}"

        # Find main image or fallback to first image
        main_img = None
        for img in product.images.all():
            if img.is_main:
                main_img = img
                break
        if not main_img and product.images.exists():
            main_img = product.images.first()

        image_url = ""
        if main_img and main_img.image:
            img_rel = main_img.image.url
            if img_rel.startswith("http://") or img_rel.startswith("https://"):
                image_url = img_rel
            else:
                image_url = f"{api_base_url.rstrip('/')}{img_rel}"
        if not image_url:
            image_url = f"https://placehold.co/600x600.png?text={sku}"

        # Resolve price
        price = product.base_price or 0
        if not price and product.variants.exists():
            active_prices = [
                (v.selling_price or v.price)
                for v in product.variants.all()
                if v.is_active and (v.selling_price or v.price)
            ]
            if active_prices:
                price = min(active_prices)

        # Availability
        availability = "in stock" if (product.is_active and not product.is_sold_out) else "out of stock"

        # Brand
        brand = product.brand.name if product.brand else "Poshplex"

        # Category
        category_name = product.category.name if product.category else "Apparel & Accessories"

        item_str = f"""    <item>
      <g:id>{escape(sku)}</g:id>
      <g:title><![CDATA[{title}]]></g:title>
      <g:description><![CDATA[{description}]]></g:description>
      <g:link>{escape(link)}</g:link>
      <g:image_link>{escape(image_url)}</g:image_link>
      <g:brand><![CDATA[{brand}]]></g:brand>
      <g:condition>new</g:condition>
      <g:availability>{availability}</g:availability>
      <g:price>{float(price):.2f} BDT</g:price>
      <g:item_group_id>{escape(sku)}</g:item_group_id>
      <g:google_product_category>1604</g:google_product_category>
      <g:fb_product_category><![CDATA[{category_name}]]></g:fb_product_category>
    </item>"""
        items_xml.append(item_str)

    xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Poshplex Product Catalog Feed</title>
    <link>{store_base_url}</link>
    <description>Authoritative Product Catalog Feed for Meta Commerce Manager and Google Merchant</description>
{chr(10).join(items_xml)}
  </channel>
</rss>"""

    # Cache for 1 hour (3600 seconds)
    cache.set(cache_key, xml_content, 3600)

    return HttpResponse(xml_content, content_type="application/xml; charset=utf-8")

