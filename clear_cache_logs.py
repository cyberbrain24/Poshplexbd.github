
import os, django, redis, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.core.cache import cache

redis_client = None
if hasattr(cache, 'client'):
    redis_client = cache.client.get_client()
elif hasattr(cache, '_cache'):
    redis_client = cache._cache.get_client()

if redis_client:
    print('Clearing poshplex_error_logs from Django Cache Redis...')
    redis_client.delete('poshplex_error_logs')
    print('Done.')
else:
    print('Could not find Redis client in cache.')
