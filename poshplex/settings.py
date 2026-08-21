from pathlib import Path
import environ

# Initialize environment variables
env = environ.Env(
    DEBUG=(bool, True),
    ALLOWED_HOSTS=(list, ['localhost', '127.0.0.1']),
    DATABASE_URL=(str, 'sqlite:///db.sqlite3'),
    REDIS_URL=(str, ''),
    CORS_ALLOWED_ORIGINS=(list, ['http://localhost:3000', 'http://localhost:3001']),
    RATE_LIMIT_PER_MINUTE=(int, 100),
    JWT_EXPIRATION_MINUTES=(int, 4320),
    JWT_REFRESH_EXPIRATION_DAYS=(int, 7),
)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Read .env file if it exists
env_file = BASE_DIR / '.env'
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env('SECRET_KEY')

DEBUG = env('DEBUG')
APPEND_SLASH = False  # Django-Ninja APIs do not use Django URL patterns; disable redirect-on-missing-slash

ALLOWED_HOSTS = env('ALLOWED_HOSTS')
if 'api.poshplexbd.com' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('api.poshplexbd.com')
if 'poshplexbd.com' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('poshplexbd.com')
if 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('testserver')
if 'backend' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('backend')


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Domain Modules
    'apps.core.apps.CoreConfig',
    'apps.finance.apps.FinanceConfig',
    'apps.catalog.apps.CatalogConfig',
    'apps.crm.apps.CrmConfig',
    'apps.orders.apps.OrdersConfig',
    'apps.marketing.apps.MarketingConfig',
    'apps.integration.apps.IntegrationConfig',
    'apps.music.apps.MusicConfig',
    'apps.printing.apps.PrintingConfig',
    'apps.image_optimizer.apps.ImageOptimizerConfig',
    'apps.monitor.apps.MonitorConfig',
    'apps.tasks.apps.TasksConfig',
    'django_cleanup.apps.CleanupConfig',
]

MIDDLEWARE = [
    'apps.core.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    
    # Rate limiting middleware
    'apps.core.middleware.RateLimitMiddleware',
    
    # Audit log user context middleware
    'apps.core.middleware.AuditMiddleware',
]

ROOT_URLCONF = 'poshplex.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'poshplex.wsgi.application'
ASGI_APPLICATION = 'poshplex.asgi.application'

# Database
DATABASES = {
    'default': env.db('DATABASE_URL')
}

# Database connection pooling — reuse connections for 10 minutes
DATABASES['default']['CONN_MAX_AGE'] = 600

# Custom User Model
AUTH_USER_MODEL = 'core.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# --------------------------
# CLOUDFLARE R2 / S3 STORAGE
# --------------------------
USE_CLOUDFLARE_R2 = env('USE_CLOUDFLARE_R2', default=False, cast=bool)

# We always add storages to INSTALLED_APPS so it's available for DynamicStorageRouter
if 'storages' not in INSTALLED_APPS:
    INSTALLED_APPS.append('storages')
    
DEFAULT_FILE_STORAGE = 'apps.core.storage.DynamicStorageRouter'

# Fallbacks for initial startup or migrations before DB is populated
AWS_ACCESS_KEY_ID = env('R2_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = env('R2_SECRET_ACCESS_KEY', default='')
AWS_STORAGE_BUCKET_NAME = env('R2_BUCKET_NAME', default='')
AWS_S3_ENDPOINT_URL = env('R2_ENDPOINT_URL', default='')
AWS_S3_CUSTOM_DOMAIN = env('R2_CUSTOM_DOMAIN', default='')
if not AWS_S3_CUSTOM_DOMAIN:
    AWS_S3_CUSTOM_DOMAIN = None

# Custom router handles MEDIA_URL dynamically by overriding the url() method,
# but we still need a global MEDIA_URL for local development.
# If a custom domain is provided in env, use it as fallback for MEDIA_URL
if AWS_S3_CUSTOM_DOMAIN:
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
elif USE_CLOUDFLARE_R2 and AWS_S3_ENDPOINT_URL:
    MEDIA_URL = f'{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/'
else:
    MEDIA_URL = '/media/'


# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --------------------------
# JWT CONFIGURATION
# --------------------------
JWT_SECRET_KEY = SECRET_KEY  # Uses the main secret key by default
JWT_EXPIRATION_MINUTES = env('JWT_EXPIRATION_MINUTES')  # Default 4320 min = 72 hours (defined in Env schema above)
JWT_REFRESH_EXPIRATION_DAYS = env('JWT_REFRESH_EXPIRATION_DAYS')

# --------------------------
# CORS CONFIGURATION
# --------------------------
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS')

# --------------------------
# RATE LIMITING CONFIGURATION
# --------------------------
RATE_LIMIT_PER_MINUTE = env('RATE_LIMIT_PER_MINUTE')

# --------------------------
# CELERY WORKER CONFIGURATION
# --------------------------
# Route AI Gateway background tasks securely via Redis without blocking the main API threads.
CELERY_BROKER_URL = env('REDIS_URL', default='redis://localhost:6379/1')
CELERY_RESULT_BACKEND = env('REDIS_URL', default='redis://localhost:6379/1')
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

if DEBUG:
    # Run tasks synchronously locally to prevent freezing if Redis is down
    CELERY_TASK_ALWAYS_EAGER = True


# Caching Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
        'redis_monitor': {
            'class': 'apps.monitor.logging.RedisListHandler',
            'key': 'poshplex_error_logs',
            'max_logs': 1000,
            'level': 'ERROR',
        },
    },
    'root': {
        'handlers': ['console', 'redis_monitor'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'redis_monitor'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console', 'redis_monitor'],
            'level': 'INFO',
            'propagate': False,
        }
    },
}
if env('REDIS_URL'):
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': env('REDIS_URL'),
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            }
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'poshplex-cache',
        }
    }



