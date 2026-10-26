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
    'poll-meta-metrics-hourly': {
        'task': 'apps.marketing.tasks.poll_performance_metrics',
        'schedule': crontab(minute=0),  # Every hour
    },
    'evaluate-meta-rules-every-30min': {
        'task': 'apps.marketing.tasks.evaluate_automation_rules',
        'schedule': crontab(minute='*/30'),  # Every 30 mins
    },
    'sync-meta-campaign-status-every-15min': {
        'task': 'apps.marketing.tasks.sync_campaign_status',
        'schedule': crontab(minute='*/15'),  # Every 15 mins
    },
    'refresh-meta-tokens-daily': {
        'task': 'apps.marketing.tasks.refresh_expiring_tokens',
        'schedule': crontab(hour=2, minute=0),  # Daily at 02:00 AM
    },
    'reset-ai-quota-midnight': {
        'task': 'apps.marketing.tasks.reset_ai_quota',
        'schedule': crontab(hour=0, minute=0),  # Midnight
    },
    'run-meta-agent-cycle-6hours': {
        'task': 'apps.marketing.tasks.run_meta_agent_cycle',
        'schedule': crontab(hour='0,6,12,18', minute=0),  # Every 6 hours (00:00, 06:00, 12:00, 18:00 Asia/Dhaka)
    },
    'sync-competitor-ads-every-12h': {
        'task': 'apps.marketing.competitor.tasks.sync_competitor_ads',
        'schedule': crontab(hour='0,12', minute=0),  # Every 12 hours
    },
    'sync-tiktok-trends-daily': {
        'task': 'apps.marketing.competitor.tasks.sync_tiktok_trends',
        'schedule': crontab(hour=8, minute=0),  # Daily at 08:00 AM Asia/Dhaka
    },
    'weekly-competitor-report-monday': {
        'task': 'apps.marketing.competitor.tasks.generate_weekly_competitor_report',
        'schedule': crontab(hour=9, minute=0, day_of_week=1),  # Monday at 09:00 AM Asia/Dhaka
    },
}

