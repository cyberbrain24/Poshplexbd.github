from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.core.files.storage import default_storage
from urllib.parse import urlparse
from django.conf import settings

from apps.crm.models import CustomerProfile

@receiver(post_delete, sender=CustomerProfile)
def auto_delete_customer_profile_image(sender, instance, **kwargs):
    if instance.profile_image:
        parsed = urlparse(instance.profile_image)
        path = parsed.path
        if path.startswith(settings.MEDIA_URL):
            rel_path = path[len(settings.MEDIA_URL):]
            try:
                if default_storage.exists(rel_path):
                    default_storage.delete(rel_path)
            except Exception:
                pass

    # Also delete the shadow user if they have one
    if hasattr(instance, 'user') and instance.user:
        try:
            instance.user.delete()
        except Exception:
            pass
