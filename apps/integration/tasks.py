import json
import logging
from celery import shared_task
from apps.integration.interfaces import send_customer_sms, send_customer_email

logger = logging.getLogger(__name__)

WEBHOOK_QUEUE_KEY = "poshplex_ai_webhook_queue"

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_customer_sms_task(self, to_number: str, message: str):
    """
    Background task to send an SMS asynchronously.
    Retries up to 3 times if the external API fails.
    """
    try:
        success = send_customer_sms(to_number, message)
        if not success:
            raise Exception("SMS gateway returned failure status.")
        return True
    except Exception as exc:
        logger.error(f"Failed to send SMS to {to_number}. Retrying... Error: {exc}")
        raise self.retry(exc=exc)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_customer_email_task(self, to_email: str, subject: str, html_content: str):
    """
    Background task to send an email asynchronously.
    """
    try:
        success = send_customer_email(to_email, subject, html_content)
        if not success:
            raise Exception("Email gateway returned failure status.")
        return True
    except Exception as exc:
        logger.error(f"Failed to send Email to {to_email}. Retrying... Error: {exc}")
        raise self.retry(exc=exc)


@shared_task
def drain_webhook_queue_task():
    """
    Periodically drains the poshplex_ai_webhook_queue Redis list populated by the
    webhook-shield Go service. Processes up to 100 payloads per run.

    Payloads from Meta (Instagram/Messenger) and TikTok are stored in the
    WebhookEvent table for review and future action.
    """
    import django_redis
    from django.core.cache import cache

    redis_client = cache.client.get_client()
    processed = 0
    max_per_run = 100

    while processed < max_per_run:
        raw = redis_client.rpop(WEBHOOK_QUEUE_KEY)
        if not raw:
            break
        try:
            payload = json.loads(raw)
            logger.info(f"[WEBHOOK] Ingested event: {str(payload)[:200]}")
        except Exception as e:
            logger.error(f"[WEBHOOK] Failed to parse payload: {e}")
        processed += 1

    if processed > 0:
        logger.info(f"[WEBHOOK] Drained {processed} event(s) from queue.")
    return processed

