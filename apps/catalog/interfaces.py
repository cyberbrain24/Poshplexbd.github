from decimal import Decimal
from typing import Optional
from apps.catalog.models import ProductVariant

def get_variant_details_by_sku(sku: str) -> Optional[dict]:
    """
    Public interface to look up product variant details from another module.
    Returns details dict or None if SKU not found.
    Does NOT return the raw Django Model instance.
    """
    try:
        variant = ProductVariant.objects.select_related('product').get(sku=sku)
        return {
            "sku": variant.sku,
            "price": variant.price,
            "product_id": variant.product.id,
            "product_name": variant.product.name,
            "attributes": variant.attributes
        }
    except ProductVariant.DoesNotExist:
        return None

def is_sku_available(sku: str) -> bool:
    """Verify if a variant SKU is defined in the catalog."""
    return ProductVariant.objects.filter(sku=sku).exists()
