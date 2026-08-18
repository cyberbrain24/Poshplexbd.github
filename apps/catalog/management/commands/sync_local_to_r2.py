import os
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.files.storage import FileSystemStorage
import boto3
from botocore.exceptions import ClientError
from apps.catalog.models import ProductImage, Review
from urllib.parse import urlparse

class Command(BaseCommand):
    help = 'Uploads all local media files to Cloudflare R2'

    def handle(self, *args, **kwargs):
        # We assume USE_CLOUDFLARE_R2=True in .env so default_storage is S3, 
        # but the local files are still in MEDIA_ROOT
        
        local_storage = FileSystemStorage(location=settings.MEDIA_ROOT)
        
        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
        endpoint = getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
        access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
        secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
        
        if not all([bucket_name, endpoint, access_key, secret_key]):
            self.stdout.write(self.style.ERROR("R2 credentials not fully configured in settings."))
            return
            
        s3 = boto3.client('s3',
                          endpoint_url=endpoint,
                          aws_access_key_id=access_key,
                          aws_secret_access_key=secret_key,
                          config=boto3.session.Config(signature_version='s3v4'))
                          
        self.stdout.write(self.style.SUCCESS(f"Connected to R2 bucket: {bucket_name}"))
        
        # We only want to upload files that are actually referenced in the database to save time and space
        
        paths_to_upload = set()
        
        for img in ProductImage.objects.all():
            if img.image:
                paths_to_upload.add(img.image.name)
                
        for review in Review.objects.all():
            if review.images:
                for url in review.images:
                    if url:
                        parsed = urlparse(url)
                        path = parsed.path
                        # E.g. /media/Upper_Wear/...
                        base_url = getattr(settings, 'MEDIA_URL', '/media/')
                        # We extract the relative path
                        # Since we might have already swapped custom domain, we check if it ends with the known path
                        # Actually, our earlier migration saved the relative path in the DB! No wait, review.images stores FULL URLs.
                        # We must extract the relative part
                        parts = path.split('/products/')
                        if len(parts) > 1:
                            rel_path = path[path.find(parts[0].split('/')[-1]):] # rough extraction
                        else:
                            parts = path.split('/product_reviews/')
                            if len(parts) > 1:
                                # Find where the category path starts
                                # E.g. Upper_Wear/Acid_Drop/product_reviews/...
                                # We can just find the first folder that matches a known category
                                pass
                                
                        # To be completely safe and thorough, let's just walk the local directory
                        # instead of relying on the DB paths, because local dir contains exactly what was migrated!
        
        self.stdout.write("Scanning local media directory...")
        
        upload_count = 0
        skip_count = 0
        
        for root, dirs, files in os.walk(settings.MEDIA_ROOT):
            for file in files:
                local_path = os.path.join(root, file)
                # Get relative path from MEDIA_ROOT
                rel_path = os.path.relpath(local_path, settings.MEDIA_ROOT)
                # Convert Windows slashes to forward slashes for S3
                s3_key = rel_path.replace(os.sep, '/')
                
                # Check if it exists in S3
                try:
                    s3.head_object(Bucket=bucket_name, Key=s3_key)
                    self.stdout.write(f"Skipping (already exists): {s3_key}")
                    skip_count += 1
                except ClientError as e:
                    if e.response['Error']['Code'] == '404':
                        # File does not exist, upload it
                        self.stdout.write(f"Uploading: {s3_key}")
                        content_type = 'image/webp' if s3_key.endswith('.webp') else 'application/octet-stream'
                        s3.upload_file(local_path, bucket_name, s3_key, ExtraArgs={'ContentType': content_type, 'CacheControl': 'max-age=86400'})
                        upload_count += 1
                    else:
                        self.stdout.write(self.style.ERROR(f"Error checking {s3_key}: {e}"))
                        
        self.stdout.write(self.style.SUCCESS(f"Migration complete! Uploaded {upload_count} files. Skipped {skip_count} files."))
