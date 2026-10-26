import logging
from decimal import Decimal
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
from apps.fitcheck.models import FitCheckLog
from apps.fitcheck.services.tryon_service import TryOnService

logger = logging.getLogger(__name__)


@shared_task(name='apps.fitcheck.tasks.generate_fit_check_task', bind=True, max_retries=2)
def generate_fit_check_task(self, job_id: str, payload: dict):
    """
    Celery background worker task for AI Virtual Fit Check generation.
    Decouples image processing/external API latency from the HTTP gateway.
    """
    logger.info(f"[Celery] Starting fit check generation for job {job_id}")

    # Set initial processing state in Redis cache for instant sub-millisecond polling
    cache_key = f"fitcheck:job:{job_id}"
    cache.set(cache_key, {"status": "processing", "progress": 25}, timeout=3600)

    log_entry = FitCheckLog.objects.filter(job_id=job_id).first()
    if log_entry:
        log_entry.status = 'processing'
        log_entry.save(update_fields=['status'])

    try:
        face_source = payload.get("face_image") or payload.get("face_image_url")
        product_image_url = payload.get("product_image_url") or ""
        height_cm = int(payload.get("height_cm", 175))
        body_structure = payload.get("body_structure", "athletic")
        gender_preference = payload.get("gender_preference", "unisex")
        product_name = payload.get("product_name", "PoshPlex Apparel")

        # Execute generation
        result = TryOnService.execute_try_on(
            job_id=job_id,
            face_source=face_source,
            product_image_url=product_image_url,
            height_cm=height_cm,
            body_structure=body_structure,
            gender_preference=gender_preference,
            product_name=product_name
        )

        result_url = result.get("result_image_url", "")
        latency = result.get("latency_seconds", 0.0)
        cost = result.get("cost_usd", Decimal("0.0000"))
        provider = result.get("provider", "mock_sandbox")

        # Update database log entry
        if log_entry:
            log_entry.status = 'completed'
            log_entry.result_image_url = result_url
            log_entry.latency_seconds = latency
            log_entry.estimated_cost_usd = cost
            log_entry.provider_used = provider
            log_entry.save()

        # Update Redis cache
        cache_data = {
            "status": "completed",
            "progress": 100,
            "result_image_url": result_url,
            "latency_seconds": latency,
            "provider": provider,
            "fallback_note": result.get("fallback_note", "")
        }
        cache.set(cache_key, cache_data, timeout=7200)

        logger.info(f"[Celery] Fit check completed successfully for job {job_id} in {latency}s")
        return cache_data

    except Exception as exc:
        logger.error(f"[Celery] Error in fit check task {job_id}: {exc}", exc_info=True)
        error_msg = f"Generation failed: {str(exc)[:200]}"

        if log_entry:
            log_entry.status = 'failed'
            log_entry.error_message = error_msg
            log_entry.save(update_fields=['status', 'error_message'])

        cache.set(cache_key, {"status": "failed", "error": error_msg}, timeout=3600)
        raise self.retry(exc=exc, countdown=3)
