import json
import logging
import re
import requests
from typing import Dict, Any, List, Optional
from django.conf import settings
from apps.core.models import SiteSetting
from apps.marketing.services.meta_crypto import encrypt_token, decrypt_token

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
DEFAULT_CATALOG_ID = "798721796069008"


def clean_description(text: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', '', text)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


class MetaCatalogService:
    """
    Production-grade client for the Meta Catalog Items Batch API.
    Handles real-time item updates, batch upserts, item removals,
    and connection health diagnostics.
    """

    @classmethod
    def get_config(cls) -> Dict[str, Any]:
        """
        Retrieves Meta Catalog configuration.
        Checks SiteSetting (key: 'meta_catalog') first, falling back to Django settings / .env.
        """
        setting_val = SiteSetting.get_value("meta_catalog", {}) or {}
        catalog_id = setting_val.get("catalog_id") or getattr(settings, 'META_CATALOG_ID', DEFAULT_CATALOG_ID)
        
        # Access token might be stored encrypted
        encrypted_token = setting_val.get("access_token_encrypted") or ""
        plain_token = ""
        if encrypted_token:
            try:
                plain_token = decrypt_token(encrypted_token)
            except Exception:
                plain_token = encrypted_token
        if not plain_token:
            plain_token = setting_val.get("access_token") or getattr(settings, 'META_ACCESS_TOKEN', '')

        auto_sync = setting_val.get("auto_sync_enabled", True)

        return {
            "catalog_id": str(catalog_id).strip(),
            "access_token": plain_token.strip(),
            "auto_sync_enabled": bool(auto_sync),
            "has_token": bool(plain_token.strip())
        }

    @classmethod
    def save_config(cls, catalog_id: str, access_token: str, auto_sync_enabled: bool = True) -> Dict[str, Any]:
        """
        Saves updated Meta Catalog configuration with encrypted token.
        """
        existing = SiteSetting.get_value("meta_catalog", {}) or {}
        
        # If user passed empty token or masked token, keep existing
        if not access_token or access_token.startswith("••••") or access_token == "REDACTED":
            encrypted_token = existing.get("access_token_encrypted", "")
        else:
            encrypted_token = encrypt_token(access_token)

        new_val = {
            "catalog_id": catalog_id.strip() if catalog_id else DEFAULT_CATALOG_ID,
            "access_token_encrypted": encrypted_token,
            "auto_sync_enabled": auto_sync_enabled
        }

        SiteSetting.objects.update_or_create(
            key="meta_catalog",
            defaults={
                "value": new_val,
                "description": "Meta Commerce Manager Catalog API configuration"
            }
        )
        return cls.get_config()

    @classmethod
    def test_connection(cls) -> Dict[str, Any]:
        """
        Validates Catalog ID and Access Token against Meta's Graph API.
        """
        cfg = cls.get_config()
        catalog_id = cfg["catalog_id"]
        token = cfg["access_token"]

        if not token:
            return {
                "success": False,
                "catalog_id": catalog_id,
                "message": "Meta Access Token is not configured. Please add an access token."
            }

        url = f"{BASE_URL}/{catalog_id}"
        params = {
            "fields": "id,name,product_count,vertical",
            "access_token": token
        }

        try:
            res = requests.get(url, params=params, timeout=10)
            data = res.json()
            if res.status_code == 200:
                return {
                    "success": True,
                    "catalog_id": data.get("id", catalog_id),
                    "catalog_name": data.get("name", "Meta Catalog"),
                    "product_count": data.get("product_count", 0),
                    "vertical": data.get("vertical", "commerce"),
                    "message": "Connection successful! Catalog is active and verified."
                }
            else:
                err_msg = data.get("error", {}).get("message", "Unknown Meta API error")
                err_code = data.get("error", {}).get("code")
                return {
                    "success": False,
                    "catalog_id": catalog_id,
                    "error_code": err_code,
                    "message": f"Meta API Error ({err_code}): {err_msg}"
                }
        except Exception as e:
            logger.error(f"[MetaCatalogService] Connection test failed: {e}")
            return {
                "success": False,
                "catalog_id": catalog_id,
                "message": f"Network error connecting to Meta Graph API: {str(e)}"
            }

    @classmethod
    def format_product_item(cls, product) -> Dict[str, Any]:
        """
        Converts a Django Product model into Meta Catalog item data.
        """
        store_base = getattr(settings, 'STORE_BASE_URL', 'https://store.poshplexbd.com')
        api_base = getattr(settings, 'SITE_BASE_URL', 'https://media.poshplexbd.com')
        if settings.DEBUG:
            store_base = 'http://localhost:3000'
            api_base = 'http://localhost:8000'

        sku = product.sku or f"PROD-{product.id}"
        title = product.name or "Poshplex Product"
        desc = clean_description(product.description or product.short_description or product.name)
        link = f"{store_base.rstrip('/')}/product/{product.slug}"

        # Resolve primary image
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
                image_url = f"{api_base.rstrip('/')}{img_rel}"
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

        price_str = f"{float(price):.2f} BDT"
        availability = "in stock" if (product.is_active and not product.is_sold_out) else "out of stock"
        brand = product.brand.name if product.brand else "Poshplex"
        category_name = product.category.name if product.category else "Apparel & Accessories"

        return {
            "id": sku,
            "title": title,
            "description": desc,
            "availability": availability,
            "condition": "new",
            "price": price_str,
            "link": link,
            "image_link": image_url,
            "brand": brand,
            "fb_product_category": category_name
        }

    @classmethod
    def send_batch(cls, requests_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Dispatches a batch of requests to Meta's /{catalog_id}/items_batch endpoint.
        """
        cfg = cls.get_config()
        catalog_id = cfg["catalog_id"]
        token = cfg["access_token"]

        if not token:
            logger.warning("[MetaCatalogService] Skipped sync: No Meta Access Token configured.")
            return {"success": False, "message": "No Meta Access Token configured."}

        url = f"{BASE_URL}/{catalog_id}/items_batch"
        data_payload = {
            "item_type": "PRODUCT_ITEM",
            "requests": json.dumps(requests_list),
            "access_token": token
        }

        try:
            res = requests.post(url, data=data_payload, timeout=25)
            data = res.json()
            if res.status_code == 200:
                logger.info(f"[MetaCatalogService] Items batch dispatched successfully. Handles: {data.get('handles')}")
                return {
                    "success": True,
                    "handles": data.get("handles", []),
                    "count": len(requests_list)
                }
            else:
                err = data.get("error", {})
                logger.error(f"[MetaCatalogService] Items batch failed: {err}")
                return {
                    "success": False,
                    "error": err,
                    "message": err.get("message", "Items batch sync failed.")
                }
        except Exception as e:
            logger.error(f"[MetaCatalogService] Network exception during items batch send: {e}")
            return {
                "success": False,
                "message": f"Network exception: {str(e)}"
            }

    @classmethod
    def sync_products(cls, products: List[Any], method: str = "UPDATE") -> Dict[str, Any]:
        """
        Batches products in chunks of up to 250 items and sends them to Meta.
        """
        if not products:
            return {"success": True, "count": 0, "message": "No products to sync."}

        requests_list = []
        for p in products:
            item_data = cls.format_product_item(p)
            requests_list.append({
                "method": method,
                "data": item_data
            })

        # Chunk into batches of 250
        chunk_size = 250
        total_synced = 0
        errors = []

        for i in range(0, len(requests_list), chunk_size):
            chunk = requests_list[i:i + chunk_size]
            res = cls.send_batch(chunk)
            if res.get("success"):
                total_synced += len(chunk)
            else:
                errors.append(res.get("message", "Unknown error in chunk"))

        return {
            "success": len(errors) == 0,
            "total_requested": len(requests_list),
            "total_synced": total_synced,
            "errors": errors
        }

    @classmethod
    def delete_product_by_sku(cls, sku: str) -> Dict[str, Any]:
        """
        Removes an item from the Meta Catalog by its retailer SKU.
        """
        request_item = {
            "method": "DELETE",
            "data": {
                "id": sku
            }
        }
        return cls.send_batch([request_item])
