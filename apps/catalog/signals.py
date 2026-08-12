from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.core.files.storage import default_storage
from urllib.parse import urlparse
from django.conf import settings

from apps.catalog.models import Category, ProductImage, Review

@receiver(post_delete, sender=Category)
def auto_delete_category_image(sender, instance, **kwargs):
    if instance.image:
        try:
            instance.image.delete(save=False)
        except Exception:
            pass

@receiver(post_delete, sender=ProductImage)
def auto_delete_product_image(sender, instance, **kwargs):
    if instance.image:
        try:
            instance.image.delete(save=False)
        except Exception:
            pass

@receiver(post_delete, sender=Review)
def auto_delete_review_images(sender, instance, **kwargs):
    if instance.images:
        for url in instance.images:
            if url:
                parsed = urlparse(url)
                path = parsed.path
                if path.startswith(settings.MEDIA_URL):
                    rel_path = path[len(settings.MEDIA_URL):]
                    try:
                        if default_storage.exists(rel_path):
                            default_storage.delete(rel_path)
                    except Exception:
                        pass
