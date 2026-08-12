# Celery is loaded conditionally to avoid crashing Django
# if the celery package is not installed in the environment.
try:
    from .celery import app as celery_app
    __all__ = ('celery_app',)
except ImportError:
    # celery not installed — workers unavailable but Django runs fine
    pass
