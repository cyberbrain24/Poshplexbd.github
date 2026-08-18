import os
import uuid
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from django.db import transaction
from django.conf import settings
from urllib.parse import urlparse

from apps.catalog.models import ProductImage, Review, get_product_folder_path, slugify_name

class Command(BaseCommand):
    help = 'Migrates existing product and review images to the dynamic folder structure.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting media path migration...")

        # MIGRATE PRODUCT IMAGES
        images = ProductImage.objects.all()
        moved_images = 0
        for img in images:
            if not img.image:
                continue
            
            old_path = img.image.name
            product = img.product
            folder_path = get_product_folder_path(product, "products")
            base_name = slugify_name(product.name)
            ext = os.path.splitext(old_path)[1]
            
            if not ext:
                ext = '.webp'
                
            # Deduplicate name logic
            # This relies on the PK to keep it simple and unique
            new_filename = f"{base_name}_{img.pk}{ext}"
            new_path = f"{folder_path}/{new_filename}"

            # Only move if the path is different
            if old_path != new_path:
                try:
                    if default_storage.exists(old_path):
                        # Use default_storage to copy the file to the new path
                        file_obj = default_storage.open(old_path, 'rb')
                        default_storage.save(new_path, file_obj)
                        file_obj.close()
                        
                        # Delete old file
                        default_storage.delete(old_path)
                        
                        # Update DB
                        img.image.name = new_path
                        img.save(update_fields=['image'])
                        moved_images += 1
                        self.stdout.write(f"Moved ProductImage {img.pk} -> {new_path}")
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error moving ProductImage {img.pk}: {e}"))

        self.stdout.write(self.style.SUCCESS(f"Successfully migrated {moved_images} Product Images."))

        # MIGRATE REVIEW IMAGES
        reviews = Review.objects.all()
        moved_reviews = 0
        
        for review in reviews:
            if not review.images:
                continue
                
            new_urls = []
            changed = False
            product = review.product
            folder_path = get_product_folder_path(product, "product_reviews")
            base_name = slugify_name(product.name)
            
            for i, url in enumerate(review.images):
                if not url:
                    continue
                    
                # Extract relative path from URL
                parsed = urlparse(url)
                path = parsed.path
                if not path.startswith(settings.MEDIA_URL):
                    new_urls.append(url)
                    continue
                    
                old_rel_path = path[len(settings.MEDIA_URL):]
                if old_rel_path.startswith(f"{folder_path}/{base_name}_review_"):
                    # Already migrated
                    new_urls.append(url)
                    continue
                    
                ext = os.path.splitext(old_rel_path)[1] or '.webp'
                
                new_filename = f"{base_name}_review_{review.pk}_{uuid.uuid4().hex[:6]}{ext}"
                new_path = f"{folder_path}/{new_filename}"
                
                try:
                    if default_storage.exists(old_rel_path):
                        file_obj = default_storage.open(old_rel_path, 'rb')
                        default_storage.save(new_path, file_obj)
                        file_obj.close()
                        
                        default_storage.delete(old_rel_path)
                        
                        # Reconstruct URL
                        base_url = getattr(settings, 'MEDIA_URL', '/media/')
                        if getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None):
                            # S3 backend automatically uses the custom domain in default_storage.url
                            new_url = default_storage.url(new_path)
                        else:
                            new_url = f"{base_url}{new_path}"
                            
                        # If S3 doesn't prefix http, fix it (similar to api.py logic)
                        if new_url and not (new_url.startswith("http://") or new_url.startswith("https://")):
                            site_base = os.environ.get('SITE_BASE_URL', 'http://localhost:8000')
                            new_url = f"{site_base.rstrip('/')}{new_url}"
                            
                        new_urls.append(new_url)
                        changed = True
                        moved_reviews += 1
                        self.stdout.write(f"Moved Review {review.pk} image -> {new_path}")
                    else:
                        new_urls.append(url)
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error moving Review {review.pk} image: {e}"))
                    new_urls.append(url)
                    
            if changed:
                review.images = new_urls
                review.save(update_fields=['images'])
                
        self.stdout.write(self.style.SUCCESS(f"Successfully migrated {moved_reviews} Review Images."))
        self.stdout.write(self.style.SUCCESS("Migration complete!"))
