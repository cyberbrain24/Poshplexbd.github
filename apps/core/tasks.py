import logging
from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)

@shared_task
def clear_expired_sessions_task():
    """
    Nightly maintenance task to clear expired Django sessions from the database.
    """
    logger.info("Running nightly session cleanup...")
    call_command('clearsessions')
    return True

@shared_task
def send_automated_notification(event_type: str, context: dict):
    """
    Sends automated email/sms notifications based on settings configuration.
    event_type: "account" | "order"
    context: dict of variables (e.g. {"username": "Imran", "order_id": "123"})
    """
    from apps.core.models import Setting
    import requests
    
    try:
        settings_obj = Setting.objects.filter(key="automated_notifications").first()
        if not settings_obj or not settings_obj.value:
            logger.info("Automated notifications not configured. Skipping.")
            return False
            
        config = settings_obj.value.get(event_type, {})
        
        # 1. Handle SMS
        sms_config = config.get("sms", {})
        if sms_config.get("enabled"):
            template = sms_config.get("body", "")
            message = template.format(**context)
            phone = context.get("phone")
            
            if phone:
                try:
                    from apps.integration.services import send_sms_notification
                    success = send_sms_notification(phone, message)
                    if success:
                        logger.info(f"Dispatched SMS to {phone}")
                    else:
                        logger.error(f"SMS Dispatch failed for {phone}")
                except Exception as e:
                    logger.error(f"SMS Dispatch failed: {e}")
            else:
                logger.warning(f"SMS enabled for {event_type} but no phone number in context.")

        # 2. Handle Email
        email_config = config.get("email", {})
        if email_config.get("enabled"):
            subject_tmpl = email_config.get("subject", "")
            body_tmpl = email_config.get("body", "")
            
            subject = subject_tmpl.format(**context)
            body = body_tmpl.format(**context)
            email = context.get("email")
            
            if email:
                logger.info(f"Dispatched Email to {email} | Subj: {subject} | Body: {body}")
                # Mock email send for now to prevent spam
            else:
                logger.warning(f"Email enabled for {event_type} but no email in context.")

        return True
    except Exception as e:
        logger.error(f"Failed to process automated notification: {e}", exc_info=True)
        return False

