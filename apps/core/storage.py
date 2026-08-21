import logging
from django.core.files.storage import Storage, FileSystemStorage
from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings

logger = logging.getLogger(__name__)

class DynamicStorageRouter(Storage):
    """
    A custom storage router that dynamically delegates storage operations to either 
    Cloudflare R2 (S3Boto3Storage) or local FileSystemStorage based on database configuration.
    """
    def __init__(self, *args, **kwargs):
        from apps.core.models import SiteSetting
        try:
            config = SiteSetting.get_value("cloudflare_r2_config", {})
            use_r2 = config.get("use_r2", getattr(settings, 'USE_CLOUDFLARE_R2', False))
        except Exception as e:
            # Fallback during migrations, early startup, or DB connection issues
            use_r2 = getattr(settings, 'USE_CLOUDFLARE_R2', False)
            config = {}
            
        if use_r2:
            try:
                self.storage = S3Boto3Storage(
                    access_key=config.get("access_key_id") or getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
                    secret_key=config.get("secret_access_key") or getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
                    bucket_name=config.get("bucket_name") or getattr(settings, 'AWS_STORAGE_BUCKET_NAME', ''),
                    endpoint_url=config.get("endpoint_url") or getattr(settings, 'AWS_S3_ENDPOINT_URL', ''),
                    custom_domain=config.get("custom_domain") or getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None),
                    object_parameters={'CacheControl': 'max-age=86400'},
                    signature_version='s3v4',
                    file_overwrite=False,
                    default_acl=None,
                )
            except Exception as e:
                logger.error(f"Failed to initialize S3Boto3Storage: {e}. Falling back to FileSystemStorage.")
                self.storage = FileSystemStorage()
        else:
            self.storage = FileSystemStorage()
            
    # Delegate standard Storage methods to the underlying backend
    def _open(self, name, mode='rb'):
        return self.storage._open(name, mode)

    def _save(self, name, content):
        return self.storage._save(name, content)

    def get_valid_name(self, name):
        return self.storage.get_valid_name(name)

    def get_available_name(self, name, max_length=None):
        return self.storage.get_available_name(name, max_length)

    def path(self, name):
        return self.storage.path(name)

    def delete(self, name):
        return self.storage.delete(name)

    def exists(self, name):
        return self.storage.exists(name)

    def listdir(self, path):
        return self.storage.listdir(path)

    def size(self, name):
        return self.storage.size(name)

    def url(self, name):
        return self.storage.url(name)

    def get_accessed_time(self, name):
        return self.storage.get_accessed_time(name)

    def get_created_time(self, name):
        return self.storage.get_created_time(name)

    def get_modified_time(self, name):
        return self.storage.get_modified_time(name)
