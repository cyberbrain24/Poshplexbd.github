from typing import Optional
from apps.catalog.models import ProductVariant, Product

def get_variant_details_by_sku(sku: str) -> Optional[dict]:
    """
    Public interface to look up product variant details from another module.
    Returns details dict or None if SKU not found.
    Does NOT return the raw Django Model instance.
    """
    # 1. Try explicit ProductVariant first
    try:
        variant = ProductVariant.objects.select_related('product').get(sku=sku)
        return {
            "sku": variant.sku,
            "price": variant.price if variant.price is not None else variant.selling_price,
            "product_id": variant.product.id,
            "product_name": variant.product.name,
            "attributes": variant.attributes
        }
    except ProductVariant.DoesNotExist:
        pass

    # 2. Try Base Product (Simple Product)
    try:
        product = Product.objects.get(sku=sku)
        return {
            "sku": product.sku,
            "price": product.base_price or 0,
            "product_id": product.id,
            "product_name": product.name,
            "attributes": {}
        }
    except Product.DoesNotExist:
        pass
        
    # 3. Try Frontend Generated SKU fallback (e.g. PROD-<id>)
    if sku.startswith("PROD-"):
        product_id_str = sku.replace("PROD-", "")
        if product_id_str.isdigit():
            try:
                product = Product.objects.get(id=int(product_id_str))
                return {
                    "sku": sku,
                    "price": product.base_price or 0,
                    "product_id": product.id,
                    "product_name": product.name,
                    "attributes": {}
                }
            except Product.DoesNotExist:
                pass
                
    return None

def is_sku_available(sku: str) -> bool:
    """Verify if a variant SKU or base product SKU is defined in the catalog."""
    if ProductVariant.objects.filter(sku=sku).exists():
        return True
    if Product.objects.filter(sku=sku).exists():
        return True
    if sku.startswith("PROD-"):
        product_id_str = sku.replace("PROD-", "")
        if product_id_str.isdigit() and Product.objects.filter(id=int(product_id_str)).exists():
            return True
    return False
