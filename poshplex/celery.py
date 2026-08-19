import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')

# Create the Celery application instance
app = Celery('poshplex')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# namespace='CELERY' means all celery-related configuration keys
# should have a `CELERY_` prefix in Django's settings.py.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs (looks for tasks.py files).
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'clear-expired-sessions-nightly': {
        'task': 'apps.core.tasks.clear_expired_sessions_task',
        'schedule': crontab(hour=0, minute=0),  # Run daily at midnight
    },
}
