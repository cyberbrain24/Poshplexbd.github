import logging
import threading
from celery import shared_task
from django.apps import apps

logger = logging.getLogger(__name__)


@shared_task(name="apps.catalog.tasks.meta_catalog_sync_product", bind=True, max_retries=3, default_retry_delay=60)
def meta_catalog_sync_product(self, product_id: int, method: str = "UPDATE"):
    """
    Celery background worker task to sync a single product to Meta Catalog.
    """
    try:
        from .models import Product
        from .meta_catalog_service import MetaCatalogService

        cfg = MetaCatalogService.get_config()
        if not cfg.get("auto_sync_enabled", True):
            logger.info(f"[MetaCatalogTask] Auto-sync disabled. Skipped product {product_id}.")
            return {"status": "skipped", "reason": "auto_sync_disabled"}

        if not cfg.get("has_token"):
            logger.info(f"[MetaCatalogTask] No Meta access token configured. Skipped product {product_id}.")
            return {"status": "skipped", "reason": "no_token"}

        product = (
            Product.objects.filter(id=product_id)
            .select_related("brand", "category")
            .prefetch_related("images", "variants")
            .first()
        )
        if not product:
            logger.warning(f"[MetaCatalogTask] Product {product_id} not found in database.")
            return {"status": "skipped", "reason": "not_found"}

        res = MetaCatalogService.sync_products([product], method=method)
        logger.info(f"[MetaCatalogTask] Product {product_id} ({product.sku}) sync result: {res}")
        return res
    except Exception as exc:
        logger.error(f"[MetaCatalogTask] Error syncing product {product_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc)


@shared_task(name="apps.catalog.tasks.meta_catalog_delete_product", bind=True, max_retries=3, default_retry_delay=60)
def meta_catalog_delete_product(self, sku: str):
    """
    Celery background worker task to delete a product from Meta Catalog by SKU.
    """
    try:
        from .meta_catalog_service import MetaCatalogService

        cfg = MetaCatalogService.get_config()
        if not cfg.get("has_token"):
            return {"status": "skipped", "reason": "no_token"}

        res = MetaCatalogService.delete_product_by_sku(sku)
        logger.info(f"[MetaCatalogTask] Deleted SKU {sku} from Meta Catalog: {res}")
        return res
    except Exception as exc:
        logger.error(f"[MetaCatalogTask] Error deleting SKU {sku}: {exc}", exc_info=True)
        raise self.retry(exc=exc)


@shared_task(name="apps.catalog.tasks.meta_catalog_sync_all", bind=True, max_retries=2, default_retry_delay=120)
def meta_catalog_sync_all(self):
    """
    Celery task to sync all active products in Poshplex to Meta Catalog.
    """
    try:
        from .models import Product
        from .meta_catalog_service import MetaCatalogService

        cfg = MetaCatalogService.get_config()
        if not cfg.get("has_token"):
            return {"status": "skipped", "reason": "no_token"}

        products = list(
            Product.objects.filter(is_active=True)
            .select_related("brand", "category")
            .prefetch_related("images", "variants")
            .order_by("-id")
        )

        res = MetaCatalogService.sync_products(products, method="UPDATE")
        logger.info(f"[MetaCatalogTask] Bulk sync completed: {res}")
        return res
    except Exception as exc:
        logger.error(f"[MetaCatalogTask] Bulk sync error: {exc}", exc_info=True)
        raise self.retry(exc=exc)


def queue_meta_product_sync(product_id: int, method: str = "UPDATE"):
    """
    Safe dispatcher that attempts to queue Celery task.
    Falls back gracefully to non-blocking daemon thread if Celery broker is unavailable.
    """
    try:
        from .meta_catalog_service import MetaCatalogService
        cfg = MetaCatalogService.get_config()
        if not cfg.get("auto_sync_enabled", True) or not cfg.get("has_token"):
            return

        try:
            meta_catalog_sync_product.delay(product_id, method)
        except Exception as celery_err:
            logger.debug(f"[Celery] Worker dispatch failed ({celery_err}). Running in daemon thread.")
            t = threading.Thread(
                target=_run_sync_synchronously,
                args=(product_id, method),
                daemon=True
            )
            t.start()
    except Exception as e:
        logger.warning(f"[MetaCatalog] Could not queue sync for product {product_id}: {e}")


def queue_meta_product_delete(sku: str):
    """
    Safe dispatcher for product deletion.
    """
    try:
        from .meta_catalog_service import MetaCatalogService
        cfg = MetaCatalogService.get_config()
        if not cfg.get("has_token"):
            return

        try:
            meta_catalog_delete_product.delay(sku)
        except Exception as celery_err:
            logger.debug(f"[Celery] Worker dispatch failed ({celery_err}). Running in daemon thread.")
            t = threading.Thread(
                target=_run_delete_synchronously,
                args=(sku,),
                daemon=True
            )
            t.start()
    except Exception as e:
        logger.warning(f"[MetaCatalog] Could not queue delete for SKU {sku}: {e}")


def _run_sync_synchronously(product_id: int, method: str):
    try:
        from .models import Product
        from .meta_catalog_service import MetaCatalogService
        p = Product.objects.filter(id=product_id).select_related("brand", "category").prefetch_related("images", "variants").first()
        if p:
            MetaCatalogService.sync_products([p], method=method)
    except Exception as err:
        logger.warning(f"[MetaCatalog] Synchronous sync failed for {product_id}: {err}")


def _run_delete_synchronously(sku: str):
    try:
        from .meta_catalog_service import MetaCatalogService
        MetaCatalogService.delete_product_by_sku(sku)
    except Exception as err:
        logger.warning(f"[MetaCatalog] Synchronous delete failed for {sku}: {err}")

