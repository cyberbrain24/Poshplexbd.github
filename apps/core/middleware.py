import contextvars
import time
from django.http import HttpResponse, JsonResponse
from django.conf import settings
from django.core.cache import cache

# Global thread/async-safe context variable to hold the current user
_current_user = contextvars.ContextVar('current_user', default=None)
class CorsMiddleware:
    """
    Middleware to inject CORS headers for browser requests from authorized frontend
    origins and handle preflight OPTIONS requests.
    Reads allowed origins from settings.CORS_ALLOWED_ORIGINS.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.META.get('HTTP_ORIGIN', '')
        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])

        # In DEBUG mode, also allow any localhost origin for convenience
        is_allowed = origin in allowed_origins
        if not is_allowed and settings.DEBUG and ('localhost' in origin or '127.0.0.1' in origin):
            is_allowed = True

        if request.method == "OPTIONS":
            response = HttpResponse()
        else:
            response = self.get_response(request)

        if is_allowed:
            response["Access-Control-Allow-Origin"] = origin
        elif not origin:
            # Non-browser requests (curl, server-to-server) — allow without CORS header
            pass

        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response["Access-Control-Allow-Credentials"] = "true"
        
        # Ensure API responses are never cached by edge networks (like Cloudflare) or browsers
        if request.path.startswith('/api/'):
            response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            
        return response


class RateLimitMiddleware:
    """
    Simple in-memory rate limiting middleware.
    Limits requests per IP to RATE_LIMIT_PER_MINUTE (default: 100).
    For production with multiple workers, use Redis-based rate limiting.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        rate_limit = getattr(settings, 'RATE_LIMIT_PER_MINUTE', 100)
        
        # Skip rate limiting for health checks, static files, and in DEBUG mode
        if settings.DEBUG or request.path.startswith('/static/') or request.path.startswith('/media/') or request.path == '/api/v1/health':
            return self.get_response(request)

        ip = self._get_client_ip(request)
        cache_key = f"rl_{ip}"
        now = time.time()
        window_start = now - 60  # 1-minute sliding window

        # Retrieve request timestamps from cache
        requests = cache.get(cache_key, [])
        # Clean old entries and count recent requests
        requests = [t for t in requests if t > window_start]

        if len(requests) >= rate_limit:
            return JsonResponse(
                {"detail": "Rate limit exceeded. Please try again in a minute."},
                status=429
            )

        requests.append(now)
        cache.set(cache_key, requests, timeout=60)
        return self.get_response(request)

    def _get_client_ip(self, request):
        """Extract client IP, respecting X-Forwarded-For behind proxies."""
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '0.0.0.0')


def get_current_user():
    """Retrieve the current user from context."""
    return _current_user.get()

def set_current_user(user):
    """Explicitly set the current user in context (useful for tests or non-HTTP scripts)."""
    return _current_user.set(user)

class AuditMiddleware:
    """
    Middleware to capture the current authenticated user from the HTTP request
    and set it in thread-local context variables for audit logging.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            token = _current_user.set(user)
        else:
            token = _current_user.set(None)
            
        try:
            response = self.get_response(request)
        finally:
            # Safely reset context to prevent leaks between requests
            _current_user.reset(token)
            
        return response
