import logging
import json
import traceback
from datetime import datetime
import uuid
from django.core.cache import cache

class RedisListHandler(logging.Handler):
    """
    Custom logging handler that pushes log records to a Redis list.
    Limits the list to exactly MAX_LOGS items (ring-buffer).
    """
    
    def __init__(self, key="poshplex_error_logs", max_logs=1000, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.key = key
        self.max_logs = max_logs

    def emit(self, record):
        try:
            # We must grab the raw redis client from the Django cache
            redis_client = None
            if hasattr(cache, 'client'):
                redis_client = cache.client.get_client()
            elif hasattr(cache, '_cache'): # fallback for some django-redis versions
                redis_client = cache._cache.get_client()
            
            if not redis_client:
                return # If redis is not configured, drop the log to avoid infinite recursion
            
            # Format the exception traceback if present
            exc_info = record.exc_info
            stack_trace = ""
            if exc_info:
                stack_trace = "".join(traceback.format_exception(*exc_info))
            
            log_data = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "stack_trace": stack_trace,
                "source": "backend",
                "path": getattr(record, 'request', None) and getattr(record.request, 'path', ''),
            }
            
            # Push to the front of the list
            redis_client.lpush(self.key, json.dumps(log_data))
            # Cap the list length to max_logs
            redis_client.ltrim(self.key, 0, self.max_logs - 1)
            
        except Exception:
            # Important: Ignore errors in the logging handler itself to prevent infinite recursive crashes
            self.handleError(record)
