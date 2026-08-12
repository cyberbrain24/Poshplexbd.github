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
