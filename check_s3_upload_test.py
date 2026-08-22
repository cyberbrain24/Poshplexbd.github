
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'poshplex.settings')
django.setup()
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.catalog.models import Product, ProductImage

try:
    p = Product.objects.get(id=240)
    print('Testing ProductImage upload...')
    file = SimpleUploadedFile("test_upload.webp", b"WEBP fake content", content_type="image/webp")
    
    img = ProductImage.objects.create(
        product=p,
        image=file,
        alt_text="Test Upload",
    )
    
    print(f'Created image ID {img.id}')
    print(f'Name: {img.image.name}')
    print(f'URL: {img.image.url}')
    
    # Check if it actually exists in S3
    from django.core.files.storage import default_storage
    exists = default_storage.exists(img.image.name)
    print(f'Exists in S3: {exists}')
    
    # Cleanup
    img.delete()
    print('Cleaned up.')
    
except Exception as e:
    import traceback
    traceback.print_exc()
