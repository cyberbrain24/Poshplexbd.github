
import os, django, redis, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.conf import settings

r = redis.Redis.from_url(settings.CELERY_BROKER_URL)
logs = r.lrange('poshplex_error_logs', 0, 5)
print('Latest logs in Redis:')
for log in logs:
    try:
        data = json.loads(log.decode('utf-8'))
        print(f"Timestamp: {data.get('timestamp')}")
        print(f"Message: {data.get('message')}")
        print(f"Path: {data.get('path')}")
        print(f"Traceback: {data.get('traceback')}")
        print("-" * 40)
    except:
        pass
